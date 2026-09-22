import { apiSlice } from '../api/apiSlice';
import type { FetchBaseQueryMeta } from '@reduxjs/toolkit/query';
import {
  User,
  UsersResponse,
  GetUsersQueryParams,
  CreateUserRequest,
  UsersOnlineResponse,
  UpdateUserRequest,
  UpdateUsersMeRequest,
  UploadUserPhotoRequest,
  ExportUsersCsvResponse,
  RestoreUserResponse,
  MembershipCategory,
  UserPermission,
  MemberPermission,
  UserRoleDetails,
  UserRolesResponse,
  CreateUserRoleRequest,
  UpdateUserRoleRequest,
  DeleteUserRoleRequest,
  UserPermissionsResponse,
  MemberPermissionsResponse,
  GetUserPermissionsQueryParams,
  GetMemberPermissionsQueryParams,
  CreateUserPermissionRequest,
  UpdateUserPermissionRequest,
  UpdateMemberPermissionRequest,
} from './membersTypes';

const getCsvFilename = (contentDisposition?: string | null) => {
  if (!contentDisposition) return 'users_export.csv';

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const standardMatch = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (standardMatch?.[1]) {
    return standardMatch[1];
  }

  return 'users_export.csv';
};

type UserApiResponse = Omit<
  User,
  'permissions' | 'user_permissions' | 'role' | 'role_details'
> & {
  membership_category?: MembershipCategory | null;
  permissions?: UserPermission[];
  user_permissions?: UserPermission[];
  role: string | UserRoleDetails | null;
};

type UsersApiResponse = Omit<UsersResponse, 'results'> & {
  results: UserApiResponse[];
};

const normalizeRole = (role: string | UserRoleDetails | null | undefined) => {
  if (!role) return '';
  return typeof role === 'string' ? role : role.slug || role.name;
};

const normalizeUser = (user: UserApiResponse): User => ({
  ...user,
  membership_category: user.membership_category ?? null,
  permissions: user.permissions ?? [],
  user_permissions: user.user_permissions ?? [],
  role: normalizeRole(user.role),
  role_details: typeof user.role === 'string' ? null : user.role,
});

const withAvatarCacheBust = <T extends { avatar_url: string | null }>(
  user: T,
): T => {
  if (!user.avatar_url) return user;

  const separator = user.avatar_url.includes('?') ? '&' : '?';

  return {
    ...user,
    avatar_url: `${user.avatar_url}${separator}t=${Date.now()}`,
  };
};

const appendIfDefined = (
  formData: FormData,
  key: string,
  value: string | boolean | File | null | undefined,
) => {
  if (value === undefined || value === null) return;
  formData.append(key, value instanceof File ? value : String(value));
};

const buildCreateUserFormData = (userData: CreateUserRequest) => {
  const formData = new FormData();

  appendIfDefined(formData, 'email', userData.email);
  appendIfDefined(formData, 'password', userData.password);
  appendIfDefined(formData, 'first_name', userData.first_name);
  appendIfDefined(formData, 'last_name', userData.last_name);
  appendIfDefined(formData, 'phone', userData.phone);
  appendIfDefined(formData, 'mobile', userData.mobile);
  appendIfDefined(formData, 'role_id', userData.role_id);
  appendIfDefined(formData, 'society', userData.society);
  appendIfDefined(formData, 'city', userData.city);
  appendIfDefined(formData, 'department', userData.department);
  appendIfDefined(formData, 'address', userData.address);
  appendIfDefined(formData, 'status', userData.status);
  appendIfDefined(formData, 'payment_validated', userData.payment_validated);
  appendIfDefined(formData, 'is_superuser', userData.is_superuser);
  appendIfDefined(formData, 'avatar', userData.avatar);

  return formData;
};

const buildUpdateUserFormData = (userData: UpdateUserRequest) => {
  const formData = new FormData();

  appendIfDefined(formData, 'first_name', userData.first_name);
  appendIfDefined(formData, 'last_name', userData.last_name);
  appendIfDefined(formData, 'phone', userData.phone);
  appendIfDefined(formData, 'mobile', userData.mobile);
  appendIfDefined(formData, 'address', userData.address);
  appendIfDefined(formData, 'city', userData.city);
  appendIfDefined(formData, 'society', userData.society);
  appendIfDefined(formData, 'department', userData.department);
  appendIfDefined(formData, 'role_id', userData.role_id);
  appendIfDefined(formData, 'status', userData.status);
  appendIfDefined(
    formData,
    'payment_validated',
    userData.payment_validated ?? userData.is_payment_validated,
  );
  appendIfDefined(formData, 'is_superuser', userData.is_superuser);
  appendIfDefined(formData, 'avatar_url', userData.avatar_url);
  appendIfDefined(formData, 'avatar', userData.avatar);
  appendIfDefined(formData, 'street_address', userData.street_address);
  appendIfDefined(formData, 'postal_code', userData.postal_code);
  appendIfDefined(formData, 'country', userData.country);
  appendIfDefined(formData, 'company_name', userData.company_name);
  appendIfDefined(formData, 'company_role', userData.company_role);
  appendIfDefined(formData, 'company_website', userData.company_website);
  appendIfDefined(formData, 'company_siret', userData.company_siret);

  return formData;
};

