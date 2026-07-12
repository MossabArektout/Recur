import { differenceInCalendarDays, format, isValid, parseISO, startOfToday } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { getAllSubscriptions, getMonthlyCost, type Subscription } from '@/data/subscriptions';

const TOKENS = {
  paper: '#F6F5F1',
  ink: '#1C2530',
  inkSoft: '#5A6472',
  line: '#D8D5CC',
  accentSafe: '#4F7A68',
  accentUpcoming: '#C98A2E',
  accentUrgent: '#C4472A',
  surfaceCard: '#FFFFFF',
};

type LoadState = 'idle' | 'loading' | 'refreshing';

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = parseISO(value);
  return isValid(date) ? date : null;
}

function daysUntil(value: string | null) {
  const date = parseDate(value);
  return date ? differenceInCalendarDays(date, startOfToday()) : null;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(amount);
}

function formatDaysLabel(prefix: string, days: number | null) {
  if (days === null) {
    return `${prefix} date unknown`;
  }

  if (days < 0) {
    return `${prefix} ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago`;
  }

  if (days === 0) {
    return `${prefix} today`;
  }

  if (days === 1) {
    return `${prefix} tomorrow`;
  }

  return `${prefix} in ${days} days`;
}

function getStatus(subscription: Subscription) {
  const trialDays = subscription.is_trial ? daysUntil(subscription.trial_end_date) : null;
  const renewalDays = daysUntil(subscription.next_renewal_date);
  const activeDays = subscription.is_trial && trialDays !== null ? trialDays : renewalDays;

  if (
    (subscription.is_trial && trialDays !== null && trialDays <= 3) ||
    (renewalDays !== null && renewalDays <= 2)
  ) {
    return { color: TOKENS.accentUrgent, days: activeDays };
  }

  if (renewalDays !== null && renewalDays <= 7) {
    return { color: TOKENS.accentUpcoming, days: activeDays };
  }

  return { color: TOKENS.accentSafe, days: activeDays };
}

function getRenewalDateLabel(subscription: Subscription) {
  const date = parseDate(subscription.next_renewal_date);
  return date ? format(date, 'd MMM yyyy') : subscription.next_renewal_date;
}

