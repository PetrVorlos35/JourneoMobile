import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { Trip } from '@/lib/api';
import i18n from '@/lib/i18n';

// Výzva k registraci, když host narazí na limit (jako openGuestUpsell na webu).
export function showGuestLimit() {
  Alert.alert(i18n.t('guest.upsell.limit.title'), i18n.t('guest.upsell.limit.text'), [
    { text: i18n.t('guest.upsell.later'), style: 'cancel' },
    { text: i18n.t('guest.upsell.cta'), onPress: () => router.push('/prihlaseni') },
  ]);
}

// Host má jeden vlastní výlet (ukázka se nepočítá), další až po registraci.
export const guestLimitReached = (isGuest: boolean, trips: Trip[] | undefined) =>
  isGuest && !!trips?.some((trip) => !trip.isSample && trip.role === 'owner');

export function openNewTrip(isGuest: boolean, trips: Trip[] | undefined, plan?: string) {
  if (guestLimitReached(isGuest, trips)) {
    showGuestLimit();
    return;
  }
  router.push(plan ? { pathname: '/novy-vylet', params: { plan } } : '/novy-vylet');
}

// Detail výletu se otevírá v tabu, ze kterého uživatel přišel (zůstanou taby dole).
export function openTrip(id: string, tab: 'prehled' | 'vylety' = 'prehled') {
  router.push(
    tab === 'prehled'
      ? { pathname: '/(tabs)/(prehled)/vylet/[id]', params: { id } }
      : { pathname: '/(tabs)/(vylety)/vylet/[id]', params: { id } },
  );
}
