import { profileTags, projectionTags, statsTag, mutationChanged } from '../api/cacheTags';
import { apiSlice } from '../api/apiSlice';
import { sessionFailed, logout } from '../auth/authSlice';
import { normalizeUserProfile } from '../auth/normalizeProfile';
import type { RootState } from '../../store';
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
  CreateMemberPermissionRequest,
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



const normalizeUser = (user: UserApiResponse): User => ({
  ...normalizeUserProfile(user),
  membership_category: user.membership_category ?? null,
});



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
      providesTags: result => [{type:'User',id:'LIST'},...(result?.results.flatMap(profileTags)||[])],
    }),
    createUser: builder.mutation<User, CreateUserRequest>({
      query: (userData) => ({
        url: '/user/users',
        method: 'POST',
        body: buildCreateUserFormData(userData),
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: (result,error) => mutationChanged(error) ? [{ type: 'User', id: 'LIST' },...projectionTags,statsTag] : [],
    }),
    getUsersOnline: builder.query<UsersOnlineResponse, void>({
      query: () => '/user/users/online',
      providesTags: [{ type: 'User', id: 'ONLINE' }],
    }),
    getUserRoles: builder.query<UserRolesResponse, void>({
      query: () => '/user/roles',
      providesTags: [{type:'UserRole',id:'LIST'}],
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
      invalidatesTags: (result,error) => mutationChanged(error) ? [{type:'UserRole',id:'LIST'}] : [],
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
      invalidatesTags: (result,error,arg) => mutationChanged(error) ? ([{type:'UserRole',id:'LIST'},{type:'RoleMembers',id:arg.id},{type:'RoleMembers',id:'UNKNOWN'},...projectionTags]) : [],
    }),
    deleteUserRole: builder.mutation<void, DeleteUserRoleRequest>({
      query: ({ id }) => ({
        url: `/user/roles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result,error,arg) => mutationChanged(error) ? ([{type:'UserRole',id:'LIST'},{type:'RoleMembers',id:arg.id},{type:'RoleMembers',id:'UNKNOWN'},...projectionTags]) : [],
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
      invalidatesTags: (result,error,{role_id}) => mutationChanged(error) ? ([{type:'User',id:'PERMISSIONS-'+role_id},{type:'RoleMembers',id:role_id},{type:'RoleMembers',id:'UNKNOWN'},...projectionTags]) : [],
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
      invalidatesTags: (result,error,{role_id}) => mutationChanged(error) ? ([{type:'User',id:'PERMISSIONS-'+role_id},{type:'RoleMembers',id:role_id},{type:'RoleMembers',id:'UNKNOWN'},...projectionTags]) : [],
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
      invalidatesTags: (result,error,{user_id}) => mutationChanged(error) ? ([{type:'User',id:'USER-PERMISSIONS-'+user_id},{type:'User',id:user_id},...projectionTags]) : [],
    }),
    createMemberPermission: builder.mutation<
      MemberPermission,
      CreateMemberPermissionRequest
    >({
      query: (body) => ({
        url: '/user/user-permissions',
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: (result,error,{user_id}) => mutationChanged(error) ? ([{type:'User',id:'USER-PERMISSIONS-'+user_id},{type:'User',id:user_id},...projectionTags]) : [],
    }),
    getUsersMe: builder.query<User, void>({
      query: () => '/user/users/me',
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      providesTags: result => [{type:'User',id:'ME'},...profileTags(result)],
      async onQueryStarted(_, { dispatch, getState, queryFulfilled }) {
        const { sessionVersion } = (getState() as RootState).auth;
        try {
          const { data } = await queryFulfilled;
          if (!data?.id) throw new Error('Invalid current-user response');
        } catch (failure) {
          const error = (failure as { error?: { status?: number | string } }).error;
          dispatch(sessionFailed({ error: error?.status ?? 'FETCH_ERROR', sessionVersion }));
        }
      },
    }),
    updateUsersMe: builder.mutation<User, UpdateUsersMeRequest>({
      async onQueryStarted(_, { dispatch, getState, queryFulfilled }) {
        const version = (getState() as RootState).auth.sessionVersion;
        try {
          const {data} = await queryFulfilled;
          const current = (getState() as RootState).auth;
          if (current.sessionVersion === version && current.user?.id === data.id) {
            dispatch(membersApi.util.updateQueryData('getUserById', data.id, draft => { Object.assign(draft, data, current.user); }));
          }
        } catch { /* Failed updates retain the existing profile. */ }
      },
      query: (userData) => ({
        url: '/user/users/me',
        method: 'PATCH',
        body: buildUpdateUsersMeFormData(userData),
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: (result,error) => mutationChanged(error) ? ([{type:'User',id:'LIST'},...projectionTags]) : [],
    }),
    getUserById: builder.query<User, string>({
      query: (id) => `/user/users/${id}`,
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      providesTags: (result,error,id) => [{type:'User',id},...profileTags(result)],
    }),
    updateUser: builder.mutation<User, { id: string; body: UpdateUserRequest }>({
      query: ({ id, body }) => ({
        url: `/user/users/${id}`,
        method: 'PATCH',
        body: buildUpdateUserFormData(body),
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: (result,error,{id}) => mutationChanged(error) ? ([{type:'User',id},{type:'User',id:'LIST'},...projectionTags,statsTag]) : [],
    }),
    deleteUser: builder.mutation<void, string>({
      async onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
        const initial = (getState() as RootState).auth;
        try { await queryFulfilled; if (initial.user?.id === id && (getState() as RootState).auth.sessionVersion === initial.sessionVersion) dispatch(logout()); } catch { /* Keep the session on failure. */ }
      },
      query: (id) => ({
        url: `/user/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result,error,id) => mutationChanged(error) ? ([{type:'User',id},{type:'User',id:'LIST'},...projectionTags,statsTag]) : [],
    }),
    softDeleteUser: builder.mutation<void, string>({
      async onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
        const initial = (getState() as RootState).auth;
        try { await queryFulfilled; if (initial.user?.id === id && (getState() as RootState).auth.sessionVersion === initial.sessionVersion) dispatch(logout()); } catch { /* Keep the session on failure. */ }
      },
      query: (id) => ({
        url: `/user/users/${id}/soft`,
        method: 'DELETE',
      }),
      invalidatesTags: (result,error,id) => mutationChanged(error) ? ([
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
        ...projectionTags,statsTag]) : [],
    }),
    restoreUser: builder.mutation<RestoreUserResponse, string>({
      query: (id) => ({
        url: `/user/users/${id}/restore`,
        method: 'PATCH',
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: (result,error,id) => mutationChanged(error) ? ([
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
        ...projectionTags,statsTag]) : [],
    }),
    validateUser: builder.mutation<User, string>({
      query: (id) => ({
        url: `/user/users/${id}/validate`,
        method: 'PATCH',
      }),
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      invalidatesTags: (result,error,id) => mutationChanged(error) ? ([
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
        ...projectionTags,statsTag]) : [],
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
      transformResponse: (response: UserApiResponse) => normalizeUser(response),
      async onQueryStarted({ userId }, { dispatch, getState, queryFulfilled }) {
        const version = (getState() as RootState).auth.sessionVersion;
        try {
          const { data: updatedUser } = await queryFulfilled;

          if ((getState() as RootState).auth.sessionVersion !== version) return;

          dispatch(
            membersApi.util.updateQueryData('getUserById', userId, (draft) => {
              draft.avatar_url = updatedUser.avatar_url;
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
      invalidatesTags: (result,error) => mutationChanged(error) ? [
        { type: 'User', id: 'LIST' },
        { type: 'User', id: 'ONLINE' },
      ] : [],
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
  useCreateMemberPermissionMutation,
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