export function DashboardScreen() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [error, setError] = useState('');

  const loadSubscriptions = useCallback(async (state: LoadState = 'loading') => {
    setLoadState(state);
    setError('');

    try {
      setSubscriptions(await getAllSubscriptions());
    } catch (loadError) {
      setError('Subscriptions could not be loaded.');
      console.error('[Recur dashboard load failed]', loadError);
    } finally {
      setLoadState('idle');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
    }, [loadSubscriptions])
  );

  const totals = useMemo(() => {
    const monthly = subscriptions.reduce(
      (total, subscription) => total + getMonthlyCost(subscription),
      0
    );

    return {
      currency: subscriptions[0]?.currency ?? 'USD',
      monthly,
      yearly: monthly * 12,
    };
  }, [subscriptions]);

  const hasSubscriptions = subscriptions.length > 0;
  const isInitialLoading = loadState === 'loading' && !hasSubscriptions;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => loadSubscriptions('refreshing')}
            refreshing={loadState === 'refreshing'}
            tintColor={TOKENS.ink}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>RECUR</Text>
          <Pressable accessibilityRole="button" hitSlop={12} style={styles.settingsButton}>
            <Text style={styles.settingsText}>⚙︎</Text>
          </Pressable>
        </View>

        <View style={styles.receiptCard}>
          <View style={styles.perforationTop} />
          <Text style={styles.eyebrow}>YOU&apos;RE SPENDING</Text>
          <Text style={styles.totalFigure}>
            {formatCurrency(totals.monthly, totals.currency)} / month
          </Text>
          <Text style={styles.yearlyFigure}>
            {formatCurrency(totals.yearly, totals.currency)} / year
          </Text>
          <View style={styles.perforationBottom} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>UPCOMING</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isInitialLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={TOKENS.ink} />
          </View>
        ) : hasSubscriptions ? (
          <View style={styles.receiptList}>
            {subscriptions.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                onPress={() =>
                  router.push({
                    pathname: './subscription-form',
                    params: { id: String(subscription.id) },
                  })
                }
                subscription={subscription}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing tracked yet</Text>
            <Text style={styles.emptyCopy}>
              Add your first subscription to see what you&apos;re really spending.
            </Text>
          </View>
        )}
      </ScrollView>

      <Pressable
        accessibilityLabel="Add subscription"
        accessibilityRole="button"
        onPress={() => router.push('./subscription-form')}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function SubscriptionRow({
  onPress,
  subscription,
}: {
  onPress: () => void;
  subscription: Subscription;
}) {
  const status = getStatus(subscription);
  const amount = formatCurrency(subscription.cost, subscription.currency);
  const label = subscription.is_trial
    ? formatDaysLabel('trial ends', daysUntil(subscription.trial_end_date))
    : formatDaysLabel('renews', daysUntil(subscription.next_renewal_date));
  const displayName = subscription.is_trial ? `${subscription.name} (trial)` : subscription.name;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowTop}>
        <Text numberOfLines={1} style={styles.subscriptionName}>
          {displayName}
        </Text>
        <Text style={styles.subscriptionAmount}>{amount}</Text>
        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
      </View>
      <View style={styles.rowBottom}>
        <Text style={styles.renewalLabel}>{label}</Text>
        <Text style={styles.renewalDate}>{getRenewalDateLabel(subscription)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: TOKENS.paper,
    flex: 1,
  },
  content: {
    paddingBottom: 112,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  brand: {
    color: TOKENS.ink,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0,
  },
  settingsButton: {
    alignItems: 'center',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  settingsText: {
    color: TOKENS.ink,
    fontSize: 25,
    lineHeight: 28,
  },
  receiptCard: {
    backgroundColor: TOKENS.surfaceCard,
    borderColor: TOKENS.line,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginBottom: 32,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#000000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  perforationTop: {
    borderColor: TOKENS.line,
    borderStyle: 'dashed',
    borderTopWidth: 1,
    marginBottom: 18,
  },
  perforationBottom: {
    borderColor: TOKENS.line,
    borderStyle: 'dashed',
    borderTopWidth: 1,
    marginTop: 18,
  },
  eyebrow: {
    color: TOKENS.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  totalFigure: {
    color: TOKENS.ink,
    fontFamily: Fonts.mono,
    fontSize: 34,
    fontWeight: '600',
    lineHeight: 42,
  },
  yearlyFigure: {
    color: TOKENS.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 16,
    lineHeight: 24,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionLabel: {
    color: TOKENS.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  errorText: {
    color: TOKENS.accentUrgent,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  loadingState: {
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
  },
  receiptList: {
    borderColor: TOKENS.line,
    borderStyle: 'dashed',
    borderTopWidth: 1,
  },
  row: {
    borderBottomColor: TOKENS.line,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    minHeight: 76,
    paddingVertical: 14,
  },
  rowTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  subscriptionName: {
    color: TOKENS.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  subscriptionAmount: {
    color: TOKENS.ink,
    fontFamily: Fonts.mono,
    fontSize: 16,
    lineHeight: 22,
  },
  statusDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  rowBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  renewalLabel: {
    color: TOKENS.inkSoft,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  renewalDate: {
    color: TOKENS.inkSoft,
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 12,
  },
  emptyState: {
    backgroundColor: TOKENS.surfaceCard,
    borderColor: TOKENS.line,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: '#000000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  emptyTitle: {
    color: TOKENS.ink,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 6,
  },
  emptyCopy: {
    color: TOKENS.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: TOKENS.ink,
    borderRadius: 12,
    bottom: 28,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    width: 56,
  },
  fabText: {
    color: TOKENS.paper,
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 38,
  },
  pressed: {
    opacity: 0.72,
  },
});
