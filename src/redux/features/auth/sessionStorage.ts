// Credentials are committed atomically so other tabs cannot observe mixed token pairs.
// This replaces the legacy individual keys; no profile or permission JSON is persisted.
export const SESSION_STORAGE_KEY = 'archicopro-session';
export interface StoredSession { id: string; token: string | null; refreshToken: string | null }
export const newSessionId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
export function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value.id !== 'string' || !(value.token === null || typeof value.token === 'string') ||
      !(value.refreshToken === null || typeof value.refreshToken === 'string')) return null;
    return value;
  } catch { return null; }
}
export function writeStoredSession(session: StoredSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}
export function restoreStoredSession(): StoredSession {
  const current = readStoredSession();
  localStorage.removeItem('user');
  if (current) return current;
  const legacy = { id: newSessionId(), token: localStorage.getItem('token'), refreshToken: localStorage.getItem('refreshToken') };
  writeStoredSession(legacy);
  return legacy;
}
// Non-browser store tests can use their existing lightweight storage stubs.
export const browserSessionChanged = (id: string) =>
  typeof window !== 'undefined' && readStoredSession()?.id !== id;
