export interface StatsResponse {
  activeMembers: number;
  activeForumTopics: number;
  scheduledEvents: number;
  plannedTrainings: number;
}

export interface ApiUserRoleDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface ApiUserPermission {
  id?: string;
  role_id?: string;
  user_id?: string;
  feature: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface CurrentUserApiResponse {
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
  role: string | ApiUserRoleDetails | null;
  is_superuser?: boolean;
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
  permissions?: ApiUserPermission[];
  user_permissions?: ApiUserPermission[];
}
