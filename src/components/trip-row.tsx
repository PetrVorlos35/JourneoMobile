import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Trip } from '@/lib/api';
import {
  currentTripDay,
  daysUntilStart,
  formatTripRange,
  tripColor,
  tripDayCount,
  tripStatus,
} from '@/lib/trip';

// Řádek výletu v seznamu: barevná ikona, název, termín a stav vpravo.
export function TripRow({
  trip,
  divider,
  onPress,
}: {
  trip: Trip;
  divider?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const status = tripStatus(trip);
  const color = tripColor(trip.title);
  const days = tripDayCount(trip);
  const shared = trip.role !== 'owner';

  const note =
    status === 'ongoing'
      ? t('app.trips.dayOf', { day: currentTripDay(trip) ?? 1, total: days })
      : status === 'upcoming'
        ? t('allTrips.startsIn', { count: Math.max(daysUntilStart(trip), 1) })
        : t('app.trips.past');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
      <View
        style={[styles.icon, { backgroundColor: color.bg }, status === 'past' && styles.iconPast]}>
        <SymbolView
          name={{ ios: 'mappin.and.ellipse', android: 'location_on' }}
          size={19}
          tintColor={color.fg}
        />
      </View>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={styles.title} numberOfLines={1}>
            {trip.title}
          </Text>
          {trip.isSample && <Text style={styles.badge}>{t('guest.sample.short')}</Text>}
          {shared && (
            <SymbolView
              name={{ ios: 'person.2.fill', android: 'group' }}
              size={13}
              tintColor={Colors.textTertiary}
              accessibilityLabel={t('allTrips.shared')}
            />
          )}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {formatTripRange(trip)} · {t('allTrips.dayCount', { count: days })}
        </Text>
      </View>
      <Text
        style={[
          styles.note,
          status === 'ongoing' && styles.noteOngoing,
          status === 'upcoming' && styles.noteUpcoming,
        ]}>
        {note}
      </Text>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right' }}
        size={13}
        weight="semibold"
        tintColor={Colors.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.surface,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  pressed: { backgroundColor: Colors.background },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.small,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPast: { opacity: 0.55 },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 16, fontWeight: '500', color: Colors.text },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  sub: { fontSize: 13, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  note: { fontSize: 13, color: Colors.textTertiary },
  noteOngoing: { color: Colors.success, fontWeight: '600' },
  noteUpcoming: { color: Colors.primary, fontWeight: '600' },
});