const buildUpdateUsersMeFormData = (userData: UpdateUsersMeRequest) => {
  const formData = new FormData();

  appendIfDefined(formData, 'email', userData.email);
  appendIfDefined(formData, 'first_name', userData.first_name);
  appendIfDefined(formData, 'last_name', userData.last_name);
  appendIfDefined(formData, 'phone', userData.phone);
  appendIfDefined(formData, 'mobile', userData.mobile);
  appendIfDefined(formData, 'address', userData.address);
  appendIfDefined(formData, 'city', userData.city);
  appendIfDefined(formData, 'society', userData.society);
  appendIfDefined(formData, 'department', userData.department);

  return formData;
};

export const membersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<UsersResponse, GetUsersQueryParams>({
      query: ({
        archived = false,
        page = 1,
        pageSize = 20,
        search,
        role_id,
        status,
      }) => {
        const params = new URLSearchParams({
          archived: String(archived),
          page: String(page),
          page_size: String(pageSize),
        });

        if (search?.trim()) {
          params.set('search', search.trim());
        }

        if (role_id?.trim()) {
          params.set('role_id', role_id.trim());
        }

        if (status?.trim()) {
          params.set('status', status.trim());
        }

        return `/user/users?${params.toString()}`;
      },
      transformResponse: (response: UsersApiResponse): UsersResponse => ({
        ...response,
        results: response.results.map(normalizeUser),
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'User' as const, id })),
              { type: 'User', id: 'LIST' },
            ]
          : [{ type: 'User', id: 'LIST' }],
    }),
    createUser: builder.mutation<User, CreateUserRequest>({
      query: (userData) => ({
        url: '/user/users',
        method: 'POST',
        body: buildCreateUserFormData(userData),
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: [{ type: 'User', id: 'LIST' }],
    }),
    getUsersOnline: builder.query<UsersOnlineResponse, void>({
      query: () => '/user/users/online',
      providesTags: [{ type: 'User', id: 'ONLINE' }],
    }),
    getUserRoles: builder.query<UserRolesResponse, void>({
      query: () => '/user/roles',
      providesTags: ['User'],
    }),
    createUserRole: builder.mutation<UserRoleDetails, CreateUserRoleRequest>({
      query: (body) => ({
        url: '/user/roles',
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: ['User'],
    }),
    updateUserRole: builder.mutation<UserRoleDetails, UpdateUserRoleRequest>({
      query: ({ id, ...body }) => ({
        url: `/user/roles/${id}`,
        method: 'PATCH',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: ['User'],
    }),
    deleteUserRole: builder.mutation<void, DeleteUserRoleRequest>({
      query: ({ id }) => ({
        url: `/user/roles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),
    getUserPermissions: builder.query<
      UserPermissionsResponse,
      GetUserPermissionsQueryParams
    >({
      query: ({ role_id }) => `/user/permissions?role_id=${encodeURIComponent(role_id)}`,
      providesTags: (_result, _error, { role_id }) => [
        { type: 'User', id: `PERMISSIONS-${role_id}` },
      ],
    }),
    createUserPermission: builder.mutation<
      UserPermission,
      CreateUserPermissionRequest
    >({
      query: (body) => ({
        url: '/user/permissions',
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: (_result, _error, { role_id }) => [
        { type: 'User', id: `PERMISSIONS-${role_id}` },
      ],
    }),
    updateUserPermission: builder.mutation<
      UserPermission,
      UpdateUserPermissionRequest & { role_id: string }
    >({
      query: ({ id, role_id: _roleId, ...body }) => ({
        url: `/user/permissions/${id}`,
        method: 'PATCH',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: (_result, _error, { role_id }) => [
        { type: 'User', id: `PERMISSIONS-${role_id}` },
      ],
    }),
    getMemberPermissions: builder.query<
      MemberPermissionsResponse,
      GetMemberPermissionsQueryParams
    >({
      query: ({ user_id }) =>
        `/user/user-permissions?user_id=${encodeURIComponent(user_id)}`,
      providesTags: (_result, _error, { user_id }) => [
        { type: 'User', id: `USER-PERMISSIONS-${user_id}` },
      ],
    }),
    updateMemberPermission: builder.mutation<
      MemberPermission,
      UpdateMemberPermissionRequest
    >({
      query: ({ id, user_id: _userId, ...body }) => ({
        url: `/user/user-permissions/${id}`,
        method: 'PATCH',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: (_result, _error, { user_id }) => [
        { type: 'User', id: `USER-PERMISSIONS-${user_id}` },
      ],
    }),
    getUsersMe: builder.query<User, void>({
      query: () => '/user/users/me',
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      providesTags: [{ type: 'User', id: 'ME' }],
    }),
    updateUsersMe: builder.mutation<User, UpdateUsersMeRequest>({
      query: (userData) => ({
        url: '/user/users/me',
        method: 'PATCH',
        body: buildUpdateUsersMeFormData(userData),
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: [{ type: 'User', id: 'ME' }, { type: 'User', id: 'LIST' }],
    }),
    getUserById: builder.query<User, string>({
      query: (id) => `/user/users/${id}`,
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    updateUser: builder.mutation<User, { id: string; body: UpdateUserRequest }>({
      query: ({ id, body }) => ({
        url: `/user/users/${id}`,
        method: 'PATCH',
        body: buildUpdateUserFormData(body),
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: (result, error, { id }) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/user/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'User', id: 'LIST' }],
    }),
    softDeleteUser: builder.mutation<void, string>({
      query: (id) => ({
        url: `/user/users/${id}/soft`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
    restoreUser: builder.mutation<RestoreUserResponse, string>({
      query: (id) => ({
        url: `/user/users/${id}/restore`,
        method: 'PATCH',
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: (result, error, id) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
    validateUser: builder.mutation<User, string>({
      query: (id) => ({
        url: `/user/users/${id}/validate`,
        method: 'PATCH',
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: (result, error, id) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
    uploadUserPhoto: builder.mutation<User, UploadUserPhotoRequest>({
      query: ({ userId, photo }) => {
        const formData = new FormData();
        formData.append('photo', photo);
        return {
          url: `/user/users/${userId}/photo_upload`,
          method: 'PATCH',
          body: formData,
        };
      },
      transformResponse: (response: UserApiResponse) =>
        withAvatarCacheBust(normalizeUser(response)),
      async onQueryStarted({ userId }, { dispatch, queryFulfilled }) {
        try {
          const { data: updatedUser } = await queryFulfilled;

          dispatch(
            membersApi.util.updateQueryData('getUsersMe', undefined, (draft) => {
              Object.assign(draft, updatedUser);
            }),
          );

          dispatch(
            membersApi.util.updateQueryData('getUserById', userId, (draft) => {
              Object.assign(draft, updatedUser);
            }),
          );

          dispatch(
            membersApi.util.updateQueryData(
              'getUsersOnline',
              undefined,
              (draft) => {
                draft.users = draft.users.map((onlineUser) =>
                  onlineUser.id === userId
                    ? {
                        ...onlineUser,
                        first_name: updatedUser.first_name,
                        last_name: updatedUser.last_name,
                        initials: updatedUser.initials,
                        avatar_url: updatedUser.avatar_url,
                        last_seen_at: updatedUser.last_seen_at,
                      }
                    : onlineUser,
                );
              },
            ),
          );
        } catch {
          // Let the component handle the failed upload state.
        }
      },
      invalidatesTags: [
        { type: 'User', id: 'LIST' },
        { type: 'User', id: 'ONLINE' },
      ],
    }),
    exportUsersCsv: builder.mutation<ExportUsersCsvResponse, void>({
      query: () => ({
        url: '/user/users/export/to_csv',
        method: 'GET',
        headers: {
          Accept: 'text/csv,application/json',
        },
        responseHandler: (response) => response.blob(),
      }),
      transformResponse: (response: Blob, meta?: FetchBaseQueryMeta) => ({
        file: response,
        filename: getCsvFilename(
          meta?.response?.headers.get('content-disposition'),
        ),
      }),
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useGetUsersOnlineQuery,
  useGetUserRolesQuery,
  useCreateUserRoleMutation,
  useUpdateUserRoleMutation,
  useDeleteUserRoleMutation,
  useGetUserPermissionsQuery,
  useCreateUserPermissionMutation,
  useUpdateUserPermissionMutation,
  useGetMemberPermissionsQuery,
  useUpdateMemberPermissionMutation,
  useGetUsersMeQuery,
  useUpdateUsersMeMutation,
  useGetUserByIdQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useSoftDeleteUserMutation,
  useRestoreUserMutation,
  useValidateUserMutation,
  useUploadUserPhotoMutation,
  useExportUsersCsvMutation,
} = membersApi;
