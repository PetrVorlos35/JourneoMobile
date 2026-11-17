import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSaturday,
  isSunday,
  nextSaturday,
  parseISO,
  startOfDay,
} from 'date-fns';
import type { TFunction } from 'i18next';

import type { Activity, PackingItem, Trip } from '@/lib/api';

// Stejná logika jako webové utils/trip.js a utils/onboarding.js.
// Data výletu jsou „yyyy-MM-dd“ a čtou se v místním čase (parseISO), ne v UTC.

export type TripStatus = 'upcoming' | 'ongoing' | 'past';

export const MAX_TRIP_DAYS = 100;
export const MIN_TRIP_DATE = parseISO('2024-01-01');

// Výlet probíhá celý svůj poslední den, ne jen do půlnoci předtím.
export function tripStatus(trip: Pick<Trip, 'startDate' | 'endDate'>, now = new Date()): TripStatus {
  if (endOfDay(parseISO(trip.endDate)) < now) return 'past';
  if (startOfDay(parseISO(trip.startDate)) <= now) return 'ongoing';
  return 'upcoming';
}

export const tripDayCount = (trip: Pick<Trip, 'startDate' | 'endDate'>) =>
  Math.max(1, differenceInCalendarDays(parseISO(trip.endDate), parseISO(trip.startDate)) + 1);

// Kolikátý den výletu je dnes (od 1), nebo null, když neprobíhá.
export const currentTripDay = (trip: Pick<Trip, 'startDate' | 'endDate'>) =>
  tripStatus(trip) === 'ongoing'
    ? differenceInCalendarDays(new Date(), parseISO(trip.startDate)) + 1
    : null;

export const daysUntilStart = (trip: Pick<Trip, 'startDate'>) =>
  differenceInCalendarDays(parseISO(trip.startDate), new Date());

export const tripSpend = (trip: Trip) =>
  trip.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

// Ukázkový výlet hosta se nepočítá mezi jeho vlastní.
export const ownTrips = (trips: Trip[]) => trips.filter((trip) => !trip.isSample);

// „12.–18. 11.“, přes měsíc „28. 11. – 3. 12.“, přes rok i s roky.
export function formatTripRange(trip: Pick<Trip, 'startDate' | 'endDate'>, withYear = false) {
  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  const year = withYear || start.getFullYear() !== end.getFullYear();
  if (trip.startDate === trip.endDate) return format(start, year ? 'd. M. yyyy' : 'd. M.');
  if (!year && start.getMonth() === end.getMonth()) {
    return `${format(start, 'd.')}–${format(end, 'd. M.')}`;
  }
  return `${format(start, year ? 'd. M. yyyy' : 'd. M.')} – ${format(end, year ? 'd. M. yyyy' : 'd. M.')}`;
}

// Barva výletu podle názvu: stejný výlet má všude stejnou barvu, nic se neukládá.
const TRIP_COLORS = [
  { bg: '#eaf1ff', fg: '#155dfc' },
  { bg: '#f1edff', fg: '#7c3aed' },
  { bg: '#e8f6ee', fg: '#059669' },
  { bg: '#fdf3e4', fg: '#d97706' },
  { bg: '#fdecef', fg: '#e11d48' },
  { bg: '#e6f7fa', fg: '#0891b2' },
  { bg: '#fff0e6', fg: '#ea580c' },
  { bg: '#eef0ff', fg: '#4f46e5' },
] as const;

export function tripColor(title = '') {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  return TRIP_COLORS[Math.abs(hash) % TRIP_COLORS.length];
}

// ── Připravenost ────────────────────────────────────────────
// Itinerář a balení váží nejvíc, protože bez nich se odjet nedá.
const WEIGHTS = { itinerary: 40, packing: 30, places: 15, documents: 15 } as const;

export type ReadinessKey = keyof typeof WEIGHTS;
export type ReadinessItem = { key: ReadinessKey; done: boolean; count: number; total: number };

export function computeReadiness(trip: Trip, placeCount: number | null) {
  const totalDays = tripDayCount(trip);
  const plannedDays = trip.activities.filter((a) => a.plan?.trim()).length;
  const packed = trip.packingList.filter((p) => p.checked).length;
  const packing = trip.packingList.length;
  const documents = trip.documents.length;
  const places = placeCount ?? 0;

  const ratios: Record<ReadinessKey, number> = {
    itinerary: Math.min(plannedDays / totalDays, 1),
    packing: packing > 0 ? packed / packing : 0,
    places: places > 0 ? 1 : 0,
    documents: documents > 0 ? 1 : 0,
  };
  const score = Math.round(
    (Object.keys(WEIGHTS) as ReadinessKey[]).reduce((sum, k) => sum + ratios[k] * WEIGHTS[k], 0),
  );

  const items: ReadinessItem[] = [
    { key: 'itinerary', done: ratios.itinerary === 1, count: plannedDays, total: totalDays },
    { key: 'packing', done: packing > 0 && packed === packing, count: packed, total: packing },
    { key: 'places', done: places > 0, count: places, total: 0 },
    { key: 'documents', done: documents > 0, count: documents, total: 0 },
  ];
  return { score, items };
}

// ── Zakládání výletu ────────────────────────────────────────

export const TRIP_TYPES = ['city', 'mountains', 'sea', 'roadtrip'] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const QUICK_DATES = ['thisWeekend', 'nextWeekend', 'inMonth'] as const;
export type QuickDate = (typeof QUICK_DATES)[number];

export const toIsoDate = (date: Date) => format(date, 'yyyy-MM-dd');

