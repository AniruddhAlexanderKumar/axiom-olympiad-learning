import { Platform } from 'react-native';

declare const __DEV__: boolean | undefined;

const devFallback =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

/**
 * EXPO_PUBLIC_API_URL may be an absolute origin (http://localhost:4000) or "/"
 * for same-origin deployments, where the API also serves the web client.
 * A production web build with no configured URL talks to its own origin.
 */
const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
const isProductionWeb = Platform.OS === 'web' && typeof __DEV__ !== 'undefined' && !__DEV__;

export const API_URL = (configured || (isProductionWeb ? '' : devFallback)).replace(/\/+$/, '');
export const API_BASE = `${API_URL}/api`;

export function apiOriginLabel(): string {
  if (API_URL) return API_URL;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'the API';
}

let token: string | null = null;

export function setToken(value: string | null): void {
  token = value;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, `Cannot reach the API at ${apiOriginLabel()}. Is the server running?`);
  }

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid API response');
      payload = parsed as Record<string, unknown>;
    } catch {
      const message = response.status >= 500
        ? 'Zumi’s server is temporarily unavailable. Try again shortly.'
        : 'Zumi’s API returned an unexpected response. Try again shortly.';
      throw new ApiError(response.status, message);
    }
  }
  if (!response.ok) {
    throw new ApiError(response.status, String(payload.error ?? 'Request failed.'), payload.details);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
};
