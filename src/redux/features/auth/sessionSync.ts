import { sessionReplaced, tokenSynchronized } from './authSlice';
import { readStoredSession, SESSION_STORAGE_KEY } from './sessionStorage';
import type { RootState } from '../../store';
import type { Dispatch } from '@reduxjs/toolkit';

type SessionStore = { getState: () => unknown; dispatch: Dispatch };
export function synchronizeSession(store: SessionStore) {
  if (typeof window === 'undefined') return;
  const stored = readStoredSession();
  const current = (store.getState() as RootState).auth;
  if (!stored) {
    if (current.token) store.dispatch(sessionReplaced({ id: '', token: null, refreshToken: null }));
  } else if (stored.id !== current.sessionId) {
    store.dispatch(sessionReplaced(stored));
  } else if (stored.token !== current.token || stored.refreshToken !== current.refreshToken) {
    store.dispatch(tokenSynchronized(stored));
  }
}
export function listenForSessionChanges(store: SessionStore) {
  if (typeof window === 'undefined') return () => {};
  const storage = (event: StorageEvent) => {
    if (event.key === SESSION_STORAGE_KEY || event.key === null) synchronizeSession(store);
  };
  const focus = () => synchronizeSession(store);
  window.addEventListener('storage', storage);
  window.addEventListener('focus', focus);
  return () => { window.removeEventListener('storage', storage); window.removeEventListener('focus', focus); };
}
// Serializes rotating refresh tokens across same-origin tabs where Web Locks exists.
export const withRefreshLock = <T>(run: () => Promise<T>): Promise<T> =>
  typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('archicopro-session-refresh', run) : run();
