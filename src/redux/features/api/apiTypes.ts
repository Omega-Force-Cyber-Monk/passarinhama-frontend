export interface StatsResponse {
  activeMembers: number;
  activeForumTopics: number;
  scheduledEvents: number;
  plannedTrainings: number;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  limit: number;
  total_pages: number;
  results: T[];
}

export interface CategoryQueryParams {
  page?: number;
  pageSize?: number;
  page_size?: number;
  limit?: number;
  search?: string | null;
}

export interface DynamicCategory {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
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
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
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
  role_id?: string | null;
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
  role_permissions?: ApiUserPermission[];
  permissions?: ApiUserPermission[];
  user_permissions?: ApiUserPermission[];
}
