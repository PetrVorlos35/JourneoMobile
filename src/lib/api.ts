import i18n from '@/lib/i18n';
import { getToken } from '@/lib/token-store';

// Stejné Express API jako web. Adresa je v .env.local (EXPO_PUBLIC_API_URL).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(
  /\/$/,
  '',
);

// Status 0 = požadavek vůbec nedošel na server (bez signálu, výpadek).
export class ApiError extends Error {
  status: number;
  code?: string;
  data: Record<string, unknown>;

  get isNetwork() {
    return this.status === 0;
  }

  constructor(status: number, data: Record<string, unknown>) {
    super(typeof data.error === 'string' ? data.error : i18n.t('app.errors.generic'));
    this.status = status;
    this.code = typeof data.code === 'string' ? data.code : undefined;
    this.data = data;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  // Token jiný než uložený (např. hned po přihlášení, než se uloží).
  token?: string | null;
};

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token !== undefined ? options.token : await getToken();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: i18n.t('app.errors.network') });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export type User = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  is_guest?: boolean;
  guest_seconds_left?: number;
};

type AuthResponse = { token: string; user: User };

export const authApi = {
  me: (token?: string) => request<{ user: User }>('/auth/me', { token }),
  guest: (language: 'cs' | 'en') =>
    request<AuthResponse>('/auth/guest', { method: 'POST', body: { language } }),
  claimGuest: (guestToken: string, token: string) =>
    request<{ movedTrips: number }>('/auth/guest/claim', {
      method: 'POST',
      body: { guestToken },
      token,
    }),
  checkEmail: (email: string) =>
    request<{ exists: boolean }>('/auth/check-email', { method: 'POST', body: { email } }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (email: string, password: string) =>
    request<{ message: string }>('/auth/register', { method: 'POST', body: { email, password } }),
  verify: (email: string, code: string) =>
    request<AuthResponse>('/auth/verify', { method: 'POST', body: { email, code } }),
  resendOtp: (email: string) =>
    request<{ message: string }>('/auth/resend-otp', { method: 'POST', body: { email } }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  verifyResetCode: (email: string, code: string) =>
    request<{ valid: boolean }>('/auth/verify-reset-code', {
      method: 'POST',
      body: { email, code },
    }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { email, code, new_password: newPassword },
    }),
  updateProfile: (fields: { first_name: string | null; last_name: string | null }, token: string) =>
    request<{ user: User }>('/auth/profile', { method: 'PUT', body: fields, token }),
};
