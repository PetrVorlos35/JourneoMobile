import { useCallback, useEffect, useRef, useState } from 'react';

import { reportError } from '@/lib/telemetry';

type State<T> = {
  data: T | undefined;
  error: unknown;
  // Poprvé se načítá (skeleton), nebo se znovu načítá tažením dolů (refreshing).
  loading: boolean;
  refreshing: boolean;
};

// Načtení dat pro obrazovku. Při změně `key` se načte znovu, `null` = zatím nenačítat.
// Obrazovka podle stavu ukáže skeleton (loading), ErrorState (error bez dat),
// prázdný stav (prázdná data), nebo obsah.
export function useApi<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({
    data: undefined,
    error: null,
    loading: key !== null,
    refreshing: false,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // Pomalejší starší odpověď nesmí přepsat novější.
  const requestId = useRef(0);

  const load = useCallback(async (mode: 'load' | 'refresh') => {
    const id = ++requestId.current;
    setState((s) => ({
      ...s,
      error: null,
      loading: mode === 'load' && s.data === undefined,
      refreshing: mode === 'refresh',
    }));
    try {
      const data = await fetcherRef.current();
      if (id === requestId.current) {
        setState({ data, error: null, loading: false, refreshing: false });
      }
    } catch (error) {
      reportError(error);
      // Stará data při neúspěšném obnovení necháváme zobrazená.
      if (id === requestId.current) {
        setState((s) => ({ ...s, error, loading: false, refreshing: false }));
      }
    }
  }, []);

  useEffect(() => {
    if (key !== null) load('load');
  }, [key, load]);

  return {
    ...state,
    reload: useCallback(() => load('load'), [load]),
    refresh: useCallback(() => load('refresh'), [load]),
    // Úprava dat po vlastní akci (optimistické smazání, undo) bez nového načtení.
    setData: useCallback(
      (update: (data: T | undefined) => T | undefined) =>
        setState((s) => ({ ...s, data: update(s.data) })),
      [],
    ),
  };
}