export function quickDateRange(key: QuickDate, today = new Date()) {
  const day = startOfDay(today);
  const saturday = isSaturday(day) ? day : isSunday(day) ? addDays(day, -1) : nextSaturday(day);
  let start: Date;
  let end: Date;
  if (key === 'thisWeekend') {
    start = isSunday(day) ? day : saturday;
    end = addDays(saturday, 1);
  } else if (key === 'nextWeekend') {
    start = addDays(saturday, 7);
    end = addDays(saturday, 8);
  } else {
    start = addDays(day, 30);
    end = addDays(start, 6);
  }
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

// Program po dnech: první den nese destinaci, poslední je cesta domů.
export function buildStarterDays(
  t: TFunction,
  startDate: string,
  endDate: string,
  destination: string,
): Activity[] {
  const start = parseISO(startDate);
  const count = differenceInCalendarDays(parseISO(endDate), start) + 1;
  return Array.from({ length: count }, (_, i) => ({
    date: toIsoDate(addDays(start, i)),
    title:
      i === 0
        ? t('onboarding.days.arrival')
        : i === count - 1
          ? t('onboarding.days.departure')
          : t('onboarding.days.day', { n: i + 1 }),
    plan: '',
    location: i === 0 ? destination : '',
  }));
}

export function buildStarterPacking(t: TFunction, type: TripType): PackingItem[] {
  const extra = t(`onboarding.packing.${type}`, { returnObjects: true }) as unknown;
  const base = t('onboarding.packing.base', { returnObjects: true }) as unknown;
  const texts = [
    ...(Array.isArray(extra) ? (extra as string[]) : []),
    ...(Array.isArray(base) ? (base as string[]) : []),
  ];
  return texts.map((text) => ({ text, checked: false }));
}

// ── Program po dnech (detail výletu) ────────────────────────
// Stejně jako buildDailyPlans a planDateChange v TripDetail.jsx na webu.

// Výchozí název dne („Den 3“ / „Day 3“) se při posunu termínu přečísluje, vlastní zůstane.
const DEFAULT_DAY_TITLE = /^(Den|Day) \d+$/;
const isDefaultDayTitle = (title: string) => DEFAULT_DAY_TITLE.test(title.trim());

export const dayHasContent = (day: Activity | undefined) =>
  !!(
    day &&
    (day.plan?.trim() || day.location?.trim() || (day.title && !isDefaultDayTitle(day.title)))
  );

// Stránka pro každý den výletu doplněná o uložené aktivity (server je řadí podle dne).
export function buildDailyPlans(t: TFunction, trip: Pick<Trip, 'startDate' | 'endDate' | 'activities'>) {
  const start = parseISO(trip.startDate);
  const count = tripDayCount(trip);
  return Array.from({ length: count }, (_, i): Activity => {
    const saved = trip.activities[i];
    return {
      date: toIsoDate(addDays(start, i)),
      title: saved?.title || t('onboarding.days.day', { n: i + 1 }),
      plan: saved?.plan || '',
      location: saved?.location || '',
    };
  });
}

// Posun výletu se stejnou délkou: program jede s ním (1. den zůstane 1. dnem), i když
// se nový termín s původním překrývá. Při prodloužení nebo zkrácení s překryvem zůstane
// program u stejných kalendářních dnů (přidaný den je prázdný), bez překryvu jede s výletem.
// `lost` = čísla dnů s programem, které v novém termínu nebudou.
// (Web 2026-11-12 drží kalendářní dny při každém překryvu, i při čistém posunu.)
export function planDateChange(
  current: { startDate: string; endDate: string },
  days: Activity[],
  startDate: string,
  endDate: string,
) {
  const oldStart = parseISO(current.startDate);
  const oldEnd = parseISO(current.endDate);
  const newStart = parseISO(startDate);
  const newEnd = parseISO(endDate);
  const overlaps = newStart <= oldEnd && newEnd >= oldStart;
  const length = differenceInCalendarDays(newEnd, newStart) + 1;
  const sameLength = length === differenceInCalendarDays(oldEnd, oldStart) + 1;
  const keepCalendar = overlaps && !sameLength;
  const offset = keepCalendar ? differenceInCalendarDays(newStart, oldStart) : 0;
  const lost = days
    .map((day, i) => ({ day, n: i + 1, to: i - offset }))
    .filter((x) => (x.to < 0 || x.to >= length) && dayHasContent(x.day))
    .map((x) => x.n);
  const hasContent = days.some(dayHasContent);
  const note: 'lost' | 'moved' | 'kept' | null = lost.length
    ? 'lost'
    : !keepCalendar && hasContent
      ? 'moved'
      : keepCalendar && offset !== 0 && hasContent
        ? 'kept'
        : null;
  return { offset, lost, note };
}

// Program pro nový termín: dny se přesunou o `offset`, výchozí názvy se přečíslují.
export function shiftDailyPlans(
  t: TFunction,
  days: Activity[],
  startDate: string,
  endDate: string,
  offset: number,
) {
  const start = parseISO(startDate);
  const count = differenceInCalendarDays(parseISO(endDate), start) + 1;
  return Array.from({ length: count }, (_, i): Activity => {
    const src = days[i + offset];
    const custom = src?.title && !isDefaultDayTitle(src.title);
    return {
      date: toIsoDate(addDays(start, i)),
      title: custom ? src.title : t('onboarding.days.day', { n: i + 1 }),
      plan: src?.plan || '',
      location: src?.location || '',
    };
  });
}
