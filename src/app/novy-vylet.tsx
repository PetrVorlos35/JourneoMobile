import { differenceInCalendarDays, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/auth/ui';
import { RangeCalendar } from '@/components/range-calendar';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ApiError, geoApi, placesApi, tripsApi, type GeoPlace, type Trip } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { currentLanguage } from '@/lib/i18n';
import { openTrip, showGuestLimit } from '@/lib/new-trip';
import { useSession } from '@/lib/session';
import { reportError } from '@/lib/telemetry';
import {
  buildStarterDays,
  buildStarterPacking,
  MAX_TRIP_DAYS,
  MIN_TRIP_DATE,
  ownTrips,
  QUICK_DATES,
  quickDateRange,
  TRIP_TYPES,
  type QuickDate,
  type TripType,
} from '@/lib/trip';
import { useTrips } from '@/lib/trips';

type Step = 'trip' | 'days' | 'packing' | 'map';
type DateKey = QuickDate | 'custom';

const TYPE_ICONS: Record<TripType, SymbolViewProps['name']> = {
  city: { ios: 'building.2', android: 'location_city' },
  mountains: { ios: 'mountain.2', android: 'landscape' },
  sea: { ios: 'water.waves', android: 'waves' },
  roadtrip: { ios: 'car', android: 'directions_car' },
};

// Kroky mají krátké minimum, ať je průběh vidět, i když server odpoví hned.
const beat = () => new Promise((resolve) => setTimeout(resolve, 350));

