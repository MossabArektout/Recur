# App Name Options

1. **Leaky** — short, memorable, implies "stop the leak"
2. **Subly** — clean, sounds like a real consumer app
3. **Recur** — plays on "recurring charges," feels premium/minimal
4. **Trimly** — implies trimming unnecessary spend
5. **WatchList** *(careful — check trademark/naming collisions before using)*

**Pick: Recur** — short, easy to say, easy to brand, works well as an app icon wordmark, and the name itself hints at the problem (recurring charges) without being cutesy.

---

# Recur — Build Spec

## One-line pitch
Recur tracks every subscription and free trial you have, shows you exactly how much you're really spending each month, and reminds you before you get charged — so you never pay for something you forgot about again.

## Core problem statement (for your app store listing later)
People sign up for free trials and subscriptions constantly and forget to cancel before they convert to paid charges, or keep paying for services they no longer use. Bank statements show cryptic merchant names that don't identify the subscription, so people can't tell what to cancel even when they see the charge. Recur gives a single, clear view of every subscription, its cost, and when it renews.

---

## MVP Feature Set

### 1. Manual entry (add/edit subscription)
Fields per subscription:
- `name` (text, required) — e.g. "Netflix"
- `cost` (decimal, required)
- `currency` (default to device locale, editable)
- `billing_cycle` (enum: weekly / monthly / yearly / custom_days)
- `next_renewal_date` (date, required)
- `category` (enum: Streaming, Software/SaaS, Fitness, Food/Meal Kits, Gaming, News/Media, Other — editable list)
- `is_trial` (boolean)
- `trial_end_date` (date, only shown if is_trial = true)
- `notes` (text, optional)
- `icon_or_color` (optional, for visual list — can auto-assign by category first, let user customize later)

### 2. Dashboard (home screen)
- Total spend this month (sum of all active subscriptions normalized to monthly cost)
- Total spend this year (normalized to yearly)
- List of subscriptions sorted by soonest `next_renewal_date` first
- Visual flag for anything renewing within 7 days (yellow) or is a trial ending within 3 days (red/urgent)

### 3. Reminder notifications
- Default: notify 3 days before `next_renewal_date`
- Trials get a stronger/earlier reminder: notify 3 days AND 1 day before `trial_end_date`
- Let user customize reminder lead time in settings later (v2, not required for launch)

### 4. Trial flag behavior
- When `is_trial = true`, show a distinct badge/color on that list item ("TRIAL — ends in X days")
- After `trial_end_date` passes, prompt user (via notification or in-app banner) to either convert it to a normal paid subscription entry or delete it if they cancelled

### 5. Paywall / monetization
- Free tier: max 5 active subscriptions tracked
- On attempting to add a 6th, show upgrade prompt
- Paid tier: $2.99/month or $14.99/year
  - Unlocks unlimited subscriptions
  - Unlocks spend analytics (category breakdown, month-over-month trend)
  - Unlocks category breakdown chart (simple pie or bar chart — total spend by category)

---

## Screens list (for your vibe-coding prompt)
1. **Onboarding** — 1-2 screens explaining the app's value ("Never get surprise-charged again"), then straight into empty dashboard
2. **Dashboard / Home** — total spend summary + sorted list of subscriptions
3. **Add/Edit Subscription** — form with fields above
4. **Subscription Detail** — tap an item to see full detail, edit, or delete
5. **Analytics** (paid feature) — category breakdown chart, spend trend
6. **Paywall screen** — triggered when hitting free limit or tapping "Unlock Pro"
7. **Settings** — currency, notification lead time, manage subscription (RevenueCat/StoreKit restore purchase link required by app stores)

---

## Data model (SQLite schema)

```sql
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cost REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('weekly','monthly','yearly','custom')),
  custom_cycle_days INTEGER, -- only used if billing_cycle = 'custom'
  next_renewal_date TEXT NOT NULL, -- ISO 8601 date
  category TEXT NOT NULL DEFAULT 'Other',
  is_trial INTEGER NOT NULL DEFAULT 0, -- boolean 0/1
  trial_end_date TEXT, -- ISO 8601 date, nullable
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reminder_lead_days INTEGER NOT NULL DEFAULT 3,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  is_pro INTEGER NOT NULL DEFAULT 0 -- boolean, synced with RevenueCat entitlement
);
```

---

## Tech stack recommendation
- **Framework**: React Native (Expo) — fastest path for a solo builder to ship both iOS + Android from one codebase, huge ecosystem, works great with AI-assisted/vibe-coding tools
- **Local storage**: `expo-sqlite` (no backend server needed for v1)
- **Notifications**: `expo-notifications` (local scheduled notifications, no push server required)
- **Charts** (for analytics screen): `react-native-chart-kit` or `victory-native`
- **Subscriptions/paywall**: RevenueCat — handles both App Store and Play Store subscription logic, receipt validation, and restore purchases with minimal setup. Sign up free at revenuecat.com, it has a generous free tier for early-stage apps.
- **State management**: React Context or Zustand — don't overengineer this, the app is simple enough not to need Redux

---

## Renewal date math (core logic to get right)
- **Weekly**: next_renewal_date + 7 days after each renewal
- **Monthly**: next_renewal_date + 1 calendar month (careful with month-length edge cases — use a date library like `date-fns` or `dayjs`, don't hand-roll this)
- **Yearly**: next_renewal_date + 1 year
- **Custom**: next_renewal_date + custom_cycle_days
- After a renewal date passes, auto-roll it forward to the next cycle (don't require manual re-entry) — this is important for retention, since a stale/wrong renewal date breaks trust in the app fast

---

## Build order (suggested sequence for your vibe-coding sessions)
1. Set up Expo project, install expo-sqlite, expo-notifications, date-fns
2. Build the data layer: SQLite schema + basic CRUD functions (add/edit/delete/list subscriptions)
3. Build Add/Edit Subscription screen, wire to data layer
4. Build Dashboard screen — list + total spend calculation (normalize all cycles to monthly for the total)
5. Build Subscription Detail screen
6. Wire up local notifications on add/edit (schedule based on next_renewal_date - reminder_lead_days)
7. Build free-tier limit logic (block 6th subscription, show paywall)
8. Integrate RevenueCat, build Paywall screen
9. Build Analytics screen (pro-gated)
10. Polish: onboarding screens, empty states, app icon, splash screen
11. Test full flow on both iOS simulator and Android emulator
12. Submit to App Store + Play Store

---

## First prompt to paste into your vibe-coding tool
> Build a React Native (Expo) app called "Recur" that tracks recurring subscriptions. Set up an Expo project with expo-sqlite for local storage using this schema: [paste the SQL schema above]. Build a Dashboard screen showing total monthly spend and a list of subscriptions sorted by soonest next_renewal_date, and an Add Subscription screen with fields for name, cost, currency, billing_cycle (weekly/monthly/yearly/custom), next_renewal_date, category, and an is_trial toggle with a trial_end_date field that only shows when is_trial is true. Use date-fns for all date math.

Paste that in, then work screen by screen through the build order above.
