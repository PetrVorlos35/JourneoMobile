import { describe, expect, it } from '@jest/globals';
import type { TFunction } from 'i18next';

import type { Activity, Trip } from '@/lib/api';
import {
  buildDailyPlans,
  computeReadiness,
  dayHasContent,
  planDateChange,
  quickDateRange,
  shiftDailyPlans,
  tripDayCount,
  tripStatus,
} from '@/lib/trip';

// Překlady nejsou potřeba: výchozí název dne je „Den N“ jako na serveru.
const t = ((key: string, opts?: { n?: number }) =>
  key === 'onboarding.days.day' ? `Den ${opts?.n}` : key) as unknown as TFunction;

const day = (date: string, extra: Partial<Activity> = {}): Activity => ({
  date,
  title: '',
  plan: '',
  location: '',
  ...extra,
});

// Výlet Po 9. – Ne 15. 11. 2026, plán jen 1. a 3. den.
const week = { startDate: '2026-11-09', endDate: '2026-11-15' };
const weekDays = buildDailyPlans(t, {
  ...week,
  activities: [
    day('2026-11-09', { title: 'Příjezd', plan: 'Lisabon' }),
    day('2026-11-10', { title: 'Den 2' }),
    day('2026-11-11', { title: 'Den 3', plan: 'Sintra' }),
  ],
});

describe('tripStatus a tripDayCount', () => {
  const now = new Date('2026-11-12T10:00:00');
  it('pozná nadcházející, probíhající a proběhlý výlet', () => {
    expect(tripStatus({ startDate: '2026-11-20', endDate: '2026-11-22' }, now)).toBe('upcoming');
    expect(tripStatus(week, now)).toBe('ongoing');
    expect(tripStatus({ startDate: '2026-11-01', endDate: '2026-11-05' }, now)).toBe('past');
  });
  it('poslední den výletu ještě probíhá', () => {
    expect(tripStatus({ startDate: '2026-11-10', endDate: '2026-11-12' }, new Date('2026-11-12T23:30:00'))).toBe('ongoing');
  });
  it('počítá dny včetně krajních', () => {
    expect(tripDayCount(week)).toBe(7);
    expect(tripDayCount({ startDate: '2026-11-09', endDate: '2026-11-09' })).toBe(1);
  });
});

describe('buildDailyPlans', () => {
  it('vytvoří stránku pro každý den a doplní chybějící', () => {
    expect(weekDays).toHaveLength(7);
    expect(weekDays[0]).toMatchObject({ date: '2026-11-09', title: 'Příjezd', plan: 'Lisabon' });
    expect(weekDays[6]).toEqual(day('2026-11-15', { title: 'Den 7' }));
  });
});

describe('dayHasContent', () => {
  it('výchozí název dne bez plánu je prázdný den', () => {
    expect(dayHasContent(day('2026-11-10', { title: 'Den 2' }))).toBe(false);
    expect(dayHasContent(day('2026-11-10', { title: 'Day 2' }))).toBe(false);
  });
  it('plán, místo nebo vlastní název jsou obsah', () => {
    expect(dayHasContent(day('2026-11-10', { plan: 'x' }))).toBe(true);
    expect(dayHasContent(day('2026-11-10', { location: 'Porto' }))).toBe(true);
    expect(dayHasContent(day('2026-11-10', { title: 'Sintra' }))).toBe(true);
  });
});

describe('planDateChange (rozhodnutí 2026-11-12)', () => {
  it('posun o den se stejnou délkou: program jede s výletem, nic se nemaže', () => {
    expect(planDateChange(week, weekDays, '2026-11-10', '2026-11-16')).toEqual({
      offset: 0,
      lost: [],
      note: 'moved',
    });
  });
  it('posun o týden: program jede s výletem', () => {
    expect(planDateChange(week, weekDays, '2026-11-16', '2026-11-22')).toMatchObject({ offset: 0, lost: [] });
  });
  it('přidání dne na začátek: program zůstane u svých kalendářních dnů', () => {
    expect(planDateChange(week, weekDays, '2026-11-08', '2026-11-15')).toEqual({
      offset: -1,
      lost: [],
      note: 'kept',
    });
  });
  it('zkrácení začátku: den 1 s plánem se ztratí a hlásí se', () => {
    expect(planDateChange(week, weekDays, '2026-11-10', '2026-11-15')).toEqual({
      offset: 1,
      lost: [1],
      note: 'lost',
    });
  });
  it('zkrácení konce bez obsahu nic nehlásí', () => {
    expect(planDateChange(week, weekDays, '2026-11-09', '2026-11-12')).toEqual({
      offset: 0,
      lost: [],
      note: null,
    });
  });
});

describe('shiftDailyPlans', () => {
  it('bez posunu nechá plány u stejných dnů a přepíše data', () => {
    const shifted = shiftDailyPlans(t, weekDays, '2026-11-10', '2026-11-16', 0);
    expect(shifted[0]).toMatchObject({ date: '2026-11-10', title: 'Příjezd', plan: 'Lisabon' });
    expect(shifted[2]).toMatchObject({ date: '2026-11-12', plan: 'Sintra' });
  });
  it('při posunu přečísluje výchozí názvy, vlastní nechá', () => {
    const shifted = shiftDailyPlans(t, weekDays, '2026-11-08', '2026-11-15', -1);
    expect(shifted).toHaveLength(8);
    expect(shifted[0]).toEqual(day('2026-11-08', { title: 'Den 1' }));
    expect(shifted[1]).toMatchObject({ title: 'Příjezd', plan: 'Lisabon' });
    expect(shifted[2].title).toBe('Den 3');
  });
});

describe('computeReadiness', () => {
  const trip = {
    ...week,
    activities: weekDays,
    packingList: [
      { text: 'Pas', checked: true },
      { text: 'Nabíječka', checked: false },
    ],
    documents: [],
    expenses: [],
  } as unknown as Trip;

  it('váží itinerář, balení, místa a dokumenty', () => {
    // itinerář 2/7 × 40 + balení 1/2 × 30 + místa 15 = 11,4 + 15 + 15
    const { score, items } = computeReadiness(trip, 1);
    expect(score).toBe(41);
    expect(items.find((i) => i.key === 'places')?.done).toBe(true);
    expect(items.find((i) => i.key === 'documents')?.done).toBe(false);
  });
});

describe('quickDateRange', () => {
  it('ve čtvrtek: tento víkend = so–ne, příští o týden dál', () => {
    const thursday = new Date('2026-11-12T12:00:00');
    expect(quickDateRange('thisWeekend', thursday)).toEqual({ startDate: '2026-11-14', endDate: '2026-11-15' });
    expect(quickDateRange('nextWeekend', thursday)).toEqual({ startDate: '2026-11-21', endDate: '2026-11-22' });
  });
  it('v neděli: tento víkend je jen dnešek', () => {
    expect(quickDateRange('thisWeekend', new Date('2026-11-15T12:00:00'))).toEqual({
      startDate: '2026-11-15',
      endDate: '2026-11-15',
    });
  });
});
