import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import { reportError } from '@/lib/telemetry';

// Uvítací checklist u prvního založeného výletu (jako utils/onboarding.js na webu).
// Pamatuje si jen jeden výlet a jestli ho uživatel zavřel; uložené v zařízení.
const WELCOME_KEY = 'journeo_welcome';

export type Welcome = {
  tripId: string;
  source: 'starter' | 'copy';
  prefilledPacking?: boolean;
  invited: boolean;
  dismissed: boolean;
};

async function read(): Promise<Welcome | null> {
  try {
    const raw = await SecureStore.getItemAsync(WELCOME_KEY);
    return raw ? (JSON.parse(raw) as Welcome) : null;
  } catch {
    return null;
  }
}

const write = (value: Welcome) =>
  SecureStore.setItemAsync(WELCOME_KEY, JSON.stringify(value)).catch(reportError);

export const startWelcome = (
  tripId: string,
  source: Welcome['source'] = 'starter',
  extra: Partial<Welcome> = {},
) => write({ tripId, source, invited: false, dismissed: false, ...extra });

// Checklist pro daný výlet, nebo null (jiný výlet / zavřený / nic uložené).
export function useWelcome(tripId: string) {
  const [welcome, setWelcome] = useState<Welcome | null>(null);

  useEffect(() => {
    let active = true;
    read().then((w) => {
      if (active) setWelcome(w && w.tripId === tripId && !w.dismissed ? w : null);
    });
    return () => {
      active = false;
    };
  }, [tripId]);

  const dismiss = useCallback(() => {
    setWelcome((w) => {
      if (w) write({ ...w, dismissed: true });
      return null;
    });
  }, []);

  return { welcome, dismiss };
}
