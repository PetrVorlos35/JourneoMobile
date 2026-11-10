import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { ApiError, authApi, type User } from '@/lib/api';
import { currentLanguage } from '@/lib/i18n';
import {
  clearAll,
  clearGuestToken,
  getCachedUser,
  getDestination,
  getGuestToken,
  getToken,
  setCachedUser,
  setDestination,
  setGuestToken,
  setToken,
} from '@/lib/token-store';

type SessionContextValue = {
  // 'loading' = čte se uložený token, drží se splash screen.
  status: 'loading' | 'ready';
  user: User | null;
  isGuest: boolean;
  firstTrip: string | null;
  startAsGuest: (destination: string) => Promise<void>;
  // Po přihlášení / ověření e-mailu: uloží token a převede výlety hosta.
  completeAuth: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [firstTrip, setFirstTrip] = useState<string | null>(null);

  useEffect(() => {
    async function restore() {
      const token = await getToken();
      if (!token) return;
      setFirstTrip(await getDestination());
      try {
        const { user } = await authApi.me(token);
        setUser(user);
        await setCachedUser(user);
      } catch (err) {
        // Bez signálu pustíme dál posledního známého uživatele, neplatný token smažeme.
        if (err instanceof ApiError && err.status === 0) {
          setUser(await getCachedUser<User>());
        } else {
          await clearAll();
          setFirstTrip(null);
        }
      }
    }
    restore().finally(() => setStatus('ready'));
  }, []);

  async function startAsGuest(destination: string) {
    const { token, user } = await authApi.guest(currentLanguage());
    await Promise.all([
      setToken(token),
      setGuestToken(token),
      setDestination(destination),
      setCachedUser(user),
    ]);
    setFirstTrip(destination);
    setUser(user);
  }

  async function completeAuth(token: string, nextUser: User) {
    await setToken(token);
    const guestToken = await getGuestToken();
    if (guestToken && guestToken !== token) {
      // Stejně jako web: převod výletů ze zkoušky nesmí zablokovat přihlášení.
      await authApi.claimGuest(guestToken, token).catch(() => undefined);
      await clearGuestToken();
    }
    await setCachedUser(nextUser);
    setUser(nextUser);
  }

  async function signOut() {
    await clearAll();
    setFirstTrip(null);
    setUser(null);
  }

  const value: SessionContextValue = {
    status,
    user,
    isGuest: Boolean(user?.is_guest),
    firstTrip,
    startAsGuest,
    completeAuth,
    signOut,
  };

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error('useSession musí být uvnitř SessionProvider');
  return ctx;
}
