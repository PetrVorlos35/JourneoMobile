import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NewTripOverview } from '@/components/new-trip-overview';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { budget, formatMoney, nextTrip, readiness, trips } from '@/data/demo';
import { useSession } from '@/lib/session';

type IconName = SymbolViewProps['name'];

function tap() {
  Haptics.selectionAsync();
}

export default function OverviewScreen() {
  const { t } = useTranslation();
  const { firstTrip, isGuest } = useSession();

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={tap} hitSlop={10} accessibilityLabel={t('app.overview.planTrip')}>
              <SymbolView
                name={{ ios: 'plus.circle.fill', android: 'add_circle' }}
                size={30}
                tintColor={Colors.primary}
              />
            </Pressable>
          ),
        }}
      />
      {firstTrip ? <NewTripOverview destination={firstTrip} isGuest={isGuest} /> : <DemoOverview />}
    </>
  );
}

// Přehled zkušeného uživatele (zatím ukázková data).
function DemoOverview() {
  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <NextTripCard />
      <ReadinessCard />

      <View style={styles.tiles}>
        <BudgetTile />
        <Tile
          icon={{ ios: 'arrow.left.arrow.right', android: 'swap_horiz' }}
          label="Vyrovnání"
          value="+1 240 Kč"
          sub="Dluží vám 2 lidé"
          accent={Colors.success}
        />
      </View>

      <Section title="Vaše cesty" action="Vše">
        <View style={styles.list}>
          {trips.map((trip, i) => (
            <Pressable
              key={trip.id}
              onPress={tap}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowDivider,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.rowIcon, trip.status === 'past' && styles.rowIconPast]}>
                <Text style={styles.rowEmoji}>{trip.emoji}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {trip.title}
                </Text>
                <Text style={styles.rowSub}>{trip.dates}</Text>
              </View>
              <Text style={[styles.rowNote, trip.status === 'upcoming' && styles.rowNoteSoon]}>
                {trip.note}
              </Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right' }}
                size={13}
                weight="semibold"
                tintColor={Colors.textTertiary}
              />
            </Pressable>
          ))}
        </View>
      </Section>
    </ScrollView>
  );
}

