import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import type { TFunction } from 'i18next';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TripRow } from '@/components/trip-row';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { placesApi, tripsApi, type Place, type Trip } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { openNewTrip, openTrip } from '@/lib/new-trip';
import { useSession } from '@/lib/session';
import {
  computeReadiness,
  currentTripDay,
  daysUntilStart,
  formatTripRange,
  ownTrips,
  tripDayCount,
  tripSpend,
  tripStatus,
  type ReadinessItem,
} from '@/lib/trip';
import { useTrips } from '@/lib/trips';
import { useApi } from '@/lib/use-api';

type IconName = SymbolViewProps['name'];
type HeroState = 'ongoing' | 'upcoming' | 'past';

// Přehled ukáže nejvýš tolik výletů, celý seznam s hledáním je v tabu Výlety.
const MAX_TRIPS = 6;

export default function OverviewScreen() {
  const { t } = useTranslation();
  const { user, isGuest, plannedDestination, clearPlannedDestination } = useSession();
  const { trips, loading, refreshing, error, reload, refresh } = useTrips();

  // Vedlejší data pro dlaždice. Když selžou, ukáže se jen pomlčka, přehled zůstane.
  const places = useApi(user ? `places:${user.id}` : null, async () => (await placesApi.list()).places);
  const balances = useApi(user ? `balances:${user.id}` : null, tripsApi.balancesSummary);

  const hasOwnTrips = !!trips && ownTrips(trips).length > 0;

  // Destinace z úvodu („Kam jedeš?“): jednou otevřít zakládání s předvyplněným místem.
  // Kdo ho zavře, uvidí místo něj výzvu k prvnímu výletu, ne nové otevírání při každém startu.
  const openedPlan = useRef(false);
  useEffect(() => {
    if (!trips || !plannedDestination || openedPlan.current) return;
    openedPlan.current = true;
    if (!hasOwnTrips) openNewTrip(isGuest, trips, plannedDestination);
    clearPlannedDestination();
  }, [trips, hasOwnTrips, plannedDestination, isGuest, clearPlannedDestination]);

  function onRefresh() {
    refresh();
    places.refresh();
    balances.refresh();
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                openNewTrip(isGuest, trips);
              }}
              hitSlop={10}
              accessibilityLabel={t('app.overview.planTrip')}>
              <SymbolView
                name={{ ios: 'plus.circle.fill', android: 'add_circle' }}
                size={30}
                tintColor={Colors.primary}
              />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          trips ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }>
        {isGuest && <GuestBanner secondsLeft={user?.guest_seconds_left ?? 0} />}

        {loading && !trips ? (
          <OverviewSkeleton />
        ) : error && !trips ? (
          <ErrorState error={error} onRetry={reload} title={t('tripsOverview.error.title')} />
        ) : !hasOwnTrips ? (
          <FirstTrip sample={trips?.find((trip) => trip.isSample)} />
        ) : (
          <Overview trips={trips!} places={places.data ?? null} balances={balances.data ?? null} />
        )}
      </ScrollView>
    </>
  );
}

function Overview({
  trips,
  places,
  balances,
}: {
  trips: Trip[];
  places: Place[] | null;
  balances: Awaited<ReturnType<typeof tripsApi.balancesSummary>> | null;
}) {
  const { t } = useTranslation();

  // Stejné pořadí jako web: probíhající výlet, pak nejbližší budoucí, pak poslední proběhlý.
  const { ongoing, upcoming, past } = useMemo(() => {
    const buckets: Record<HeroState, Trip[]> = { ongoing: [], upcoming: [], past: [] };
    for (const trip of trips) buckets[tripStatus(trip)].push(trip);
    buckets.ongoing.sort((a, b) => a.endDate.localeCompare(b.endDate));
    buckets.upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
    buckets.past.sort((a, b) => b.endDate.localeCompare(a.endDate));
    return buckets;
  }, [trips]);

  const [heroTrip, heroState]: [Trip, HeroState] = ongoing[0]
    ? [ongoing[0], 'ongoing']
    : upcoming[0]
      ? [upcoming[0], 'upcoming']
      : [past[0], 'past'];

  const placeCount = places ? places.filter((p) => p.tripId === heroTrip.id).length : null;
  const upNext = [...ongoing, ...upcoming];
  const listed = (upNext.length > 0 ? upNext : past).slice(0, MAX_TRIPS);

  return (
    <>
      <HeroCard trip={heroTrip} state={heroState} placeCount={placeCount} />
      {heroState !== 'past' && <ReadinessCard trip={heroTrip} placeCount={placeCount} />}
      <Tiles
        heroTrip={heroTrip}
        trips={trips}
        upcomingCount={upcoming.length}
        places={places}
        balances={balances}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('tripsOverview.yourTrips')}</Text>
          <Pressable onPress={() => router.navigate('/(tabs)/(vylety)')} hitSlop={8}>
            <Text style={styles.sectionAction}>{t('app.overview.seeAll')}</Text>
          </Pressable>
        </View>
        <View style={styles.list}>
          {listed.map((trip, i) => (
            <TripRow key={trip.id} trip={trip} divider={i > 0} onPress={() => openTrip(trip.id)} />
          ))}
        </View>
      </View>
    </>
  );
}

