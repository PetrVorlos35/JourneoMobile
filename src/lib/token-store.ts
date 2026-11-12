import * as SecureStore from 'expo-secure-store';

// Stejné klíče jako localStorage na webu.
const TOKEN_KEY = 'journeo_token';
// Token hosta držíme zvlášť, aby po registraci šly jeho výlety převést (guest/claim).
const GUEST_TOKEN_KEY = 'journeo_guest_token';
const DESTINATION_KEY = 'journeo_first_destination';
// Poslední známý uživatel, aby appka bez signálu neskončila na úvodu.
const USER_KEY = 'journeo_user';

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);

export const getGuestToken = () => SecureStore.getItemAsync(GUEST_TOKEN_KEY);
export const setGuestToken = (token: string) => SecureStore.setItemAsync(GUEST_TOKEN_KEY, token);
export const clearGuestToken = () => SecureStore.deleteItemAsync(GUEST_TOKEN_KEY);

// Cíl z úvodu („Kam jedeš?“), dokud z něj nevznikne výlet s termínem.
export const getDestination = () => SecureStore.getItemAsync(DESTINATION_KEY);
export const setDestination = (value: string) => SecureStore.setItemAsync(DESTINATION_KEY, value);
export const clearDestination = () => SecureStore.deleteItemAsync(DESTINATION_KEY);

export async function getCachedUser<T>(): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export const setCachedUser = (user: unknown) =>
  SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

export async function clearAll() {
  await Promise.all(
    [TOKEN_KEY, GUEST_TOKEN_KEY, DESTINATION_KEY, USER_KEY].map((key) =>
      SecureStore.deleteItemAsync(key),
    ),
  );
}