// Zakládání výletu jako TripComposer na webu: kam → kdy → typ. Výlet vznikne rovnou
// vyplněný (dny, balení podle typu, místo na mapě) a otevře se jeho detail.
export default function NewTripScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { plan } = useLocalSearchParams<{ plan?: string }>();
  const { clearPlannedDestination } = useSession();
  const { trips, upsertTrip } = useTrips();
  const isFirst = ownTrips(trips ?? []).length === 0;

  const [destination, setDestination] = useState((plan ?? '').slice(0, 255));
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [dateKey, setDateKey] = useState<DateKey | null>(null);
  const [custom, setCustom] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null,
  });
  const [type, setType] = useState<TripType | null>(null);
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [doneSteps, setDoneSteps] = useState<Step[]>([]);

  const name = destination.trim();
  const hasDestination = name.length >= 2;
  const range =
    dateKey === 'custom'
      ? custom.startDate && custom.endDate
        ? { startDate: custom.startDate, endDate: custom.endDate }
        : null
      : dateKey
        ? quickDateRange(dateKey)
        : null;
  const dayCount = range
    ? differenceInCalendarDays(parseISO(range.endDate), parseISO(range.startDate)) + 1
    : 0;
  const rangeValid = dayCount >= 1 && dayCount <= MAX_TRIP_DAYS;
  const canSubmit = hasDestination && rangeValid && status !== 'creating';

  async function create() {
    if (!canSubmit || !range) return;
    setStatus('creating');
    setErrorText(null);
    setDoneSteps([]);
    const done = (step: Step) => setDoneSteps((prev) => [...prev, step]);

    let created: Trip | null = null;
    try {
      [{ trip: created }] = await Promise.all([
        tripsApi.create({ title: name, startDate: range.startDate, endDate: range.endDate }),
        beat(),
      ]);
      done('trip');

      const activities = buildStarterDays(t, range.startDate, range.endDate, name);
      await beat();
      done('days');

      // Balení jen se zvoleným typem, jinak si ho uživatel napíše sám.
      const packingList = type ? buildStarterPacking(t, type) : [];
      const [{ trip: filled }] = await Promise.all([
        tripsApi.update(created.id, { activities, packingList, version: created.version }),
        beat(),
      ]);
      created = filled;
      if (type) done('packing');

      if (place) {
        // Místo k prvnímu dni jako z itineráře, ať ho pozdější import nezaloží podruhé.
        // Bez mapy se výlet obejde.
        await Promise.all([
          placesApi
            .create({ ...place, tripId: filled.id, dayIndex: 0, source: 'itinerary' })
            .catch(reportError),
          beat(),
        ]);
        done('map');
      }
      await beat();
      finish(filled);
    } catch (err) {
      // Výlet už existuje, jen se ho nepovedlo vyplnit: pustit dovnitř, ať druhý pokus
      // nezaloží duplikát.
      if (created) {
        reportError(err);
        finish(created);
        return;
      }
      if (err instanceof ApiError && err.code === 'GUEST_TRIP_LIMIT') {
        setStatus('idle');
        showGuestLimit();
        return;
      }
      if (!(err instanceof ApiError)) reportError(err);
      setStatus('error');
      setErrorText(err instanceof ApiError ? err.message : t('onboarding.error'));
    }
  }

  function finish(trip: Trip) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    upsertTrip(trip);
    clearPlannedDestination();
    router.back();
    openTrip(trip.id);
  }

  const steps: { id: Step; label: string }[] = [
    { id: 'trip', label: t('onboarding.progress.trip') },
    { id: 'days', label: t('onboarding.progress.days', { count: dayCount }) },
    ...(type ? [{ id: 'packing' as const, label: t('onboarding.progress.packing') }] : []),
    ...(place ? [{ id: 'map' as const, label: t('onboarding.progress.map', { place: name }) }] : []),
  ];

  if (status === 'creating') {
    return (
      <View style={[styles.screen, styles.progress]} accessibilityLiveRegion="polite">
        <Text style={styles.title}>{t('onboarding.progress.title', { place: name })}</Text>
        <View style={styles.steps}>
          {steps.map((step, i) => {
            const isDone = doneSteps.includes(step.id);
            const active = !isDone && steps.slice(0, i).every((s) => doneSteps.includes(s.id));
            return (
              <View key={step.id} style={styles.stepRow}>
                <View style={[styles.stepDot, isDone && styles.stepDotDone]}>
                  {isDone ? (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check' }}
                      size={14}
                      weight="bold"
                      tintColor={Colors.success}
                    />
                  ) : active ? (
                    <ActivityIndicator size="small" color={Colors.textSecondary} />
                  ) : (
                    <View style={styles.stepPending} />
                  )}
                </View>
                <Text style={[styles.stepText, !isDone && !active && styles.stepTextMuted]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('app.newTrip.close')}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close' }}
            size={15}
            weight="bold"
            tintColor={Colors.textSecondary}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>{t('onboarding.newEyebrow')}</Text>
        <Text style={styles.title}>
          {t(isFirst ? 'onboarding.title' : 'onboarding.newTitle')}
        </Text>

        <DestinationField
          value={destination}
          place={place}
          autoFocus={!plan}
          onChange={(text, selected) => {
            setDestination(text);
            setPlace(selected);
          }}
        />

        {hasDestination && (
          <>
            <Text style={styles.label}>{t('onboarding.whenLabel')}</Text>
            <View style={styles.chips}>
              {QUICK_DATES.map((key) => (
                <Chip
                  key={key}
                  label={t(`onboarding.dates.${key}`)}
                  active={dateKey === key}
                  onPress={() => setDateKey(key)}
                />
              ))}
              <Chip
                label={t('onboarding.dates.custom')}
                icon={{ ios: 'calendar', android: 'calendar_today' }}
                active={dateKey === 'custom'}
                onPress={() => setDateKey('custom')}
              />
            </View>

            {dateKey === 'custom' && (
              <View style={styles.calendar}>
                <RangeCalendar
                  startDate={custom.startDate}
                  endDate={custom.endDate}
                  minDate={MIN_TRIP_DATE}
                  maxDays={MAX_TRIP_DAYS}
                  onChange={setCustom}
                />
              </View>
            )}

            {dateKey === 'custom' && !range && (
              <Text style={styles.rangeText}>
                {custom.startDate
                  ? `${formatDay(custom.startDate)} – … · ${t('app.newTrip.pickEnd')}`
                  : t('app.newTrip.pickStart')}
              </Text>
            )}

            {range && (
              <Text style={[styles.rangeText, !rangeValid && styles.rangeInvalid]}>
                {rangeValid
                  ? `${formatDay(range.startDate)} – ${formatDay(range.endDate)} · ${t('onboarding.dayCount', { count: dayCount })}`
                  : t('onboarding.dates.tooLong', { max: MAX_TRIP_DAYS })}
              </Text>
            )}

            <Text style={styles.label}>{t('onboarding.typeLabel')}</Text>
            <View style={styles.chips}>
              <Chip
                label={t('onboarding.types.own')}
                icon={{ ios: 'pencil', android: 'edit' }}
                active={type === null}
                onPress={() => setType(null)}
              />
              {TRIP_TYPES.map((key) => (
                <Chip
                  key={key}
                  label={t(`onboarding.types.${key}`)}
                  icon={TYPE_ICONS[key]}
                  active={type === key}
                  onPress={() => setType(key)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
        <Text style={[styles.hint, status === 'error' && styles.rangeInvalid]}>
          {status === 'error'
            ? errorText
            : !hasDestination
              ? t('onboarding.subtitle')
              : rangeValid
                ? t('onboarding.changeLater')
                : t('onboarding.pickDates')}
        </Text>
        <PrimaryButton label={t('onboarding.submit')} onPress={create} disabled={!canSubmit} />
      </View>
    </KeyboardAvoidingView>
  );
}

// Pole „Kam jedeš“ s našeptávačem míst (GET /geo/search). Výběr z návrhů uloží
// i souřadnice, aby šlo místo připíchnout na mapu.
function DestinationField({
  value,
  place,
  autoFocus,
  onChange,
}: {
  value: string;
  place: GeoPlace | null;
  autoFocus: boolean;
  onChange: (text: string, place: GeoPlace | null) => void;
}) {
  const { t } = useTranslation();
  const [found, setFound] = useState<GeoPlace[]>([]);
  const [failed, setFailed] = useState(false);
  const query = value.trim();
  const searching = !place && query.length >= 3;
  // Po výběru místa nebo smazání textu návrhy schováme, poslední výsledek ale zůstane
  // uložený, ať při dalším psaní neproblikne prázdný seznam.
  const results = searching ? found : [];
  const requestId = useRef(0);

  useEffect(() => {
    if (!searching) return;
    const id = ++requestId.current;
    // Server se ptá Nominatimu (max 1 dotaz za sekundu), tak počkáme, až se dopíše.
    const timer = setTimeout(async () => {
      try {
        const { results } = await geoApi.search(query, currentLanguage());
        if (id === requestId.current) {
          setFound(results);
          setFailed(false);
        }
      } catch {
        if (id === requestId.current) setFailed(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, searching]);

  const area = (p: GeoPlace) => (p.address ?? '').split(', ').slice(1).join(', ');

  return (
    <View style={styles.destination}>
      <View style={styles.field}>
        <SymbolView
          name={{ ios: 'mappin.and.ellipse', android: 'location_on' }}
          size={20}
          tintColor={Colors.primary}
        />
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.slice(0, 255), null)}
          placeholder={t('onboarding.destinationPlaceholder')}
          placeholderTextColor={Colors.textTertiary}
          style={styles.input}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={t('onboarding.destinationLabel')}
        />
        {value.length > 0 && (
          <Pressable
            onPress={() => onChange('', null)}
            hitSlop={10}
            accessibilityLabel={t('app.common.clear')}>
            <SymbolView
              name={{ ios: 'xmark.circle.fill', android: 'cancel' }}
              size={18}
              tintColor={Colors.textTertiary}
            />
          </Pressable>
        )}
      </View>

      {results.length > 0 && (
        <View style={styles.results}>
          {results.map((result, i) => (
            <Pressable
              key={`${result.lat},${result.lng}`}
              onPress={() => {
                Haptics.selectionAsync();
                // Místo je vybrané, dál se už nepíše.
                Keyboard.dismiss();
                onChange(result.name, result);
              }}
              style={({ pressed }) => [
                styles.result,
                i > 0 && styles.resultDivider,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.resultName} numberOfLines={1}>
                {result.name}
              </Text>
              {area(result) ? (
                <Text style={styles.resultArea} numberOfLines={1}>
                  {area(result)}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      {place ? (
        <View style={styles.pinned}>
          <SymbolView
            name={{ ios: 'mappin.circle.fill', android: 'location_on' }}
            size={16}
            tintColor={Colors.success}
          />
          <Text style={styles.pinnedText} numberOfLines={1}>
            {t('app.newTrip.placePinned')}
            {area(place) ? ` · ${area(place)}` : ''}
          </Text>
        </View>
      ) : failed ? (
        <Text style={styles.fieldHint}>{t('app.newTrip.searchFailed')}</Text>
      ) : query.length >= 3 && results.length === 0 ? null : (
        <Text style={styles.fieldHint}>{t('app.newTrip.pickPlace')}</Text>
      )}
    </View>
  );
}

function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: SymbolViewProps['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      {icon && (
        <SymbolView name={icon} size={15} tintColor={active ? Colors.primary : Colors.textSecondary} />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: Colors.background },
  pressed: { opacity: 0.6 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.separator,
  },
  content: { paddingHorizontal: Spacing.five, paddingTop: Spacing.two, paddingBottom: Spacing.six },

  eyebrow: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.6,
    marginTop: Spacing.one,
    marginBottom: Spacing.five,
  },

  destination: { gap: Spacing.two },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: 58,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: Colors.text, height: '100%' },
  fieldHint: { fontSize: 13, color: Colors.textSecondary, paddingHorizontal: Spacing.one },
  results: {
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  result: { gap: 2, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  resultDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  resultName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  resultArea: { fontSize: 13, color: Colors.textSecondary },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.one },
  pinnedText: { flex: 1, fontSize: 13, fontWeight: '500', color: Colors.success },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: Spacing.six,
    marginBottom: Spacing.three,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipText: { fontSize: 15, color: Colors.text },
  chipTextActive: { color: Colors.primary, fontWeight: '600' },

  calendar: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    paddingTop: Spacing.four,
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  rangeText: {
    marginTop: Spacing.three,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rangeInvalid: { color: Colors.danger },

  footer: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    backgroundColor: Colors.background,
  },
  hint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  progress: { justifyContent: 'center', paddingHorizontal: Spacing.six },
  steps: { gap: Spacing.four },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.separator,
  },
  stepDotDone: { backgroundColor: Colors.successSoft },
  stepPending: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textTertiary },
  stepText: { flex: 1, fontSize: 16, fontWeight: '500', color: Colors.text },
  stepTextMuted: { color: Colors.textTertiary },
});
