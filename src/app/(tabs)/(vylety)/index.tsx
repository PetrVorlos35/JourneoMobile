import { MenuView } from '@expo/ui/community/menu';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import type { SearchBarCommands } from 'react-native-screens';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { TripRow } from '@/components/trip-row';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Trip } from '@/lib/api';
import { openNewTrip, openTrip } from '@/lib/new-trip';
import { useSession } from '@/lib/session';
import { tripStatus, type TripStatus } from '@/lib/trip';
import { useTrips } from '@/lib/trips';

type Filter = 'all' | TripStatus;
type Sort = 'dateDesc' | 'dateAsc' | 'nameAz';

const FILTERS: Filter[] = ['all', 'ongoing', 'upcoming', 'past'];
const SORTS: Sort[] = ['dateDesc', 'dateAsc', 'nameAz'];

export default function TripsScreen() {
  const { t } = useTranslation();
  const { isGuest } = useSession();
  const { trips, loading, refreshing, error, reload, refresh, deleteTrip } = useTrips();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('dateDesc');
  const searchBar = useRef<SearchBarCommands>(null);

  const counts = useMemo(() => {
    const result: Record<TripStatus, number> = { ongoing: 0, upcoming: 0, past: 0 };
    for (const trip of trips ?? []) result[tripStatus(trip)] += 1;
    return result;
  }, [trips]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return (trips ?? [])
      .filter((trip) => !q || trip.title.toLocaleLowerCase().includes(q))
      .filter((trip) => filter === 'all' || tripStatus(trip) === filter)
      .sort((a, b) =>
        sort === 'dateAsc'
          ? a.startDate.localeCompare(b.startDate)
          : sort === 'nameAz'
            ? a.title.localeCompare(b.title)
            : b.startDate.localeCompare(a.startDate),
      );
  }, [trips, query, filter, sort]);

  // Prázdné kategorie nenabízíme, štítek, který vždy vrátí nic, jen zabírá místo.
  const chips = FILTERS.filter((key) => key === 'all' || key === filter || counts[key] > 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: trips?.length
            ? {
                ref: searchBar,
                placeholder: t('app.trips.searchPlaceholder'),
                onChangeText: (e) => setQuery(e.nativeEvent.text),
                onCancelButtonPress: () => setQuery(''),
              }
            : undefined,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable
                onPress={() => router.push('/(tabs)/(vylety)/kos')}
                hitSlop={8}
                accessibilityLabel={t('app.trips.trash')}>
                <SymbolView
                  name={{ ios: 'trash', android: 'delete' }}
                  size={22}
                  tintColor={Colors.primary}
                />
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  openNewTrip(isGuest, trips);
                }}
                hitSlop={8}
                accessibilityLabel={t('app.trips.newTrip')}>
                <SymbolView
                  name={{ ios: 'plus.circle.fill', android: 'add_circle' }}
                  size={30}
                  tintColor={Colors.primary}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        refreshControl={
          trips ? <RefreshControl refreshing={refreshing} onRefresh={refresh} /> : undefined
        }>
        {loading && !trips ? (
          <SkeletonList rows={5} />
        ) : error && !trips ? (
          <ErrorState error={error} onRetry={reload} title={t('dashboardHome.loadError')} />
        ) : !trips?.length ? (
          <EmptyState
            icon={{ ios: 'suitcase', android: 'luggage' }}
            title={t('allTrips.noTrips.title')}
            text={t('allTrips.noTrips.description')}
            action={{ label: t('emptyStates.planFirst'), onPress: () => openNewTrip(isGuest, trips) }}
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}
              contentContainerStyle={styles.chips}>
              {chips.map((key) => {
                const active = filter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setFilter(key);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(`allTrips.filter.${key}`)}
                      {key !== 'all' && ` · ${counts[key]}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.listHeader}>
              <Text style={styles.count}>{t('allTrips.count', { count: visible.length })}</Text>
              <MenuView
                title={t('app.trips.sort')}
                actions={SORTS.map((key) => ({
                  id: key,
                  title: t(`allTrips.sort.${key}`),
                  state: sort === key ? 'on' : 'off',
                }))}
                onPressAction={({ nativeEvent }) => setSort(nativeEvent.event as Sort)}>
                <View style={styles.sortButton}>
                  <SymbolView
                    name={{ ios: 'arrow.up.arrow.down', android: 'swap_vert' }}
                    size={13}
                    tintColor={Colors.primary}
                  />
                  <Text style={styles.sortText}>{t(`allTrips.sort.${sort}`)}</Text>
                </View>
              </MenuView>
            </View>

            {visible.length === 0 ? (
              <EmptyState
                icon={{ ios: 'magnifyingglass', android: 'search' }}
                title={t('allTrips.empty.title')}
                text={t('allTrips.empty.description')}
                action={{
                  label: t('allTrips.filter.reset'),
                  onPress: () => {
                    // Vyčistit i pole v hlavičce, jinak by v něm zůstal starý text.
                    searchBar.current?.cancelSearch();
                    searchBar.current?.clearText();
                    setQuery('');
                    setFilter('all');
                  },
                }}
              />
            ) : (
              <View style={styles.list}>
                {visible.map((trip, i) => (
                  <SwipeableTrip
                    key={trip.id}
                    trip={trip}
                    divider={i > 0}
                    onDelete={() => deleteTrip(trip)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

// Přejetím doleva se ukáže „Smazat“. Smazat smí jen vlastník, sdílené výlety přejet nejdou.
function SwipeableTrip({
  trip,
  divider,
  onDelete,
}: {
  trip: Trip;
  divider: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<SwipeableMethods>(null);
  const row = <TripRow trip={trip} divider={divider} onPress={() => openTrip(trip.id, 'vylety')} />;

  if (trip.role !== 'owner') return row;

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => Haptics.selectionAsync()}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
          style={styles.deleteAction}
          accessibilityLabel={t('app.trips.delete')}>
          <SymbolView name={{ ios: 'trash.fill', android: 'delete' }} size={20} tintColor="#fff" />
          <Text style={styles.deleteText}>{t('app.trips.delete')}</Text>
        </Pressable>
      )}>
      {row}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
  pressed: { opacity: 0.7 },
  // Na iOS 26 kreslí systém kolem tlačítek v hlavičce skleněnou pilulku, tak potřebují místo po stranách.
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.two,
  },

  chipsScroll: { marginHorizontal: -Spacing.four, flexGrow: 0 },
  chips: { gap: Spacing.two, paddingHorizontal: Spacing.four },
  chip: {
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipText: { fontSize: 14, fontWeight: '500', color: Colors.text },
  chipTextActive: { color: Colors.primary, fontWeight: '600' },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  count: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36 },
  sortText: { fontSize: 14, fontWeight: '500', color: Colors.primary },

  list: {
    borderRadius: Radius.large,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.danger,
  },
  deleteText: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
