import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState } from 'react-native';
import { router } from 'expo-router';

import { useToast } from '@/components/ui/toast';
import { ApiError, tripsApi, type Activity, type PackingItem, type Trip, type TripDocument } from '@/lib/api';
import { reportError } from '@/lib/telemetry';
import { buildDailyPlans } from '@/lib/trip';
import { useTrips } from '@/lib/trips';

export type TripDraft = {
  title: string;
  startDate: string;
  endDate: string;
  activities: Activity[];
  packingList: PackingItem[];
  documents: TripDocument[];
};

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY = 800;

// Id nové položky jen pro appku, server přidělí vlastní.
export const localId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Rozepsaný výlet v detailu s automatickým ukládáním jako TripDetail na webu:
// každá úprava odloží uložení o chvíli, ukládání jde za sebou (starší požadavek
// nepřepíše novější), `version` hlídá cizí úpravy (409 TRIP_CONFLICT → převezme
// se verze ze serveru). Při odchodu z obrazovky nebo appky se rozepsané dopíše hned.
// Výdaje se neposílají, ty má na starosti rozpočet.
export function useTripEditor(trip: Trip) {
  const { t } = useTranslation();
  const { upsertTrip } = useTrips();
  const toast = useToast();

  const fromTrip = useCallback(
    (source: Trip): TripDraft => ({
      title: source.title,
      startDate: source.startDate,
      endDate: source.endDate,
      activities: buildDailyPlans(t, source),
      // Položky potřebují stálé id pro seznam a mazání (server je při uložení přečísluje).
      packingList: source.packingList.map((item, i) => ({ ...item, id: item.id ?? `p${i}` })),
      documents: source.documents.map((doc, i) => ({ ...doc, id: doc.id ?? `d${i}` })),
    }),
    [t],
  );

  const [draft, setDraft] = useState<TripDraft>(() => fromTrip(trip));
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const latest = useRef(draft);
  const version = useRef(trip.version);
  const savedTitle = useRef(trip.title);
  const shift = useRef(0);
  const pending = useRef(false);
  const saving = useRef(false);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback(
    (fresh: Trip) => {
      const next = fromTrip(fresh);
      version.current = fresh.version;
      savedTitle.current = fresh.title;
      latest.current = next;
      setDraft(next);
    },
    [fromTrip],
  );

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = false;
    saving.current = true;
    setSaveState('saving');
    chain.current = chain.current.then(async () => {
      const d = latest.current;
      const dayShift = shift.current;
      shift.current = 0;
      try {
        const { trip: saved } = await tripsApi.update(trip.id, {
          // Prázdný název se neuloží, zůstane poslední platný.
          title: d.title.trim() || savedTitle.current,
          startDate: d.startDate,
          endDate: d.endDate,
          activities: d.activities,
          packingList: d.packingList,
          documents: d.documents,
          version: version.current,
          ...(dayShift ? { dayShift } : {}),
        });
        version.current = saved.version;
        savedTitle.current = saved.title;
        upsertTrip(saved);
        if (!pending.current) setSaveState('saved');
      } catch (err) {
        if (err instanceof ApiError && err.code === 'TRIP_CONFLICT' && err.data.trip) {
          // Někdo výlet mezitím uložil jinde: platí jeho verze.
          const fresh = err.data.trip as Trip;
          pending.current = false;
          shift.current = 0;
          apply(fresh);
          upsertTrip(fresh);
          setSaveState('idle');
          toast.show({ message: err.message });
          return;
        }
        // Posun míst se pošle s dalším pokusem.
        shift.current += dayShift;
        setSaveState('error');
        if (err instanceof ApiError && (err.code === 'GUEST_EXPIRED' || err.code === 'GUEST_ENDED')) {
          Alert.alert(t('guest.upsell.expired.title'), t('guest.upsell.expired.text'), [
            { text: t('guest.upsell.later'), style: 'cancel' },
            { text: t('guest.upsell.cta'), onPress: () => router.push('/prihlaseni') },
          ]);
        } else if (!(err instanceof ApiError && err.isNetwork)) {
          reportError(err);
        }
      } finally {
        saving.current = false;
      }
    });
  }, [trip.id, upsertTrip, apply, toast, t]);

  // Úprava rozepsaného výletu. `dayShift` řekne serveru, o kolik posunout místa ve dnech.
  const update = useCallback(
    (change: (d: TripDraft) => TripDraft, options?: { dayShift?: number }) => {
      const next = change(latest.current);
      latest.current = next;
      setDraft(next);
      shift.current += options?.dayShift ?? 0;
      pending.current = true;
      setSaveState('pending');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_DELAY);
    },
    [flush],
  );

  // Novější verze odjinud (obnovení seznamu výletů), když zrovna nic nerozepisuju.
  useEffect(() => {
    if (trip.version > version.current && !pending.current && !saving.current) {
      apply(trip);
      setSaveState('idle');
    }
  }, [trip, apply]);

  // Odchod z obrazovky nebo appky: rozepsané uložit hned.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && pending.current) flush();
    });
    return () => {
      sub.remove();
      if (pending.current) flush();
    };
  }, [flush]);

  return { draft, update, saveState, retry: flush };
}
