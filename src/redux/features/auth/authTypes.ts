import type {
  ApiUserPermission,
  ApiUserRoleDetails,
  CurrentUserApiResponse,
} from '../api/apiTypes';

export interface LoginRequest {
  email: string;
  password: string;
  otp_value?: string;
}

export interface SignupRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  otp_value: string;
  role: string;
}

export interface SendOtpRequest {
  email: string;
  purpose: 'signup' | 'forgot_password' | 'login';
}

export interface VerifyOtpRequest {
  email: string;
  otp_value: string;
  purpose: 'signup' | 'forgot_password' | 'login';
}

export interface VerifyOtpResponse {
  status: string;
  session_key: string;
  sessionKey?: string;
}

export interface ForgotPasswordRequest {
  email: string;
  new_password: string;
  session_key: string;
}

export interface ResetPasswordRequest {
  old_password: string;
  new_password: string;
}


export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role?: string;
  role_slug?: string;
  status: string;
  message?: string;
}

export const ROLE_SLUGS = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'membre',
  AUDITOR: 'auditeur',
  TECHNICOPRO_PARTNER: 'partenaires_technicopro',
  COPROPRIETAIRE_COMMITTEE: 'comite_coproprietaire',
} as const;

export type SystemRoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];

export const normalizeRoleSlug = (role?: string | null) =>
  role?.trim().toLowerCase().replace(/\s+/g, '_') ?? '';

export type UserRoleDetails = ApiUserRoleDetails;

export type UserPermission = ApiUserPermission;

export interface UserProfileApiResponse extends CurrentUserApiResponse {}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  initials: string | null;
  avatar_url: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  city: string | null;
  society: string | null;
  department: string | null;
  role: string;
  is_superuser: boolean;
  role_details?: UserRoleDetails | null;
  status: string;
  is_payment_validated: boolean;
  membership_year: number | null;
  is_email_verified: boolean;
  is_online: boolean;
  last_seen_at: string | null;
  member_since: string | null;
  last_login_at: string | null;
  created_at: string;
  is_deleted: boolean;
  permissions: UserPermission[];
  user_permissions: UserPermission[];
  street_address?: string | null;
  postal_code?: string | null;
  country?: string | null;
  company_name?: string | null;
  company_role?: string | null;
  company_website?: string | null;
  company_siret?: string | null;
  years_as_member?: number | null;
  
  // Mapping for compatibility with existing UI components
  firstName?: string;
  lastName?: string;
  avatarInitials?: string;
  memberSince?: string;
  isPaymentValidated?: boolean;
}


export interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  status: 'initializing' | 'authenticated' | 'unauthenticated' | 'error';
  permissionsStatus: 'unknown' | 'loading' | 'ready' | 'error';
  sessionVersion: number;
  error: number | string | null;
}
