import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  currentTripDay,
  daysUntilStart,
  formatTripRange,
  tripColor,
  tripDayCount,
  tripStatus,
} from '@/lib/trip';
import { useTrips } from '@/lib/trips';

const WEB_URL = 'https://journeo.vorlos.eu';

// Zatím jen hlavička výletu. Itinerář, balení a další části přijdou ve fázi 3.
export function TripDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, loading, error, reload } = useTrips();
  const trip = trips?.find((tr) => tr.id === id);

  let body;
  if (loading && !trips) {
    body = (
      <View style={styles.header}>
        <Skeleton width="70%" height={28} />
        <Skeleton width="45%" height={15} />
      </View>
    );
  } else if (error && !trips) {
    body = <ErrorState error={error} onRetry={reload} />;
  } else if (!trip) {
    body = (
      <EmptyState
        icon={{ ios: 'questionmark.folder', android: 'folder_off' }}
        title={t('tripDetail.notFound')}
        text={t('app.tripDetail.notFound')}
      />
    );
  } else {
    const status = tripStatus(trip);
    const days = tripDayCount(trip);
    const color = tripColor(trip.title);
    const statusText =
      status === 'ongoing'
        ? t('app.trips.dayOf', { day: currentTripDay(trip) ?? 1, total: days })
        : status === 'upcoming'
          ? t('allTrips.startsIn', { count: Math.max(daysUntilStart(trip), 1) })
          : t('app.trips.past');

    body = (
      <>
        <View style={styles.header}>
          <View style={[styles.status, { backgroundColor: color.bg }]}>
            <Text style={[styles.statusText, { color: color.fg }]}>{statusText}</Text>
          </View>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.meta}>
            {formatTripRange(trip, true)} · {t('allTrips.dayCount', { count: days })}
          </Text>
        </View>
        <EmptyState
          icon={{ ios: 'hammer', android: 'construction' }}
          title={t('app.tripDetail.soonTitle')}
          text={t('app.tripDetail.soonText')}
          action={{
            label: t('app.tripDetail.openWeb'),
            onPress: () => WebBrowser.openBrowserAsync(`${WEB_URL}/dashboard/trip/${trip.id}`),
          }}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '', headerLargeTitleEnabled: false }} />
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        {body}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.four, gap: Spacing.five, paddingBottom: Spacing.eight },
  header: { gap: Spacing.two, paddingHorizontal: Spacing.one, paddingTop: Spacing.two },
  status: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 30, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  meta: { fontSize: 15, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
});
