
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile, AuthState } from './authTypes';
import { newSessionId, restoreStoredSession, writeStoredSession, browserSessionChanged, type StoredSession } from './sessionStorage';

const mapUserProfile = (user: UserProfile): UserProfile => {
  const avatarInitials =
    user.initials ||
    user.avatarInitials ||
    `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();

  return {
    ...user,
    firstName: user.firstName || user.first_name,
    lastName: user.lastName || user.last_name,
    first_name: user.first_name || user.firstName || null,
    last_name: user.last_name || user.lastName || null,
    avatarInitials,
    isPaymentValidated: user.is_payment_validated || user.isPaymentValidated,
    memberSince: user.member_since || user.memberSince,
    permissions: user.permissions ?? [],
    user_permissions: user.user_permissions ?? [],
  };
};

const stored = restoreStoredSession();
const initialState: AuthState = {
  // Persisted profile/role data is never authorization evidence for a restored session.
  user: null,
  token: stored.token,
  refreshToken: stored.refreshToken,
  isAuthenticated: false,
  status: stored.token ? 'initializing' : 'unauthenticated',
  permissionsStatus: stored.token ? 'loading' : 'unknown',
  sessionVersion: 0,
  sessionId: stored.id,
  profileRequestOrder: 0,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        access_token: string;
        refresh_token?: string;
        role?: string;
        user?: UserProfile;
      }>
    ) => {
      const { access_token, refresh_token } = action.payload;
      state.token = access_token;
      state.refreshToken = refresh_token || null;
      state.sessionId = newSessionId();
      state.profileRequestOrder = 0;
      state.sessionVersion += 1;
      state.user = null;
      state.status = 'initializing';
      state.permissionsStatus = 'loading';
      state.isAuthenticated = false;
      state.error = null;
      writeStoredSession({ id: state.sessionId, token: state.token, refreshToken: state.refreshToken });
    },
    tokenRefreshed: (state, action: PayloadAction<{ access_token: string; refresh_token?: string; sessionVersion: number }>) => {
      if (state.sessionVersion !== action.payload.sessionVersion || !state.token || browserSessionChanged(state.sessionId)) return;
      state.token = action.payload.access_token;
      if (action.payload.refresh_token) {
        state.refreshToken = action.payload.refresh_token;
      }
      writeStoredSession({ id: state.sessionId, token: state.token, refreshToken: state.refreshToken });
    },
    sessionResolved: (state, action: PayloadAction<{ user: UserProfile; sessionVersion: number; requestOrder?: number }>) => {
      if (state.sessionVersion !== action.payload.sessionVersion || !state.token) return;
      if (action.payload.requestOrder !== undefined && action.payload.requestOrder < state.profileRequestOrder) return;
      if (action.payload.requestOrder !== undefined) state.profileRequestOrder = action.payload.requestOrder;
      state.user = mapUserProfile(action.payload.user);
      state.status = 'authenticated';
      state.permissionsStatus = 'ready';
      state.isAuthenticated = true;
      state.error = null;
    },
    sessionFailed: (state, action: PayloadAction<{ error: number | string; sessionVersion: number }>) => {
      if (state.sessionVersion !== action.payload.sessionVersion || !state.token) return;
      // A background failure does not discard an already resolved identity.
      if (state.status === 'authenticated') return;
      state.status = 'error';
      state.permissionsStatus = 'error';
      state.error = action.payload.error;
    },
    retrySession: (state) => {
      if (!state.token || state.status !== 'error') return;
      state.status = 'initializing';
      state.permissionsStatus = 'loading';
      state.error = null;
    },
    setUser: (state, action: PayloadAction<UserProfile>) => {
      const mappedUser = mapUserProfile(action.payload);
      state.user = mappedUser;
    },

    updateRole: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.role = action.payload;
      }
    },
    logout: (state) => {
      // A late request from an obsolete tab must not remove another login's credentials.
      const obsolete = browserSessionChanged(state.sessionId);
      state.sessionVersion += 1;
      state.status = 'unauthenticated';
      state.permissionsStatus = 'unknown';
      state.error = null;
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.profileRequestOrder = 0;
      state.sessionId = newSessionId();
      if (!obsolete) writeStoredSession({ id: state.sessionId, token: null, refreshToken: null });
    },
    sessionReplaced: (state, action: PayloadAction<StoredSession>) => {
      state.sessionVersion += 1;
      state.sessionId = action.payload.id;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = null;
      state.isAuthenticated = false;
      state.status = state.token ? 'initializing' : 'unauthenticated';
      state.permissionsStatus = state.token ? 'loading' : 'unknown';
      state.profileRequestOrder = 0;
      state.error = null;
    },
    tokenSynchronized: (state, action: PayloadAction<StoredSession>) => {
      if (state.sessionId !== action.payload.id) return;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
    },
  },
});

export const { setCredentials, setUser, logout, updateRole, tokenRefreshed, sessionResolved, sessionFailed, retrySession, sessionReplaced, tokenSynchronized } = authSlice.actions;
export default authSlice.reducer;
