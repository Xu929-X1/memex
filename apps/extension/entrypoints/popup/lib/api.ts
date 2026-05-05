import { browser } from 'wxt/browser';

export const API = import.meta.env.WXT_API_URL;

export async function authedFetch(path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, { ...init, credentials: 'include' });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed: ${r.status}`);
  }
  return r;
}

export async function isAuthed(): Promise<boolean> {
  const c = await browser.cookies.get({ url: API, name: 'auth_token' });
  return !!c;
}

export async function login(identifier: string, password: string) {
  const r = await authedFetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  return r.json();
}

export async function logout() {
  await authedFetch('/api/v1/auth/logout', { method: 'POST' });
}

export async function fetchDocuments(): Promise<unknown[]> {
  const r = await authedFetch('/api/v1/documents');
  const body = await r.json();
  return Array.isArray(body?.data) ? body.data : [];
}

export interface ExtensionPreference {
  trackAllActivities: boolean;
  trackURLs: string[];
}

function unwrapPreference(body: unknown): ExtensionPreference {
  const data = (body as { data?: ExtensionPreference } | null)?.data;
  return {
    trackAllActivities: !!data?.trackAllActivities,
    trackURLs: Array.isArray(data?.trackURLs) ? data!.trackURLs : [],
  };
}

export async function getPreference(): Promise<ExtensionPreference> {
  const r = await authedFetch('/api/v1/browser-extension/preference');
  return unwrapPreference(await r.json());
}

export async function updatePreference(
  patch: Partial<ExtensionPreference>,
): Promise<ExtensionPreference> {
  const r = await authedFetch('/api/v1/browser-extension/preference', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return unwrapPreference(await r.json());
}
