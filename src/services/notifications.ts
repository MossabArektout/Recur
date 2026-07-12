import {
  isAfter,
  parseISO,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  subDays,
} from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Subscription } from '@/data/subscriptions';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const NOTIFICATION_CHANNEL_ID = 'recur-reminders';

export type ScheduledSubscriptionNotificationIds = Pick<
  Subscription,
  'renewal_notification_id' | 'trial_notification_id'
>;

export async function requestNotificationPermissions() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Subscription reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existingPermissions = await Notifications.getPermissionsAsync();

    if (existingPermissions.granted) {
      return true;
    }

    if (!existingPermissions.canAskAgain) {
      console.log('[Recur notifications] Permission denied; skipping notification scheduling.');
      return false;
    }

    const requestedPermissions = await Notifications.requestPermissionsAsync();

    if (!requestedPermissions.granted) {
      console.log('[Recur notifications] Permission denied; skipping notification scheduling.');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Recur notifications] Permission request failed.', error);
    return false;
  }
}

export async function cancelSubscriptionNotifications(
  subscription: Pick<Subscription, 'renewal_notification_id' | 'trial_notification_id'>
) {
  await cancelNotificationIfPresent(subscription.renewal_notification_id);
  await cancelNotificationIfPresent(subscription.trial_notification_id);
}

export async function scheduleSubscriptionNotifications(
  subscription: Subscription,
  reminderLeadDays: number
): Promise<ScheduledSubscriptionNotificationIds> {
  const canSchedule = await requestNotificationPermissions();

  if (!canSchedule) {
    return {
      renewal_notification_id: null,
      trial_notification_id: null,
    };
  }

  let renewalNotificationId: string | null = null;
  let trialNotificationId: string | null = null;

  try {
    renewalNotificationId = await scheduleRenewalNotification(subscription, reminderLeadDays);
    trialNotificationId = subscription.is_trial ? await scheduleTrialNotification(subscription) : null;

    return {
      renewal_notification_id: renewalNotificationId,
      trial_notification_id: trialNotificationId,
    };
  } catch (error) {
    console.error('[Recur notifications] Failed to schedule subscription notifications.', error);
    await cancelNotificationIfPresent(renewalNotificationId);
    await cancelNotificationIfPresent(trialNotificationId);

    return {
      renewal_notification_id: null,
      trial_notification_id: null,
    };
  }
}

export async function scheduleDevTestNotification() {
  const canSchedule = await requestNotificationPermissions();

  if (!canSchedule) {
    return null;
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recur test notification',
      body: 'This is your 10-second notification test.',
      data: { source: 'recur-dev-test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 10,
    },
  });

  console.log('[Recur notifications] Scheduled 10-second test notification', identifier);
  return identifier;
}

async function scheduleRenewalNotification(subscription: Subscription, reminderLeadDays: number) {
  const renewalDate = getReminderDate(subscription.next_renewal_date, reminderLeadDays);

  if (!renewalDate) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: subscription.name,
      body: `Renews in ${reminderLeadDays} days — ${formatSubscriptionCost(subscription)}`,
      data: {
        subscriptionId: subscription.id,
        type: 'renewal',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: renewalDate,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
}

async function scheduleTrialNotification(subscription: Subscription) {
  const trialReminderDate = getReminderDate(subscription.trial_end_date, 1);

  if (!trialReminderDate) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: subscription.name,
      body: `Trial ends tomorrow — you'll be charged ${formatSubscriptionCost(subscription)}`,
      data: {
        subscriptionId: subscription.id,
        type: 'trial',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trialReminderDate,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
}

async function cancelNotificationIfPresent(identifier: string | null) {
  if (!identifier) {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('[Recur notifications] Failed to cancel notification.', error);
  }
}

function getReminderDate(dateValue: string | null, leadDays: number) {
  if (!dateValue) {
    return null;
  }

  const date = parseISO(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const reminderDate = setMilliseconds(
    setSeconds(setMinutes(setHours(subDays(date, leadDays), 9), 0), 0),
    0
  );

  if (!isAfter(reminderDate, new Date())) {
    return null;
  }

  return reminderDate;
}

function formatSubscriptionCost(subscription: Pick<Subscription, 'cost' | 'currency'>) {
  return new Intl.NumberFormat('en-US', {
    currency: subscription.currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(subscription.cost);
}
