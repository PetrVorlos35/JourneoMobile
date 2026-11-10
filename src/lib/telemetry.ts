import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { API_URL, ApiError } from '@/lib/api';
import { getToken } from '@/lib/token-store';

// ── Analytika a hlídání chyb ────────────────────────────────
// Stejné endpointy jako web (/api/collect/events a /api/collect/error), v adminu
// se cesty appky poznají podle předpony app:/. Při vývoji se nic neposílá,
// mobil totiž mluví s produkčním API a zaplevelil by statistiky.

const ENABLED = !__DEV__ || process.env.EXPO_PUBLIC_TELEMETRY === '1';
const FLUSH_DELAY = 1500;
const MAX_ERRORS = 10;

// Server podle User-Agentu pozná mobil/tablet a odfiltruje boty; výchozí
// CFNetwork/okhttp hlavička by vypadala jako desktop, nebo rovnou jako bot.
const version = Constants.expoConfig?.version ?? '0';
const USER_AGENT =
  Platform.OS === 'ios'
    ? `Journeo/${version} (${Platform.isPad ? 'iPad' : 'iPhone'}; iOS ${Platform.Version})`
    : `Journeo/${version} (Android ${Platform.Version}; Mobile)`;

type CollectEvent = { name: string; path: string; props?: Record<string, unknown> };

let currentPath = 'app:/';
let queue: CollectEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const seenErrors = new Set<string>();

async function post(endpoint: string, body: unknown) {
  const token = await getToken().catch(() => null);
  await fetch(`${API_URL}/collect/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  while (queue.length) post('events', { events: queue.splice(0, 20) });
}

function enqueue(event: CollectEvent) {
  if (!ENABLED) return;
  queue.push(event);
  if (!timer) timer = setTimeout(flush, FLUSH_DELAY);
}

// Před odchodem z appky odeslat, co čeká ve frontě.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') flush();
});

// Segmenty expo-routeru včetně skupin, ať se úvod „/“ neplete s přehledem „/“:
// ['(tabs)', '(prehled)'] → app:/tabs/prehled, dynamické části zůstávají jako [id].
export const pathFromSegments = (segments: string[]) =>
  `app:/${segments.map((s) => s.replace(/^\((.*)\)$/, '$1')).join('/')}`;

export function trackScreen(path: string) {
  if (path === currentPath) return;
  currentPath = path;
  enqueue({ name: 'pageview', path });
}

// Stejné názvy událostí jako na webu (např. expense_added), props jen ploché a krátké.
export function track(name: string, props?: Record<string, string | number | boolean>) {
  enqueue({ name, path: currentPath, props });
}

export function reportError(error: unknown, extra: { componentStack?: string } = {}) {
  // Chyby API zapisuje server sám, výpadky sítě nejsou chyba appky.
  if (error instanceof ApiError) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message.trim();
  if (!message) return;
  const stack = err.stack ?? '';
  const key = `${message}|${stack.split('\n')[1] ?? ''}`;
  if (seenErrors.has(key) || seenErrors.size >= MAX_ERRORS) return;
  seenErrors.add(key);
  if (!ENABLED) return;

  post('error', {
    message: message.slice(0, 500),
    stack: [stack, extra.componentStack ? `\nComponent stack:${extra.componentStack}` : '']
      .join('')
      .slice(0, 8000),
    path: currentPath,
  });
}

// Neodchycené chyby v JS: nahlásit a nechat proběhnout původní obsluhu
// (při vývoji červená obrazovka, v produkci pád appky).
export function installErrorReporting() {
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error);
    previous(error, isFatal);
  });
}
