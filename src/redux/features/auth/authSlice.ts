
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
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('token'),
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
      const { access_token, refresh_token, user, role } = action.payload;
      state.token = access_token;
      if (refresh_token) {
        state.refreshToken = refresh_token;
        localStorage.setItem('refreshToken', refresh_token);
      }
      state.isAuthenticated = true;
      localStorage.setItem('token', access_token);
      
      if (user) {
        const mappedUser = mapUserProfile(user);
        state.user = mappedUser;
        localStorage.setItem('user', JSON.stringify(mappedUser));
      } else if (role) {
        // Initialize minimal user with role if full user object is not provided yet
        const minimalUser = { role, permissions: [], user_permissions: [] } as UserProfile;
        state.user = minimalUser;
        localStorage.setItem('user', JSON.stringify(minimalUser));
      }
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

export const { setCredentials, setUser, logout, updateRole } = authSlice.actions;
export default authSlice.reducer;
