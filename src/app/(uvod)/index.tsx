import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  const { t } = useTranslation();

  function start() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/kam');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.brand}>
        <View style={styles.logo}>
          <SymbolView
            name={{ ios: 'safari', android: 'explore' }}
            size={18}
            weight="semibold"
            tintColor="#fff"
          />
        </View>
        <Text style={styles.brandName}>Journeo</Text>
      </Animated.View>

      <View style={styles.stage}>
        <PreviewCollage />
      </View>

      <Animated.View entering={FadeInDown.delay(450).duration(500)} style={styles.copy}>
        <Text style={styles.title}>{t('app.welcome.title')}</Text>
        <Text style={styles.subtitle}>{t('app.welcome.subtitle')}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.actions}>
        <Pressable
          onPress={start}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}>
          <Text style={styles.primaryText}>{t('app.welcome.start')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/prihlaseni')}
          hitSlop={8}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>
            {t('app.welcome.haveAccount')} ·{' '}
            <Text style={styles.secondaryLink}>{t('app.welcome.signIn')}</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

// Ukázka appky poskládaná z mini karet: odpočet, den itineráře, vyrovnání.
function PreviewCollage() {
  const { t } = useTranslation();
  const days = 12;
  return (
    <View style={styles.collage}>
      <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.tripPos}>
        <View style={[styles.card, styles.tripCard]}>
          <Text style={styles.tripEyebrow}>{t('app.welcome.preview.nextTrip')}</Text>
          <View style={styles.tripCountdown}>
            <Text style={styles.tripNumber}>{days}</Text>
            <Text style={styles.tripDays}>{t('app.welcome.preview.days', { count: days })}</Text>
          </View>
          <Text style={styles.tripTitle}>{t('app.welcome.preview.city')}</Text>
          <View style={styles.avatars}>
            {['P', 'A', 'T'].map((p, i) => (
              <View key={p} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
                <Text style={styles.avatarText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(220).duration(600)} style={styles.dayPos}>
        <View style={[styles.card, styles.dayCard]}>
          <Text style={styles.dayTitle}>{t('app.welcome.preview.day')}</Text>
          {[
            ['9:00', t('app.welcome.preview.breakfast')],
            ['11:30', t('app.welcome.preview.tram')],
            ['16:00', t('app.welcome.preview.viewpoint')],
          ].map(([time, place], i) => (
            <View key={time} style={styles.dayRow}>
              <View style={[styles.dayDot, i === 0 && styles.dayDotActive]} />
              <Text style={styles.dayTime}>{time}</Text>
              <Text style={styles.dayPlace} numberOfLines={1}>
                {place}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(340).duration(600)} style={styles.moneyPos}>
        <View style={[styles.card, styles.moneyCard]}>
          <View style={styles.moneyIcon}>
            <SymbolView
              name={{ ios: 'arrow.left.arrow.right', android: 'swap_horiz' }}
              size={14}
              weight="semibold"
              tintColor={Colors.success}
            />
          </View>
          <View>
            <Text style={styles.moneyLabel}>{t('app.welcome.preview.owes')}</Text>
            <Text style={styles.moneyValue}>{t('app.welcome.preview.amount')}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.six,
  },
  pressed: { opacity: 0.6 },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  brandName: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
  },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  collage: { width: 320, height: 300 },
  // Pozice na obalu s animací, natočení na kartě uvnitř (jinak by ho animace přepsala).
  tripPos: { position: 'absolute', left: 4, top: 18, width: 168 },
  dayPos: { position: 'absolute', right: 0, top: 92, width: 196 },
  moneyPos: { position: 'absolute', left: 28, bottom: 6 },
  card: {
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.10)',
  },

  tripCard: {
    padding: Spacing.four,
    gap: 2,
    backgroundColor: Colors.primary,
    boxShadow: '0 14px 30px rgba(21, 93, 252, 0.30)',
    transform: [{ rotate: '-5deg' }],
  },
  tripEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  tripCountdown: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  tripNumber: {
    fontFamily: Fonts.rounded,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '700',
    color: '#fff',
  },
  tripDays: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  tripTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  avatars: { flexDirection: 'row', marginTop: Spacing.two },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f86fd',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarOverlap: { marginLeft: -7 },
  avatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  dayCard: {
    padding: Spacing.four,
    gap: Spacing.two,
    transform: [{ rotate: '3deg' }],
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.separator,
  },
  dayDotActive: { backgroundColor: Colors.primary },
  dayTime: {
    width: 38,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  dayPlace: { flex: 1, fontSize: 13, color: Colors.text },

  moneyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    transform: [{ rotate: '-2deg' }],
  },
  moneyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.successSoft,
  },
  moneyLabel: { fontSize: 12, color: Colors.textSecondary },
  moneyValue: { fontSize: 16, fontWeight: '700', color: Colors.success },

  copy: { gap: Spacing.three, marginBottom: Spacing.eight },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: 17, lineHeight: 24, color: Colors.textSecondary },

  actions: { gap: Spacing.four, paddingBottom: Spacing.two },
  primary: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.primary,
  },
  primaryPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  primaryText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  secondary: { alignItems: 'center', paddingVertical: Spacing.two },
  secondaryText: { fontSize: 15, color: Colors.textSecondary },
  secondaryLink: { color: Colors.primary, fontWeight: '600' },
});
