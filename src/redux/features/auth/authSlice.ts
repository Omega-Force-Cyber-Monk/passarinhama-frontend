
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserProfile, AuthState } from './authTypes';

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

const initialState: AuthState = {
  // Persisted profile/role data is never authorization evidence for a restored session.
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: false,
  status: localStorage.getItem('token') ? 'initializing' : 'unauthenticated',
  permissionsStatus: localStorage.getItem('token') ? 'loading' : 'unknown',
  sessionVersion: 0,
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
      const { access_token, refresh_token, user } = action.payload;
      state.token = access_token;
      if (refresh_token) {
        state.refreshToken = refresh_token;
        localStorage.setItem('refreshToken', refresh_token);
      }
      state.sessionVersion += 1;
      state.user = null;
      state.status = 'initializing';
      state.permissionsStatus = 'loading';
      state.isAuthenticated = false;
      state.error = null;
      if (!refresh_token) {
        state.refreshToken = null;
        localStorage.removeItem('refreshToken');
      }
      localStorage.setItem('token', access_token);
      
      if (user) {
        const mappedUser = mapUserProfile(user);
        state.user = mappedUser;
        localStorage.setItem('user', JSON.stringify(mappedUser));
      }
    },
    tokenRefreshed: (state, action: PayloadAction<{ access_token: string; refresh_token?: string; sessionVersion: number }>) => {
      if (state.sessionVersion !== action.payload.sessionVersion || !state.token) return;
      state.token = action.payload.access_token;
      localStorage.setItem('token', state.token);
      if (action.payload.refresh_token) {
        state.refreshToken = action.payload.refresh_token;
        localStorage.setItem('refreshToken', state.refreshToken);
      }
    },
    sessionResolved: (state, action: PayloadAction<{ user: UserProfile; sessionVersion: number }>) => {
      if (state.sessionVersion !== action.payload.sessionVersion || !state.token) return;
      state.user = mapUserProfile(action.payload.user);
      state.status = 'authenticated';
      state.permissionsStatus = 'ready';
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('user', JSON.stringify(state.user));
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
      localStorage.setItem('user', JSON.stringify(mappedUser));
    },

    updateRole: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.role = action.payload;
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
    logout: (state) => {
      state.sessionVersion += 1;
      state.status = 'unauthenticated';
      state.permissionsStatus = 'unknown';
      state.error = null;
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    },
  },
});

export const { setCredentials, setUser, logout, updateRole, tokenRefreshed, sessionResolved, sessionFailed, retrySession } = authSlice.actions;
export default authSlice.reducer;