function NextTripCard() {
  return (
    <Pressable onPress={tap} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
      <View style={styles.heroTop}>
        <View style={styles.heroBadge}>
          <SymbolView
            name={{ ios: 'airplane', android: 'flight' }}
            size={13}
            tintColor={Colors.primary}
          />
          <Text style={styles.heroBadgeText}>Další cesta</Text>
        </View>
        <View style={styles.avatars}>
          {nextTrip.people.map((p, i) => (
            <View key={p} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
              <Text style={styles.avatarText}>{p}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.countdown}>
        <Text style={styles.countdownNumber}>{nextTrip.daysLeft}</Text>
        <Text style={styles.countdownLabel}>dní do odjezdu</Text>
      </View>

      <View>
        <Text style={styles.heroTitle}>{nextTrip.title}</Text>
        <Text style={styles.heroSubtitle}>{nextTrip.subtitle}</Text>
      </View>

      <View style={styles.heroMeta}>
        <Meta icon={{ ios: 'calendar', android: 'calendar_today' }} text={nextTrip.dates} />
        <Meta
          icon={{ ios: 'mappin', android: 'location_on' }}
          text={`${nextTrip.placeCount} míst`}
        />
      </View>

      <View style={styles.heroActions}>
        <HeroAction icon={{ ios: 'list.bullet', android: 'list' }} label="Itinerář" />
        <HeroAction icon={{ ios: 'map', android: 'map' }} label="Mapa" />
        <HeroAction icon={{ ios: 'creditcard', android: 'credit_card' }} label="Výdaje" />
      </View>
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.metaItem}>
      <SymbolView name={icon} size={14} tintColor="rgba(255,255,255,0.8)" />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function HeroAction({ icon, label }: { icon: IconName; label: string }) {
  return (
    <Pressable
      onPress={tap}
      style={({ pressed }) => [styles.heroAction, pressed && styles.heroActionPressed]}>
      <SymbolView name={icon} size={17} tintColor="#fff" />
      <Text style={styles.heroActionText}>{label}</Text>
    </Pressable>
  );
}

function ReadinessCard() {
  const done = readiness.filter((r) => r.done).length;
  const pct = Math.round((done / readiness.length) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Připravenost</Text>
        <Text style={styles.cardMeta}>
          hotovo {done} z {readiness.length}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.checklist}>
        {readiness.map((item) => (
          <Pressable
            key={item.key}
            onPress={tap}
            style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}>
            <View style={[styles.check, item.done ? styles.checkDone : styles.checkTodo]}>
              <SymbolView
                name={
                  item.done
                    ? { ios: 'checkmark', android: 'check' }
                    : { ios: 'circle.dotted', android: 'pending' }
                }
                size={12}
                weight="bold"
                tintColor={item.done ? Colors.success : Colors.warning}
              />
            </View>
            <Text style={styles.checkLabel}>{item.label}</Text>
            <Text style={styles.checkDetail}>{item.detail}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BudgetTile() {
  const pct = Math.round((budget.spent / budget.target) * 100);
  return (
    <Tile
      icon={{ ios: 'wallet.bifold', android: 'account_balance_wallet' }}
      label="Rozpočet"
      value={formatMoney(budget.spent, budget.currency)}
      sub={`z ${formatMoney(budget.target, budget.currency)} · ${pct} %`}
      accent={Colors.primary}>
      <View style={styles.tileTrack}>
        <View style={[styles.tileFill, { width: `${pct}%` }]} />
      </View>
    </Tile>
  );
}

type TileProps = {
  icon: IconName;
  label: string;
  value: string;
  sub: string;
  accent: string;
  children?: ReactNode;
};

function Tile({ icon, label, value, sub, accent, children }: TileProps) {
  return (
    <Pressable onPress={tap} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.tileHeader}>
        <SymbolView name={icon} size={16} tintColor={accent} />
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileSub} numberOfLines={1}>
        {sub}
      </Text>
      {children}
    </Pressable>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <Pressable onPress={tap} hitSlop={8}>
            <Text style={styles.sectionAction}>{action}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
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

  hero: {
    gap: Spacing.four,
    padding: Spacing.five,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.primary,
    boxShadow: '0 12px 28px rgba(21, 93, 252, 0.28)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: '#fff',
  },
  heroBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f86fd',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarOverlap: { marginLeft: -8 },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  countdown: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  countdownNumber: {
    fontFamily: Fonts.rounded,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  countdownLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  heroSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroMeta: { flexDirection: 'row', gap: Spacing.four },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  heroActions: { flexDirection: 'row', gap: Spacing.two },
  heroAction: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroActionPressed: { backgroundColor: 'rgba(255,255,255,0.28)' },
  heroActionText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  cardMeta: { fontSize: 14, color: Colors.textSecondary },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.separator,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  checklist: { gap: 2 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 7,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: Colors.successSoft },
  checkTodo: { backgroundColor: Colors.warningSoft },
  checkLabel: { fontSize: 15, fontWeight: '500', color: Colors.text },
  checkDetail: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: Colors.textSecondary,
  },

  tiles: { flexDirection: 'row', gap: Spacing.three },
  tile: {
    flex: 1,
    gap: 4,
    padding: Spacing.four,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tileLabel: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  tileValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  tileSub: { fontSize: 13, color: Colors.textSecondary },
  tileTrack: {
    height: 4,
    marginTop: 6,
    borderRadius: 2,
    backgroundColor: Colors.separator,
    overflow: 'hidden',
  },
  tileFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },

  section: { gap: Spacing.two, marginTop: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionAction: { fontSize: 16, color: Colors.primary },
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
  rowIconPast: { backgroundColor: Colors.background, opacity: 0.6 },
  rowEmoji: { fontSize: 20 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '500', color: Colors.text },
  rowSub: { fontSize: 13, color: Colors.textSecondary },
  rowNote: { fontSize: 13, color: Colors.textSecondary },
  rowNoteSoon: { color: Colors.primary, fontWeight: '600' },
});
