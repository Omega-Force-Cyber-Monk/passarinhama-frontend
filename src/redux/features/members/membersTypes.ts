export interface MembershipCategory {
  id: string;
  name: string;
  code: string;
}

export interface UserRoleDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export type UserRolesResponse = UserRoleDetails[];

export interface CreateUserRoleRequest {
  name: string;
  description?: string | null;
}

export interface UpdateUserRoleRequest {
  id: string;
  name: string;
  description?: string | null;
}

export interface DeleteUserRoleRequest {
  id: string;
}

export interface UserPermission {
  id?: string;
  role_id?: string;
  user_id?: string;
  feature: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export type UserPermissionsResponse = UserPermission[];

export interface GetUserPermissionsQueryParams {
  role_id: string;
}

export interface CreateUserPermissionRequest {
  role_id: string;
  feature: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface UpdateUserPermissionRequest {
  id: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

export interface MemberPermission extends UserPermission {
  id: string;
  user_id: string;
}

export type MemberPermissionsResponse = MemberPermission[];

export interface GetMemberPermissionsQueryParams {
  user_id: string;
}

export interface UpdateMemberPermissionRequest {
  id: string;
  user_id: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
}

export interface User {
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
  role_details?: UserRoleDetails | null;
  is_superuser: boolean;
  status: string;
  is_payment_validated: boolean;
  membership_category: MembershipCategory | null;
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
  // Legacy/Optional fields
  street_address?: string | null;
  postal_code?: string | null;
  country?: string | null;
  company_name?: string | null;
  company_role?: string | null;
  company_website?: string | null;
  company_siret?: string | null;
  years_as_member?: number | null;
}

export interface UsersResponse {
  total: number;
  page: number;
  page_size?: number;
  total_pages?: number;
  counts: {
    all: number;
    active: number;
    pending: number;
    suspended: number;
    archived: number;
  };
  results: User[];
}

export interface GetUsersQueryParams {
  archived?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
  role_id?: string;
  status?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  mobile?: string;
  role_id: string;
  society?: string;
  city?: string;
  department?: string;
  address?: string;
  status?: 'active' | 'pending' | 'suspended';
  payment_validated?: boolean;
  is_superuser?: boolean;
  avatar?: File | null;
}

export interface OnlineUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  initials: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
}

export interface UsersOnlineResponse {
  count: number;
  users: OnlineUser[];
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  society?: string;
  department?: string;
  role_id?: string;
  status?: 'active' | 'pending' | 'suspended';
  payment_validated?: boolean;
  is_payment_validated?: boolean;
  is_superuser?: boolean;
  avatar_url?: string;
  avatar?: File | null;
  // Legacy/Optional fields
  street_address?: string;
  postal_code?: string;
  country?: string;
  company_name?: string;
  company_role?: string;
  company_website?: string;
  company_siret?: string;
}

export interface UpdateUsersMeRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  society?: string;
  department?: string;
}

export interface UploadUserPhotoRequest {
  userId: string;
  photo: File;
}

export interface ExportUsersCsvResponse {
  file: Blob;
  filename: string;
}

export interface RestoreUserResponse extends User {}
