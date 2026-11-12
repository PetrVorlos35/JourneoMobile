import { addDays, differenceInCalendarDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ApiError, tripsApi, type TrashedTrip } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { showGuestLimit } from '@/lib/new-trip';
import { useSession } from '@/lib/session';
import { reportError } from '@/lib/telemetry';
import { formatTripRange } from '@/lib/trip';
import { useTrips } from '@/lib/trips';
import { useApi } from '@/lib/use-api';

// Smazané výlety server drží 30 dní, pak je cron trvale odstraní.
const RETENTION_DAYS = 30;

export default function TrashScreen() {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();
  const { reload: reloadTrips } = useTrips();
  const { data, loading, refreshing, error, reload, refresh, setData } = useApi(
    user ? `trash:${user.id}` : null,
    async () => (await tripsApi.trash()).trips,
  );
  const [busy, setBusy] = useState<string | null>(null);

  function failed(err: unknown) {
    if (err instanceof ApiError && err.code === 'GUEST_TRIP_LIMIT') {
      showGuestLimit();
      return;
    }
    if (!(err instanceof ApiError)) reportError(err);
    toast.show({ message: err instanceof ApiError ? err.message : t('trash.error') });
  }

  async function restore(trip: TrashedTrip) {
    setBusy(trip.id);
    try {
      await tripsApi.restore(trip.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setData((prev) => prev?.filter((tr) => tr.id !== trip.id));
      // Obnovený výlet přijde zpátky celý (s aktivitami, výdaji…), tak se seznam načte znovu.
      reloadTrips();
      toast.show({ message: t('trash.restored') });
    } catch (err) {
      failed(err);
    } finally {
      setBusy(null);
    }
  }

  function removeForever(trip: TrashedTrip) {
    Alert.alert(
      t('trash.confirmForever.title'),
      t('trash.confirmForever.message', { title: trip.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trash.confirmForever.confirm'),
          style: 'destructive',
          onPress: async () => {
            setBusy(trip.id);
            try {
              await tripsApi.removeForever(trip.id);
              setData((prev) => prev?.filter((tr) => tr.id !== trip.id));
              toast.show({ message: t('trash.deletedForever') });
            } catch (err) {
              failed(err);
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  function emptyTrash() {
    Alert.alert(t('trash.confirmEmpty.title'), t('trash.confirmEmpty.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('trash.confirmEmpty.confirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy('all');
          try {
            await tripsApi.emptyTrash();
            setData(() => []);
            toast.show({ message: t('trash.emptied') });
          } catch (err) {
            failed(err);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('trash.title'),
          headerLargeTitleEnabled: false,
          headerRight: data?.length
            ? () => (
                <Pressable onPress={emptyTrash} disabled={busy !== null} hitSlop={8}>
                  <Text style={styles.headerAction}>{t('trash.emptyTrash')}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          data ? <RefreshControl refreshing={refreshing} onRefresh={refresh} /> : undefined
        }>
        {loading && !data ? (
          <SkeletonList rows={3} />
        ) : error && !data ? (
          <ErrorState error={error} onRetry={reload} title={t('trash.loadError')} />
        ) : !data?.length ? (
          <EmptyState
            icon={{ ios: 'trash', android: 'delete' }}
            title={t('trash.empty.title')}
            text={t('trash.empty.description')}
          />
        ) : (
          <>
            <Text style={styles.note}>{t('trash.subtitle')}</Text>
            <View style={styles.list}>
              {data.map((trip, i) => {
                const daysLeft = Math.max(
                  differenceInCalendarDays(addDays(new Date(trip.deletedAt), RETENTION_DAYS), new Date()),
                  0,
                );
                const rowBusy = busy === trip.id || busy === 'all';
                return (
                  <View key={trip.id} style={[styles.row, i > 0 && styles.divider]}>
                    <View style={styles.rowText}>
                      <Text style={styles.title} numberOfLines={1}>
                        {trip.title}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {formatTripRange(trip, true)}
                      </Text>
                      <Text style={[styles.sub, daysLeft <= 3 && styles.soon]} numberOfLines={1}>
                        {t('trash.deletedOn', { date: formatDate(trip.deletedAt, 'd. M.') })} ·{' '}
                        {t('trash.daysLeft', { count: daysLeft })}
                      </Text>
                    </View>
                    {rowBusy ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <View style={styles.actions}>
                        <Pressable
                          onPress={() => removeForever(trip)}
                          hitSlop={8}
                          accessibilityLabel={t('trash.deleteForever')}
                          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                          <SymbolView
                            name={{ ios: 'trash', android: 'delete_forever' }}
                            size={18}
                            tintColor={Colors.danger}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => restore(trip)}
                          style={({ pressed }) => [styles.restore, pressed && styles.pressed]}>
                          <Text style={styles.restoreText}>{t('trash.restore')}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
  pressed: { opacity: 0.6 },
  headerAction: { fontSize: 17, color: Colors.danger, paddingHorizontal: Spacing.three },
  note: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, paddingHorizontal: Spacing.one },
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
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator },
  rowText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '500', color: Colors.text },
  sub: { fontSize: 13, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  soon: { color: Colors.danger },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#fdecec',
  },
  restore: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
  },
  restoreText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
});
