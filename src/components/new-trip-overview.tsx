import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

const NEXT_STEPS: {
  key: 'date' | 'people' | 'places' | 'packing';
  icon: SymbolViewProps['name'];
}[] = [
  { key: 'date', icon: { ios: 'calendar', android: 'calendar_today' } },
  { key: 'people', icon: { ios: 'person.2', android: 'group' } },
  { key: 'places', icon: { ios: 'mappin.and.ellipse', android: 'location_on' } },
  { key: 'packing', icon: { ios: 'checklist', android: 'checklist' } },
];

// Přehled hned po úvodu: jen čerstvě založený výlet a co s ním dál.
export function NewTripOverview({
  destination,
  isGuest,
}: {
  destination: string;
  isGuest: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      {isGuest && (
        <Pressable
          onPress={() => router.push('/prihlaseni')}
          style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'icloud.and.arrow.up', android: 'cloud_upload' }}
            size={22}
            tintColor={Colors.warning}
          />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{t('app.newTrip.bannerTitle')}</Text>
            <Text style={styles.bannerSub}>{t('app.newTrip.bannerText')}</Text>
          </View>
          <Text style={styles.bannerAction}>{t('app.newTrip.bannerAction')}</Text>
        </Pressable>
      )}

      <View style={styles.hero}>
        <View style={styles.badge}>
          <SymbolView
            name={{ ios: 'sparkles', android: 'auto_awesome' }}
            size={13}
            tintColor={Colors.primary}
          />
          <Text style={styles.badgeText}>{t('app.newTrip.badge')}</Text>
        </View>
        <Text style={styles.heroTitle}>{destination}</Text>
        <Text style={styles.heroSub}>{t('app.newTrip.noDate')}</Text>
        <Pressable
          onPress={() => Haptics.selectionAsync()}
          style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}>
          <SymbolView
            name={{ ios: 'calendar.badge.plus', android: 'edit_calendar' }}
            size={17}
            tintColor={Colors.primary}
          />
          <Text style={styles.heroButtonText}>{t('app.newTrip.addDate')}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>{t('app.newTrip.next')}</Text>
      <View style={styles.list}>
        {NEXT_STEPS.map((item, i) => (
          <Pressable
            key={item.key}
            onPress={() => Haptics.selectionAsync()}
            style={({ pressed }) => [
              styles.row,
              i > 0 && styles.rowDivider,
              pressed && styles.pressed,
            ]}>
            <View style={styles.rowIcon}>
              <SymbolView name={item.icon} size={18} tintColor={Colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{t(`app.newTrip.steps.${item.key}Title`)}</Text>
              <Text style={styles.rowSub}>{t(`app.newTrip.steps.${item.key}Text`)}</Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right' }}
              size={13}
              weight="semibold"
              tintColor={Colors.textTertiary}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.eight,
  },
  pressed: { opacity: 0.7 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.warningSoft,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  bannerSub: { fontSize: 13, color: Colors.textSecondary },
  bannerAction: { fontSize: 15, fontWeight: '600', color: Colors.primary },

  hero: {
    gap: Spacing.one,
    padding: Spacing.five,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.primary,
    boxShadow: '0 12px 28px rgba(21, 93, 252, 0.28)',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: '#fff',
    marginBottom: Spacing.three,
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroSub: { fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 48,
    marginTop: Spacing.four,
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: '#fff',
  },
  heroButtonPressed: { opacity: 0.85 },
  heroButtonText: { fontSize: 16, fontWeight: '600', color: Colors.primary },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  list: {
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.small,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '500', color: Colors.text },
  rowSub: { fontSize: 13, color: Colors.textSecondary },
});
