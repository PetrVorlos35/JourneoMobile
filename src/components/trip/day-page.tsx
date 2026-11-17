import { parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Activity } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { placeArea, useGeoSuggestions } from '@/lib/geo';

type Props = {
  day: Activity;
  index: number;
  days: Activity[];
  readOnly: boolean;
  onChange: (patch: Partial<Activity>) => void;
  onNavigate: (index: number) => void;
  // Uživatel začal psát do stránky (detail pak posouvá obsah nad klávesnici).
  onFocusInput: () => void;
};

// Stránka jednoho dne (DayPage na webu): název, místo, plán a přechod na sousední dny.
export function DayPage({ day, index, days, readOnly, onChange, onNavigate, onFocusInput }: Props) {
  const { t } = useTranslation();
  const n = index + 1;
  const date = parseISO(day.date);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        {readOnly ? (
          <Text style={styles.title}>
            {day.title || t('tripDetail.notebook.dayTitlePlaceholder', { n })}
          </Text>
        ) : (
          <TextInput
            value={day.title}
            onChangeText={(title) => onChange({ title })}
            maxLength={255}
            placeholder={t('tripDetail.notebook.dayTitlePlaceholder', { n })}
            placeholderTextColor={Colors.textTertiary}
            accessibilityLabel={t('tripDetail.notebook.dayTitleAria')}
            onFocus={onFocusInput}
            returnKeyType="done"
            style={[styles.title, styles.titleInput]}
          />
        )}
        <Text style={styles.meta}>
          {t('tripDetail.notebook.dayOf', { n, total: days.length })} ·{' '}
          {formatDate(date, 'EEEE d. MMMM')}
        </Text>
      </View>

      <LocationField
        value={day.location}
        readOnly={readOnly}
        onChange={(location) => onChange({ location })}
        onFocus={onFocusInput}
      />

      {readOnly ? (
        <Text style={[styles.plan, !day.plan && styles.planEmpty]}>
          {day.plan || t('tripDetail.itinerary.planPlaceholder')}
        </Text>
      ) : (
        <TextInput
          value={day.plan}
          onChangeText={(plan) => onChange({ plan })}
          maxLength={2000}
          multiline
          scrollEnabled={false}
          placeholder={t('tripDetail.itinerary.planPlaceholder')}
          placeholderTextColor={Colors.textTertiary}
          accessibilityLabel={t('tripDetail.notebook.planAria')}
          onFocus={onFocusInput}
          textAlignVertical="top"
          style={[styles.plan, styles.planInput]}
        />
      )}
      {!readOnly && day.plan.length >= 1600 && (
        <Text style={styles.count}>{day.plan.length} / 2000</Text>
      )}

      <View style={styles.footer}>
        <DayNavButton
          day={days[index - 1]}
          direction="prev"
          label={t('tripDetail.notebook.prevDay')}
          onPress={() => onNavigate(index - 1)}
        />
        <DayNavButton
          day={days[index + 1]}
          direction="next"
          label={t('tripDetail.notebook.nextDay')}
          onPress={() => onNavigate(index + 1)}
        />
      </View>
    </View>
  );
}

// Místo dne s našeptávačem. Ukládá se jen text, stejně jako na webu.
function LocationField({
  value,
  readOnly,
  onChange,
  onFocus,
}: {
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  // Po výběru návrhu se dál nenašeptává, dokud uživatel text nezmění.
  const [picked, setPicked] = useState<string | null>(null);
  const { results } = useGeoSuggestions(value, !readOnly && focused && value !== picked);

  return (
    <View>
      <View style={[styles.location, focused && styles.locationFocused]}>
        <SymbolView
          name={{ ios: 'mappin.and.ellipse', android: 'location_on' }}
          size={18}
          tintColor={Colors.primary}
        />
        {readOnly ? (
          <Text style={[styles.locationText, !value && styles.planEmpty]} numberOfLines={1}>
            {value || t('tripDetail.itinerary.noLocation')}
          </Text>
        ) : (
          <TextInput
            value={value}
            onChangeText={(text) => onChange(text.slice(0, 255))}
            onFocus={() => {
              setFocused(true);
              onFocus();
            }}
            onBlur={() => setFocused(false)}
            placeholder={t('tripDetail.itinerary.locationPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            accessibilityLabel={t('tripDetail.notebook.locationAria')}
            autoCorrect={false}
            returnKeyType="done"
            style={styles.locationText}
          />
        )}
      </View>

      {results.length > 0 && (
        <View style={styles.results}>
          {results.slice(0, 5).map((result, i) => (
            <Pressable
              key={`${result.lat},${result.lng}`}
              onPress={() => {
                Haptics.selectionAsync();
                const text = result.name.slice(0, 255);
                setPicked(text);
                onChange(text);
                Keyboard.dismiss();
              }}
              style={({ pressed }) => [
                styles.result,
                i > 0 && styles.resultDivider,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.resultName} numberOfLines={1}>
                {result.name}
              </Text>
              {placeArea(result) ? (
                <Text style={styles.resultArea} numberOfLines={1}>
                  {placeArea(result)}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function DayNavButton({
  day,
  direction,
  label,
  onPress,
}: {
  day: Activity | undefined;
  direction: 'prev' | 'next';
  label: string;
  onPress: () => void;
}) {
  if (!day) return <View style={styles.navSpacer} />;
  const next = direction === 'next';
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityLabel={`${label}: ${day.title}`}
      style={({ pressed }) => [styles.nav, next && styles.navNext, pressed && styles.pressed]}>
      <SymbolView
        name={
          next
            ? { ios: 'chevron.right', android: 'chevron_right' }
            : { ios: 'chevron.left', android: 'chevron_left' }
        }
        size={14}
        weight="semibold"
        tintColor={Colors.textTertiary}
      />
      <View style={[styles.navText, next && styles.navTextNext]}>
        <Text style={styles.navDate}>{formatDate(parseISO(day.date), 'EEEEEE d. M.')}</Text>
        <Text style={styles.navTitle} numberOfLines={1}>
          {day.title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.large,
    padding: Spacing.five,
    gap: Spacing.four,
  },
  header: { gap: Spacing.one },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, color: Colors.text },
  titleInput: { padding: 0 },
  meta: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  locationFocused: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  locationText: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text, paddingVertical: 12 },
  results: {
    marginTop: Spacing.two,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    overflow: 'hidden',
  },
  result: { paddingHorizontal: Spacing.three, paddingVertical: 10, backgroundColor: Colors.surface },
  resultDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  resultName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  resultArea: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  plan: { fontSize: 16, lineHeight: 24, color: Colors.text, minHeight: 200 },
  planInput: { padding: 0 },
  planEmpty: { color: Colors.textTertiary },
  count: { alignSelf: 'flex-end', fontSize: 12, color: Colors.textTertiary, marginTop: -Spacing.two },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, maxWidth: '48%', paddingVertical: 6 },
  navNext: { flexDirection: 'row-reverse' },
  navSpacer: { flex: 1 },
  navText: { minWidth: 0, flexShrink: 1 },
  navTextNext: { alignItems: 'flex-end' },
  navDate: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },
  navTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  pressed: { opacity: 0.6 },
});
