import * as Haptics from 'expo-haptics';
import { createContext, use, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/toast';
import { ApiError, tripsApi, type Trip } from '@/lib/api';
import { useSession } from '@/lib/session';
import { reportError } from '@/lib/telemetry';
import { useApi } from '@/lib/use-api';

type TripsContextValue = {
  trips: Trip[] | undefined;
  loading: boolean;
  refreshing: boolean;
  error: unknown;
  reload: () => void;
  refresh: () => void;
  // Nový nebo upravený výlet (po založení, obnovení z koše).
  upsertTrip: (trip: Trip) => void;
  // Okamžité smazání s „Vrátit“ v toastu, bez potvrzovacího dialogu (jako web).
  deleteTrip: (trip: Trip) => void;
};

const TripsContext = createContext<TripsContextValue | null>(null);

// Výlety sdílí Přehled, seznam výletů i zakládání, tak se načítají jednou.
export function TripsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();
  // Po přihlášení hosta do účtu se výlety načtou znovu (převedené ze zkoušky).
  const { data, loading, refreshing, error, reload, refresh, setData } = useApi(
    user ? `trips:${user.id}` : null,
    async () => (await tripsApi.list()).trips,
  );

  const upsertTrip = useCallback(
    (trip: Trip) =>
      setData((prev) =>
        prev?.some((tr) => tr.id === trip.id)
          ? prev.map((tr) => (tr.id === trip.id ? trip : tr))
          : [...(prev ?? []), trip],
      ),
    [setData],
  );

  const deleteTrip = useCallback(
    (trip: Trip) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setData((prev) => prev?.filter((tr) => tr.id !== trip.id));

      // Server výlet hned přesune do koše, takže zavřená appka během toastu nic neztratí.
      // „Vrátit“ počká na smazání a pak výlet obnoví.
      const removal = tripsApi.remove(trip.id).then(
        () => true,
        (err: unknown) => {
          reportError(err);
          upsertTrip(trip);
          toast.show({ message: err instanceof ApiError ? err.message : t('dashboardHome.deleteError') });
          return false;
        },
      );

      toast.showUndo(t('dashboardHome.tripDeleted'), async () => {
        if (!(await removal)) return;
        try {
          await tripsApi.restore(trip.id);
          upsertTrip(trip);
        } catch (err) {
          reportError(err);
          toast.show({ message: err instanceof ApiError ? err.message : t('dashboardHome.restoreError') });
        }
      });
    },
    [setData, upsertTrip, toast, t],
  );

  return (
    <TripsContext
      value={{
        trips: data,
        loading,
        refreshing,
        error,
        reload,
        refresh,
        upsertTrip,
        deleteTrip,
      }}>
      {children}
    </TripsContext>
  );
}

export function useTrips() {
  const ctx = use(TripsContext);
  if (!ctx) throw new Error('useTrips musí být uvnitř TripsProvider');
  return ctx;
}