// Karta „co je teď“: probíhající výlet s dnešním plánem, odpočet, nebo vzpomínka.
function HeroCard({
  trip,
  state,
  placeCount,
}: {
  trip: Trip;
  state: HeroState;
  placeCount: number | null;
}) {
  const { t } = useTranslation();
  const { isGuest } = useSession();
  const { trips } = useTrips();
  const days = tripDayCount(trip);
  const meta = [
    formatTripRange(trip, true),
    t('tripsOverview.hero.dayCount', { count: days }),
    placeCount ? t('tripsOverview.hero.placeCount', { count: placeCount }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (state === 'ongoing') {
    const day = currentTripDay(trip) ?? 1;
    const today = trip.activities[day - 1];
    return (
      <Pressable
        onPress={() => openTrip(trip.id)}
        style={({ pressed }) => [styles.card, styles.heroCard, pressed && styles.pressed]}>
        <View style={[styles.pill, styles.pillLive]}>
          <View style={styles.liveDot} />
          <Text style={[styles.pillText, styles.pillTextLive]}>
            {t('tripsOverview.hero.inProgress')} ·{' '}
            {t('tripsOverview.hero.dayOf', { day, total: days })}
          </Text>
        </View>
        <Text style={styles.heroTitle}>{trip.title}</Text>
        <View style={styles.today}>
          <Text style={styles.todayLabel}>{t('tripsOverview.hero.today')}</Text>
          {today?.plan?.trim() || today?.title ? (
            <>
              {today.title ? <Text style={styles.todayTitle}>{today.title}</Text> : null}
              {today.plan?.trim() ? (
                <Text style={styles.todayPlan} numberOfLines={3}>
                  {today.plan.trim()}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.todayPlan}>{t('tripsOverview.hero.noPlanToday')}</Text>
          )}
        </View>
        <Text style={styles.heroMeta}>{meta}</Text>
      </Pressable>
    );
  }

  if (state === 'upcoming') {
    const left = daysUntilStart(trip);
    return (
      <Pressable
        onPress={() => openTrip(trip.id)}
        style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
        <View style={styles.heroBadge}>
          <SymbolView
            name={{ ios: 'airplane', android: 'flight' }}
            size={13}
            tintColor={Colors.primary}
          />
          <Text style={styles.heroBadgeText}>{t('tripsOverview.countdown.label')}</Text>
        </View>
        <View style={styles.countdown}>
          {left > 0 ? (
            <>
              <Text style={styles.countdownNumber}>{left}</Text>
              <Text style={styles.countdownLabel}>
                {t('app.welcome.preview.days', { count: left })}
              </Text>
            </>
          ) : (
            <Text style={styles.countdownNumber}>{t('tripsOverview.countdown.today')}</Text>
          )}
        </View>
        <View>
          <Text style={styles.heroTitleLight}>{trip.title}</Text>
          <Text style={styles.heroMetaLight}>{meta}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, styles.heroCard]}>
      <Pressable onPress={() => openTrip(trip.id)} style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{t('tripsOverview.hero.lastTrip')}</Text>
        </View>
        <Text style={styles.heroTitle}>{trip.title}</Text>
        <Text style={styles.heroMeta}>{meta}</Text>
      </Pressable>
      <View style={styles.heroDivider} />
      <Pressable
        onPress={() => openNewTrip(isGuest, trips)}
        style={({ pressed }) => [styles.nextRow, pressed && styles.pressed]}>
        <Text style={styles.nextText}>{t('tripsOverview.hero.planNextPrompt')}</Text>
        <SymbolView
          name={{ ios: 'plus.circle.fill', android: 'add_circle' }}
          size={24}
          tintColor={Colors.primary}
        />
      </Pressable>
    </View>
  );
}

function ReadinessCard({ trip, placeCount }: { trip: Trip; placeCount: number | null }) {
  const { t } = useTranslation();
  const { score, items } = computeReadiness(trip, placeCount);
  const done = items.filter((item) => item.done).length;

  return (
    <Pressable
      onPress={() => openTrip(trip.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t('tripsOverview.readiness.label')}</Text>
        <Text style={styles.cardScore}>{score} %</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${score}%` }]} />
      </View>
      <Text style={styles.cardMeta}>
        {done === items.length
          ? t('tripsOverview.readiness.allDone')
          : t('tripsOverview.readiness.doneCount', { done, total: items.length }).replace(/^·\s*/, '')}
      </Text>
      <View style={styles.checklist}>
        {items.map((item) => (
          <View key={item.key} style={styles.checkRow}>
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
            <Text style={styles.checkLabel}>{readinessText(t, item)}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function readinessText(t: TFunction, item: ReadinessItem) {
  switch (item.key) {
    case 'itinerary':
      return t('tripsOverview.readiness.itinerary', { planned: item.count, total: item.total });
    case 'packing':
      return item.total > 0
        ? t('tripsOverview.readiness.packing', { packed: item.count, total: item.total })
        : t('tripsOverview.readiness.packingEmpty');
    case 'places':
      return item.count > 0
        ? t('tripsOverview.readiness.places', { count: item.count })
        : t('tripsOverview.readiness.placesEmpty');
    case 'documents':
      return item.count > 0
        ? t('tripsOverview.readiness.documents', { count: item.count })
        : t('tripsOverview.readiness.documentsEmpty');
  }
}

// Vlajka z kódu země (CZ → 🇨🇿).
const flag = (code: string) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

function Tiles({
  heroTrip,
  trips,
  upcomingCount,
  places,
  balances,
}: {
  heroTrip: Trip;
  trips: Trip[];
  upcomingCount: number;
  places: Place[] | null;
  balances: Awaited<ReturnType<typeof tripsApi.balancesSummary>> | null;
}) {
  const { t } = useTranslation();

  // Rozpočet hlavního výletu v jeho měně.
  const spent = tripSpend(heroTrip);
  const target = heroTrip.budgetTarget;
  const pct = target ? Math.round((spent / target) * 100) : null;
  const budget =
    spent === 0 && !target
      ? { value: '—', sub: t('tripsOverview.tiles.budgetEmpty') }
      : {
          value: formatMoney(spent, heroTrip.currency),
          sub: target
            ? t('tripsOverview.tiles.budgetOf', {
                target: formatMoney(target, heroTrip.currency),
                pct: Math.min(pct ?? 0, 999),
              })
            : t('tripsOverview.tiles.budgetTotal'),
        };

  // Vyrovnání: víc je vidět strana, která potřebuje akci.
  let balance = { value: '—', sub: t('tripsOverview.tiles.balanceUnknown'), accent: '#7c3aed' };
  if (balances) {
    const { owedToMe, iOwe, counterparties, currency } = balances;
    if (owedToMe === 0 && iOwe === 0) {
      balance = {
        value: t('tripsOverview.tiles.balanceSettled'),
        sub: t('tripsOverview.tiles.balanceSettledSub'),
        accent: '#7c3aed',
      };
    } else {
      const owing = iOwe >= owedToMe;
      const people = counterparties.filter(
        (c) => c.direction === (owing ? 'iOwe' : 'owedToMe'),
      ).length;
      balance = {
        value: formatMoney(owing ? iOwe : owedToMe, currency),
        sub: owing
          ? t('tripsOverview.tiles.balanceIOwe', { count: people })
          : t('tripsOverview.tiles.balanceOwedToMe', { count: people }),
        accent: owing ? Colors.danger : Colors.success,
      };
    }
  }

  // Země jen z navštívených míst, stejně jako na webu.
  const visited = places?.filter((p) => p.status === 'visited') ?? [];
  const countries = [...new Set(visited.map((p) => p.countryCode).filter((c): c is string => !!c))];

  return (
    <View style={styles.tiles}>
      <Tile
        icon={{ ios: 'wallet.bifold', android: 'account_balance_wallet' }}
        accent={Colors.primary}
        label={t('tripsOverview.tiles.budget')}
        value={budget.value}
        sub={budget.sub}>
        {pct !== null && (
          <View style={styles.tileTrack}>
            <View
              style={[
                styles.tileFill,
                { width: `${Math.min(pct, 100)}%` },
                spent > (target ?? 0) && styles.tileFillOver,
              ]}
            />
          </View>
        )}
      </Tile>
      <Tile
        icon={{ ios: 'arrow.left.arrow.right', android: 'swap_horiz' }}
        accent={balance.accent}
        label={t('tripsOverview.tiles.balance')}
        value={balance.value}
        sub={balance.sub}
      />
      <Tile
        icon={{ ios: 'globe.europe.africa', android: 'public' }}
        accent={Colors.success}
        label={t('tripsOverview.tiles.countries')}
        value={countries.length > 0 ? String(countries.length) : '—'}
        sub={
          !places?.length
            ? t('tripsOverview.tiles.countriesEmpty')
            : t('tripsOverview.tiles.placesVisited', { visited: visited.length, total: places.length })
        }>
        {countries.length > 0 && (
          <Text style={styles.flags}>
            {countries.slice(0, 5).map(flag).join(' ')}
            {countries.length > 5 ? ` +${countries.length - 5}` : ''}
          </Text>
        )}
      </Tile>
      <Tile
        icon={{ ios: 'airplane', android: 'flight' }}
        accent={Colors.warning}
        label={t('tripsOverview.tiles.trips')}
        value={String(trips.length)}
        sub={t('tripsOverview.tiles.tripsUpcoming', { count: upcomingCount })}
      />
    </View>
  );
}

function Tile({
  icon,
  accent,
  label,
  value,
  sub,
  children,
}: {
  icon: IconName;
  accent: string;
  label: string;
  value: string;
  sub: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHeader}>
        <SymbolView name={icon} size={16} tintColor={accent} />
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileSub} numberOfLines={2}>
        {sub}
      </Text>
      {children}
    </View>
  );
}

// Bez vlastního výletu: jedna výzva místo prázdného přehledu s pomlčkami.
function FirstTrip({ sample }: { sample?: Trip }) {
  const { t } = useTranslation();
  const { isGuest } = useSession();
  const { trips } = useTrips();

  return (
    <>
      <View style={[styles.card, styles.firstTrip]}>
        <View style={styles.firstIcon}>
          <SymbolView
            name={{ ios: 'map', android: 'map' }}
            size={26}
            tintColor={Colors.primary}
          />
        </View>
        <Text style={styles.firstTitle}>{t('app.overview.emptyTitle')}</Text>
        <Text style={styles.firstText}>{t('app.overview.emptyText')}</Text>
        <Pressable
          onPress={() => openNewTrip(isGuest, trips)}
          style={({ pressed }) => [styles.firstButton, pressed && styles.pressed]}>
          <SymbolView name={{ ios: 'plus', android: 'add' }} size={16} weight="semibold" tintColor="#fff" />
          <Text style={styles.firstButtonText}>{t('app.overview.planTrip')}</Text>
        </Pressable>
      </View>

      {sample && (
        <Pressable
          onPress={() => openTrip(sample.id)}
          style={({ pressed }) => [styles.card, styles.sampleRow, pressed && styles.pressed]}>
          <View style={styles.sampleText}>
            <Text style={styles.sampleEyebrow}>{t('guest.sample.eyebrow')}</Text>
            <Text style={styles.sampleTitle} numberOfLines={1}>
              {t('guest.sample.cta', { title: sample.title })}
            </Text>
          </View>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right' }}
            size={14}
            weight="semibold"
            tintColor={Colors.primary}
          />
        </Pressable>
      )}
    </>
  );
}

// Zkušební režim: kolik zbývá a cesta k uložení účtu.
function GuestBanner({ secondsLeft }: { secondsLeft: number }) {
  const { t } = useTranslation();
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor(secondsLeft / 3600);
  const time =
    days >= 1
      ? t('guest.time.days', { count: days })
      : hours >= 1
        ? t('guest.time.hours', { count: hours })
        : t('guest.time.minutes', { count: Math.max(1, Math.floor(secondsLeft / 60)) });

  return (
    <Pressable
      onPress={() => router.push('/prihlaseni')}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'icloud.and.arrow.up', android: 'cloud_upload' }}
        size={22}
        tintColor={Colors.warning}
      />
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>
          {secondsLeft > 0 ? t('guest.banner.title', { time }) : t('guest.banner.expiredTitle')}
        </Text>
        <Text style={styles.bannerSub}>{t('guest.banner.save')}</Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right' }}
        size={13}
        weight="semibold"
        tintColor={Colors.textTertiary}
      />
    </Pressable>
  );
}

function OverviewSkeleton() {
  const { t } = useTranslation();
  return (
    <View style={styles.skeleton} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
      <View style={[styles.card, styles.heroCard]}>
        <Skeleton width={120} height={26} radius={Radius.pill} />
        <Skeleton width="45%" height={48} radius={10} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="50%" height={14} />
      </View>
      <View style={styles.tiles}>
        {[0, 1].map((i) => (
          <View key={i} style={styles.tile}>
            <Skeleton width="50%" height={14} />
            <Skeleton width="70%" height={24} />
            <Skeleton width="60%" height={12} />
          </View>
        ))}
      </View>
      <SkeletonList rows={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.eight },
  pressed: { opacity: 0.7 },
  skeleton: { gap: Spacing.four },

  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  heroCard: { padding: Spacing.five },

  hero: {
    gap: Spacing.four,
    padding: Spacing.five,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.primary,
    boxShadow: '0 12px 28px rgba(21, 93, 252, 0.28)',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: '#fff',
  },
  heroBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  countdown: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  countdownNumber: {
    fontFamily: Fonts.rounded,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  countdownLabel: { fontSize: 17, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },
  heroTitleLight: { fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  heroMetaLight: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
  },
  pillLive: { backgroundColor: Colors.successSoft },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  pillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  pillTextLive: { color: Colors.success },
  heroTitle: { fontSize: 26, fontWeight: '700', color: Colors.text, letterSpacing: -0.4, marginTop: 4 },
  heroMeta: { fontSize: 14, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  today: { gap: 2 },
  todayLabel: { fontSize: 13, fontWeight: '600', color: Colors.textTertiary },
  todayTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  todayPlan: { fontSize: 15, lineHeight: 21, color: Colors.textSecondary },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  nextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextText: { fontSize: 16, fontWeight: '600', color: Colors.primary },

  cardHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  cardScore: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.success,
    fontVariant: ['tabular-nums'],
  },
  cardMeta: { fontSize: 14, color: Colors.textSecondary, marginTop: -4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.separator, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.success },
  checklist: { gap: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 6 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: Colors.successSoft },
  checkTodo: { backgroundColor: Colors.warningSoft },
  checkLabel: { flex: 1, fontSize: 15, color: Colors.text },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    padding: Spacing.four,
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tileLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
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
  tileFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.primary },
  tileFillOver: { backgroundColor: Colors.danger },
  flags: { fontSize: 15, marginTop: 4 },

  section: { gap: Spacing.two, marginTop: Spacing.two },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },
  sectionAction: { fontSize: 16, color: Colors.primary },
  list: {
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },

  firstTrip: { alignItems: 'center', paddingVertical: Spacing.eight, paddingHorizontal: Spacing.six },
  firstIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    borderCurve: 'continuous',
    backgroundColor: Colors.primarySoft,
  },
  firstTitle: { fontSize: 24, fontWeight: '700', color: Colors.text, letterSpacing: -0.4 },
  firstText: { fontSize: 15, lineHeight: 21, color: Colors.textSecondary, textAlign: 'center' },
  firstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    height: 48,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  firstButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  sampleRow: { flexDirection: 'row', alignItems: 'center' },
  sampleText: { flex: 1, gap: 2 },
  sampleEyebrow: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  sampleTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },

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
  bannerSub: { fontSize: 14, color: Colors.textSecondary },
});
