import { addYears, differenceInCalendarDays } from 'date-fns';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_NAME = 'recur.db';
const ENABLE_DATA_LAYER_DEBUG_LOG = false;

let databasePromise: Promise<SQLiteDatabase> | null = null;

export type BillingCycle = 'weekly' | 'monthly' | 'yearly' | 'custom';

export type Subscription = {
  id: number;
  name: string;
  cost: number;
  currency: string;
  billing_cycle: BillingCycle;
  custom_cycle_days: number | null;
  next_renewal_date: string;
  category: string;
  is_trial: boolean;
  trial_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionInput = {
  name: string;
  cost: number;
  currency?: string;
  billing_cycle: BillingCycle;
  custom_cycle_days?: number | null;
  next_renewal_date: string;
  category?: string;
  is_trial?: boolean;
  trial_end_date?: string | null;
  notes?: string | null;
};

export type SubscriptionUpdate = Partial<SubscriptionInput>;

type SubscriptionRow = Omit<Subscription, 'is_trial'> & {
  is_trial: number;
};

type SubscriptionColumn = keyof SubscriptionInput;

const SUBSCRIPTION_UPDATE_COLUMNS: SubscriptionColumn[] = [
  'name',
  'cost',
  'currency',
  'billing_cycle',
  'custom_cycle_days',
  'next_renewal_date',
  'category',
  'is_trial',
  'trial_end_date',
  'notes',
];

const GREGORIAN_CYCLE_START = new Date(2000, 0, 1);
const AVERAGE_DAYS_PER_MONTH =
  differenceInCalendarDays(addYears(GREGORIAN_CYCLE_START, 400), GREGORIAN_CYCLE_START) /
  (400 * 12);

export async function getDatabase() {
  databasePromise ??= openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}

export async function initializeDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cost REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('weekly','monthly','yearly','custom')),
      custom_cycle_days INTEGER,
      next_renewal_date TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      is_trial INTEGER NOT NULL DEFAULT 0,
      trial_end_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reminder_lead_days INTEGER NOT NULL DEFAULT 3,
      default_currency TEXT NOT NULL DEFAULT 'USD',
      is_pro INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.runAsync(`
    INSERT INTO app_settings (id)
    SELECT 1
    WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
  `);
}

export async function addSubscription(input: SubscriptionInput) {
  await initializeDatabase();
  const db = await getDatabase();

  const result = await db.runAsync(
    `
      INSERT INTO subscriptions (
        name,
        cost,
        currency,
        billing_cycle,
        custom_cycle_days,
        next_renewal_date,
        category,
        is_trial,
        trial_end_date,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      input.name,
      input.cost,
      input.currency ?? 'USD',
      input.billing_cycle,
      input.custom_cycle_days ?? null,
      input.next_renewal_date,
      input.category ?? 'Other',
      input.is_trial ? 1 : 0,
      input.trial_end_date ?? null,
      input.notes ?? null,
    ]
  );

  return getSubscriptionById(result.lastInsertRowId);
}

export async function getAllSubscriptions() {
  await initializeDatabase();
  const db = await getDatabase();
  const rows = await db.getAllAsync<SubscriptionRow>(`
    SELECT *
    FROM subscriptions
    ORDER BY date(next_renewal_date) ASC, name COLLATE NOCASE ASC;
  `);

  return rows.map(mapSubscriptionRow);
}

export async function updateSubscription(id: number, updates: SubscriptionUpdate) {
  await initializeDatabase();

  const entries = SUBSCRIPTION_UPDATE_COLUMNS.filter((column) => updates[column] !== undefined).map(
    (column) => [column, updates[column]] as const
  );

  if (entries.length === 0) {
    return getSubscriptionById(id);
  }

  const db = await getDatabase();
  const setClauses = entries.map(([column]) => `${column} = ?`);
  const values = entries.map(([column, value]) => normalizeValueForDatabase(column, value));

  await db.runAsync(
    `
      UPDATE subscriptions
      SET ${setClauses.join(', ')}, updated_at = datetime('now')
      WHERE id = ?;
    `,
    [...values, id]
  );

  return getSubscriptionById(id);
}

export async function deleteSubscription(id: number) {
  await initializeDatabase();
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM subscriptions WHERE id = ?;', [id]);
  return result.changes > 0;
}

export function getMonthlyCost(
  subscription: Pick<Subscription, 'billing_cycle' | 'cost' | 'custom_cycle_days'>
) {
  switch (subscription.billing_cycle) {
    case 'weekly':
      return subscription.cost * (AVERAGE_DAYS_PER_MONTH / 7);
    case 'monthly':
      return subscription.cost;
    case 'yearly':
      return subscription.cost / 12;
    case 'custom':
      if (!subscription.custom_cycle_days || subscription.custom_cycle_days <= 0) {
        throw new Error('custom_cycle_days is required for custom billing cycles.');
      }
      return subscription.cost * (AVERAGE_DAYS_PER_MONTH / subscription.custom_cycle_days);
  }
}

export async function logSubscriptionsForDebugging() {
  if (!ENABLE_DATA_LAYER_DEBUG_LOG) {
    return;
  }

  const subscriptions = await getAllSubscriptions();
  console.log(
    '[Recur subscriptions debug]',
    subscriptions.map((subscription) => ({
      ...subscription,
      monthly_cost: Number(getMonthlyCost(subscription).toFixed(2)),
    }))
  );
}

async function getSubscriptionById(id: number) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SubscriptionRow>('SELECT * FROM subscriptions WHERE id = ?;', [
    id,
  ]);

  if (!row) {
    throw new Error(`Subscription ${id} was not found.`);
  }

  return mapSubscriptionRow(row);
}

function mapSubscriptionRow(row: SubscriptionRow): Subscription {
  return {
    ...row,
    is_trial: row.is_trial === 1,
  };
}

function normalizeValueForDatabase(column: SubscriptionColumn, value: SubscriptionUpdate[SubscriptionColumn]) {
  if (column === 'is_trial') {
    return value ? 1 : 0;
  }

  return value ?? null;
}
