// Ukázková data, dokud appka nebude napojená na API.

export type TripStatus = 'upcoming' | 'ongoing' | 'past';

export type Trip = {
  id: number;
  title: string;
  dates: string;
  status: TripStatus;
  note: string;
  emoji: string;
};

export const nextTrip = {
  title: 'Portugalsko',
  subtitle: 'Lisabon & Algarve',
  dates: '21.–27. listopadu',
  daysLeft: 12,
  dayCount: 7,
  placeCount: 16,
  people: ['P', 'A', 'T'],
};

export const readiness = [
  { key: 'itinerary', label: 'Itinerář', detail: 'Naplánováno 5 ze 7 dní', done: false },
  { key: 'packing', label: 'Balení', detail: 'Sbaleno 18 z 32', done: false },
  { key: 'places', label: 'Místa', detail: '16 míst na mapě', done: true },
  { key: 'documents', label: 'Dokumenty', detail: '3 dokumenty', done: true },
] as const;

export const budget = { spent: 8420, target: 15000, currency: 'Kč' };

export const trips: Trip[] = [
  {
    id: 79,
    title: 'Portugalsko: Lisabon & Algarve',
    dates: '21.–27. 11. 2026',
    status: 'upcoming',
    note: 'Za 12 dní',
    emoji: '🇵🇹',
  },
  {
    id: 64,
    title: 'Vídeň na advent',
    dates: '12.–13. 12. 2026',
    status: 'upcoming',
    note: 'Za 33 dní',
    emoji: '🇦🇹',
  },
  {
    id: 51,
    title: 'Krkonoše s partou',
    dates: '3.–5. 10. 2026',
    status: 'past',
    note: '3 dny · 9 míst',
    emoji: '🏔️',
  },
];

export function formatMoney(value: number, currency: string) {
  return `${value.toLocaleString('cs-CZ').replace(/,/g, ' ')} ${currency}`;
}
