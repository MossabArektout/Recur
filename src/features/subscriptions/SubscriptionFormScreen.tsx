import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { format, isBefore, isValid, parseISO, startOfToday } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addSubscription,
  getAllSubscriptions,
  updateSubscription,
  type BillingCycle,
  type SubscriptionInput,
} from '@/data/subscriptions';
import { Fonts } from '@/constants/theme';

const TOKENS = {
  paper: '#F6F5F1',
  ink: '#1C2530',
  inkSoft: '#5A6472',
  line: '#D8D5CC',
  surfaceCard: '#FFFFFF',
  urgent: '#C4472A',
};

const BILLING_CYCLES: { label: string; value: BillingCycle }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'Custom', value: 'custom' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'MAD', 'CAD', 'AUD'];

const CATEGORIES = [
  'Streaming',
  'Software/SaaS',
  'Fitness',
  'Food/Meal Kits',
  'Gaming',
  'News/Media',
  'Other',
];

type FormErrors = Partial<
  Record<
    'name' | 'cost' | 'nextRenewalDate' | 'customCycleDays' | 'trialEndDate' | 'form',
    string
  >
>;

type DateFieldTarget = 'nextRenewalDate' | 'trialEndDate';

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd');
}

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateInput(value: string) {
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

function formatDisplayDate(value: string) {
  const date = parseDateInput(value);
  return date ? format(date, 'd MMM yyyy') : value;
}

function normalizeMoney(value: string) {
  return Number(value.replace(',', '.'));
}

export function SubscriptionFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = useMemo(() => {
    const id = normalizeParam(params.id);
    const numericId = id ? Number(id) : NaN;
    return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
  }, [params.id]);

  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [customCycleDays, setCustomCycleDays] = useState('');
  const [nextRenewalDate, setNextRenewalDate] = useState(todayIso());
  const [category, setCategory] = useState('Streaming');
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [activePicker, setActivePicker] = useState<{
    title: string;
    options: string[];
    selected: string;
    onSelect: (value: string) => void;
  } | null>(null);
  const [activeDateField, setActiveDateField] = useState<DateFieldTarget | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSubscription() {
      if (!editingId) {
        return;
      }

      try {
        const subscriptions = await getAllSubscriptions();
        const subscription = subscriptions.find((item) => item.id === editingId);

        if (!isMounted) {
          return;
        }

        if (!subscription) {
          setErrors({ form: 'Subscription was not found.' });
          return;
        }

        setName(subscription.name);
        setCost(String(subscription.cost));
        setCurrency(subscription.currency);
        setBillingCycle(subscription.billing_cycle);
        setCustomCycleDays(
          subscription.custom_cycle_days === null ? '' : String(subscription.custom_cycle_days)
        );
        setNextRenewalDate(subscription.next_renewal_date);
        setCategory(subscription.category);
        setIsTrial(subscription.is_trial);
        setTrialEndDate(subscription.trial_end_date ?? todayIso());
        setNotes(subscription.notes ?? '');
      } catch (error) {
        if (isMounted) {
          setErrors({ form: 'Subscription could not be loaded.' });
          console.error('[Recur subscription load failed]', error);
        }
      }
    }

    loadSubscription();

    return () => {
      isMounted = false;
    };
  }, [editingId]);

  function validateForm() {
    const nextErrors: FormErrors = {};
    const parsedCost = normalizeMoney(cost);
    const parsedRenewalDate = parseDateInput(nextRenewalDate);
    const parsedTrialEndDate = parseDateInput(trialEndDate);
    const parsedCustomCycleDays = Number(customCycleDays);

    if (!name.trim()) {
      nextErrors.name = 'Name is required.';
    }

    if (!Number.isFinite(parsedCost) || parsedCost <= 0) {
      nextErrors.cost = 'Cost must be greater than 0.';
    }

    if (!parsedRenewalDate) {
      nextErrors.nextRenewalDate = 'Renewal date must use YYYY-MM-DD.';
    } else if (isBefore(parsedRenewalDate, startOfToday())) {
      nextErrors.nextRenewalDate = "Renewal date can't be in the past.";
    }

    if (billingCycle === 'custom') {
      if (!Number.isInteger(parsedCustomCycleDays) || parsedCustomCycleDays <= 0) {
        nextErrors.customCycleDays = 'Custom cycle days must be greater than 0.';
      }
    }

    if (isTrial) {
      if (!parsedTrialEndDate) {
        nextErrors.trialEndDate = 'Trial end date must use YYYY-MM-DD.';
      } else if (isBefore(parsedTrialEndDate, startOfToday())) {
        nextErrors.trialEndDate = "Trial end date can't be in the past.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave() {
    setSavedMessage('');

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    const input: SubscriptionInput = {
      name: name.trim(),
      cost: normalizeMoney(cost),
      currency,
      billing_cycle: billingCycle,
      custom_cycle_days: billingCycle === 'custom' ? Number(customCycleDays) : null,
      next_renewal_date: nextRenewalDate,
      category,
      is_trial: isTrial,
      trial_end_date: isTrial ? trialEndDate : null,
      notes: notes.trim() || null,
    };

    try {
      const savedSubscription = editingId
        ? await updateSubscription(editingId, input)
        : await addSubscription(input);

      console.log('[Recur saved subscription]', savedSubscription);
      setSavedMessage('Saved to local database.');
    } catch (error) {
      setErrors({ form: 'Subscription could not be saved.' });
      console.error('[Recur subscription save failed]', error);
    } finally {
      setSaving(false);
    }
  }

  function openPicker(
    title: string,
    options: string[],
    selected: string,
    onSelect: (value: string) => void
  ) {
    setActivePicker({ title, options, selected, onSelect });
  }

  function setDateValue(field: DateFieldTarget, date: Date) {
    const value = format(date, 'yyyy-MM-dd');

    if (field === 'nextRenewalDate') {
      setNextRenewalDate(value);
    } else {
      setTrialEndDate(value);
    }
  }

  const activeDateValue =
    activeDateField === 'trialEndDate' ? trialEndDate : activeDateField ? nextRenewalDate : null;
  const activeDate = activeDateValue ? parseDateInput(activeDateValue) ?? new Date() : new Date();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              }
            }}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.title}>{editingId ? 'Edit subscription' : 'Add subscription'}</Text>
        </View>

        {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

        <Field label="Name" error={errors.name}>
          <TextInput
            autoCapitalize="words"
            onChangeText={setName}
            placeholder="Netflix"
            placeholderTextColor={TOKENS.inkSoft}
            style={styles.input}
            value={name}
          />
        </Field>

        <View style={styles.splitRow}>
          <Field label="Cost" error={errors.cost} style={styles.costField}>
            <TextInput
              inputMode="decimal"
              keyboardType="decimal-pad"
              onChangeText={setCost}
              placeholder="15.49"
              placeholderTextColor={TOKENS.inkSoft}
              style={[styles.input, styles.monoInput]}
              value={cost}
            />
          </Field>

          <Field label="Currency" style={styles.currencyField}>
            <SelectButton
              label={currency}
              onPress={() => openPicker('Currency', CURRENCIES, currency, setCurrency)}
            />
          </Field>
        </View>

        <Field label="Billing cycle" error={errors.customCycleDays}>
          <SelectButton
            label={BILLING_CYCLES.find((item) => item.value === billingCycle)?.label ?? 'Monthly'}
            onPress={() =>
              openPicker(
                'Billing cycle',
                BILLING_CYCLES.map((item) => item.label),
                BILLING_CYCLES.find((item) => item.value === billingCycle)?.label ?? 'Monthly',
                (value) => {
                  const selected = BILLING_CYCLES.find((item) => item.label === value);
                  if (selected) {
                    setBillingCycle(selected.value);
                  }
                }
              )
            }
          />
        </Field>

        {billingCycle === 'custom' ? (
          <Field label="Custom cycle days" error={errors.customCycleDays}>
            <TextInput
              inputMode="numeric"
              keyboardType="number-pad"
              onChangeText={setCustomCycleDays}
              placeholder="45"
              placeholderTextColor={TOKENS.inkSoft}
              style={[styles.input, styles.monoInput]}
              value={customCycleDays}
            />
          </Field>
        ) : null}

        <Field label="Next renewal date" error={errors.nextRenewalDate}>
          <DateButton
            label={formatDisplayDate(nextRenewalDate)}
            onPress={() => setActiveDateField('nextRenewalDate')}
          />
        </Field>

        <Field label="Category">
          <SelectButton
            label={category}
            onPress={() => openPicker('Category', CATEGORIES, category, setCategory)}
          />
        </Field>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isTrial }}
          onPress={() => setIsTrial((value) => !value)}
          style={({ pressed }) => [styles.checkboxRow, pressed && styles.pressed]}>
          <View style={[styles.checkbox, isTrial && styles.checkboxChecked]}>
            {isTrial ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>This is a free trial</Text>
        </Pressable>

        {isTrial ? (
          <Field label="Trial end date" error={errors.trialEndDate}>
            <DateButton
              label={formatDisplayDate(trialEndDate)}
              onPress={() => setActiveDateField('trialEndDate')}
            />
          </Field>
        ) : null}

        <Field label="Notes (optional)">
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholderTextColor={TOKENS.inkSoft}
            style={[styles.input, styles.notesInput]}
            textAlignVertical="top"
            value={notes}
          />
        </Field>

        {savedMessage ? <Text style={styles.savedMessage}>{savedMessage}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            saving && styles.saveButtonDisabled,
            pressed && !saving && styles.saveButtonPressed,
          ]}>
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving subscription' : 'Save subscription'}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
        transparent
        visible={activePicker !== null}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActivePicker(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{activePicker?.title}</Text>
            {activePicker?.options.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() => {
                  activePicker.onSelect(option);
                  setActivePicker(null);
                }}
                style={({ pressed }) => [
                  styles.optionRow,
                  option === activePicker.selected && styles.optionRowSelected,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.optionText,
                    option === activePicker.selected && styles.optionTextSelected,
                  ]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setActiveDateField(null)}
        transparent
        visible={activeDateField !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.dateModalCard}>
            <Text style={styles.modalTitle}>
              {activeDateField === 'trialEndDate' ? 'Trial end date' : 'Next renewal date'}
            </Text>

            {Platform.OS === 'web' ? (
              <TextInput
                autoFocus
                onChangeText={(value) => {
                  if (activeDateField === 'nextRenewalDate') {
                    setNextRenewalDate(value);
                  } else {
                    setTrialEndDate(value);
                  }
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={TOKENS.inkSoft}
                style={[styles.input, styles.monoInput]}
                value={activeDateValue ?? ''}
              />
            ) : (
              <DateTimePicker
                accentColor={TOKENS.ink}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={startOfToday()}
                mode="date"
                onDismiss={() => setActiveDateField(null)}
                onValueChange={(_, date) => {
                  if (activeDateField) {
                    setDateValue(activeDateField, date);
                  }

                  if (Platform.OS === 'android') {
                    setActiveDateField(null);
                  }
                }}
                presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
                themeVariant="light"
                value={activeDate}
              />
            )}

            <View style={styles.dateActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveDateField(null)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setActiveDateField(null)}
                style={({ pressed }) => [styles.doneButton, pressed && styles.saveButtonPressed]}>
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  children,
  error,
  label,
  style,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function SelectButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}>
      <Text style={styles.selectText}>{label}</Text>
      <Text style={styles.selectChevron}>⌄</Text>
    </Pressable>
  );
}

function DateButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}>
      <Text style={[styles.selectText, styles.monoText]}>{label}</Text>
      <Text style={styles.calendarIcon}>◷</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TOKENS.paper,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 12,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  backText: {
    color: TOKENS.ink,
    fontSize: 28,
    lineHeight: 32,
  },
  title: {
    color: TOKENS.ink,
    flex: 1,
    fontSize: 28,
    fontWeight: '600',
  },
  formError: {
    color: TOKENS.urgent,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: 8,
  },
  splitRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  costField: {
    flex: 1,
  },
  currencyField: {
    width: 116,
  },
  label: {
    color: TOKENS.ink,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: TOKENS.surfaceCard,
    borderColor: TOKENS.line,
    borderRadius: 12,
    borderWidth: 1,
    color: TOKENS.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  monoInput: {
    fontFamily: Fonts.mono,
  },
  notesInput: {
    minHeight: 96,
  },
  selectButton: {
    alignItems: 'center',
    backgroundColor: TOKENS.surfaceCard,
    borderColor: TOKENS.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  selectText: {
    color: TOKENS.ink,
    flex: 1,
    fontSize: 16,
  },
  monoText: {
    fontFamily: Fonts.mono,
  },
  selectChevron: {
    color: TOKENS.inkSoft,
    fontSize: 22,
    lineHeight: 22,
  },
  calendarIcon: {
    color: TOKENS.inkSoft,
    fontSize: 21,
    lineHeight: 22,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 44,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: TOKENS.surfaceCard,
    borderColor: TOKENS.line,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: TOKENS.ink,
    borderColor: TOKENS.ink,
  },
  checkboxMark: {
    color: TOKENS.paper,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  checkboxLabel: {
    color: TOKENS.ink,
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    color: TOKENS.urgent,
    fontSize: 13,
    lineHeight: 18,
  },
  savedMessage: {
    color: TOKENS.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: TOKENS.ink,
    borderRadius: 12,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonPressed: {
    opacity: 0.88,
  },
  saveButtonText: {
    color: TOKENS.paper,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: TOKENS.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: TOKENS.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    alignItems: 'center',
    backgroundColor: TOKENS.ink,
    borderRadius: 12,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  doneButtonText: {
    color: TOKENS.paper,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(28,37,48,0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: TOKENS.surfaceCard,
    borderColor: TOKENS.line,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 420,
    padding: 12,
    width: '100%',
  },
  dateModalCard: {
    backgroundColor: TOKENS.surfaceCard,
    borderColor: TOKENS.line,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 460,
    padding: 16,
    width: '100%',
  },
  modalTitle: {
    color: TOKENS.ink,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  optionRow: {
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionRowSelected: {
    backgroundColor: TOKENS.paper,
  },
  optionText: {
    color: TOKENS.ink,
    fontSize: 16,
  },
  optionTextSelected: {
    fontWeight: '700',
  },
  dateActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
  },
});
