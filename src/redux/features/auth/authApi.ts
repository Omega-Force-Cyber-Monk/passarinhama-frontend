import { apiSlice } from '../api/apiSlice';
import { 
  LoginRequest, 
  SignupRequest, 
  SendOtpRequest, 
  VerifyOtpRequest,
  VerifyOtpResponse,
  ForgotPasswordRequest,
  AuthResponse, 
  UserProfile,
  UserProfileApiResponse,
  UserRoleDetails,
  ResetPasswordRequest 
} from './authTypes';

const buildFormBody = (entries: Array<[string, string | undefined]>) => {
  const body = new URLSearchParams();

  entries.forEach(([key, value]) => {
    if (value !== undefined) {
      body.append(key, value);
    }
  });

  return body.toString();
};

const normalizeRole = (role: string | UserRoleDetails | null | undefined) => {
  if (!role) return '';
  return typeof role === 'string' ? role : role.slug || role.name;
};

const normalizeAuthResponse = (response: AuthResponse): AuthResponse => ({
  ...response,
  role: response.role ?? response.role_slug ?? '',
});

const normalizeVerifyOtpResponse = (
  response: VerifyOtpResponse,
): VerifyOtpResponse => ({
  ...response,
  sessionKey: response.sessionKey ?? response.session_key,
});

export const normalizeUserProfile = (user: UserProfileApiResponse): UserProfile => ({
  ...user,
  role: normalizeRole(user.role),
  is_superuser: user.is_superuser ?? false,
  role_details: typeof user.role === 'string' ? null : user.role,
  permissions: user.permissions ?? [],
  user_permissions: user.user_permissions ?? [],
});

export const authApi = apiSlice.injectEndpoints({

  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: buildFormBody([
          ['email', credentials.email],
          ['password', credentials.password],
          ['otp_value', credentials.otp_value ?? ''],
        ]),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
      transformResponse: (response: AuthResponse) =>
        normalizeAuthResponse(response),
    }),
    signup: builder.mutation<AuthResponse, SignupRequest>({
      query: (userData) => ({
        url: '/auth/signup',
        method: 'POST',
        body: buildFormBody(
          Object.entries(userData) as Array<[string, string | undefined]>,
        ),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
      transformResponse: (response: AuthResponse) =>
        normalizeAuthResponse(response),
    }),
    sendOtp: builder.mutation<{ status: string; message: string; purpose: string }, SendOtpRequest>({
      query: (data) => {
        const body = new URLSearchParams();
        body.append('email', data.email);
        body.append('purpose', data.purpose);
        
        return {
          url: '/auth/send_otp',
          method: 'POST',
          body: body.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        };
      },
    }),
    refresh: builder.mutation<{ access_token: string; refresh_token: string; token_type: string }, string>({
      query: (refreshToken) => ({
        url: '/auth/refresh',
        method: 'POST',
        body: JSON.stringify(refreshToken),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    }),
    getMe: builder.query<UserProfile, void>({
      query: () => '/user/users/me',
      transformResponse: (response: UserProfileApiResponse) =>
        normalizeUserProfile(response),
      providesTags: [{ type: 'User', id: 'ME' }],
    }),
    verifyOtp: builder.mutation<VerifyOtpResponse, VerifyOtpRequest>({
      query: (data) => {
        const body = new URLSearchParams();
        body.append('email', data.email);
        body.append('otp_value', data.otp_value);
        body.append('purpose', data.purpose);
        
        return {
          url: '/auth/verify_otp',
          method: 'POST',
          body: body.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        };
      },
      transformResponse: (response: VerifyOtpResponse) =>
        normalizeVerifyOtpResponse(response),
    }),
    forgotPassword: builder.mutation<{ message: string }, ForgotPasswordRequest>({
      query: (data) => {
        const body = new URLSearchParams();
        body.append('email', data.email);
        body.append('new_password', data.new_password);
        body.append('session_key', data.session_key);
        
        return {
          url: '/auth/forgot_password',
          method: 'POST',
          body: body.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        };
      },
    }),
    resetPassword: builder.mutation<{ message: string }, ResetPasswordRequest>({
      query: (data) => {
        const body = new URLSearchParams();
        body.append('old_password', data.old_password);
        body.append('new_password', data.new_password);
        
        return {
          url: '/auth/reset_password',
          method: 'POST',
          body: body.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        };
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useSignupMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useForgotPasswordMutation,
  useRefreshMutation,
  useGetMeQuery,
  useResetPasswordMutation,
} = authApi;
