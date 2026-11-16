import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { RootState } from "../../store";
import { tokenRefreshed, logout, sessionResolved } from "../auth/authSlice";
import { normalizeUserProfile } from '../auth/normalizeProfile';
import { synchronizeSession, withRefreshLock } from '../auth/sessionSync';
import { authorizeRequest, forbidden, needsAuthorization, type AuthorizedFetchArgs } from './mutationAuthorization';
import type { UserProfile } from '../auth/authTypes';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("Accept", "application/json");
    return headers;
  },
});

const getRequestUrl = (args: string | FetchArgs) =>
  typeof args === "string" ? args : args.url;

const isAuthEndpoint = (args: string | FetchArgs) =>
  getRequestUrl(args).startsWith("/auth/");

const sessionChanged = (): { error: FetchBaseQueryError } => ({
  error: { status: 'CUSTOM_ERROR', error: 'Session changed while the request was in progress.' },
});
let refreshFlight: { version: number; promise: Promise<Awaited<ReturnType<typeof baseQuery>>> } | undefined;

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  synchronizeSession(api);
  const initial = (api.getState() as RootState).auth;
  const isCurrentSession = () => {
    synchronizeSession(api);
    return (api.getState() as RootState).auth.sessionVersion === initial.sessionVersion;
  };
  const requestUrl = getRequestUrl(args);
  const request = requestUrl === '/user/users/me'
    ? { ...(typeof args === 'string' ? { url: args } : args), timeout: 20000 } : args;
  let result = await baseQuery(request, api, extraOptions);
  if (!isCurrentSession()) return sessionChanged();

  if (result.error && result.error.status === 401 && !isAuthEndpoint(args)) {
    const current = (api.getState() as RootState).auth;
    const refreshToken = current.refreshToken;

    // Another request may already have recovered this session.
    if (current.token && current.token !== initial.token) {
      result = await baseQuery(request, api, extraOptions);
      if (!isCurrentSession()) return sessionChanged();
      if (result.error?.status === 401) api.dispatch(logout());
      return result;
    }

    if (refreshToken) {
      if (!refreshFlight || refreshFlight.version !== initial.sessionVersion) {
        const flight = { version: initial.sessionVersion, promise: withRefreshLock(async () => {
          synchronizeSession(api);
          const latest = (api.getState() as RootState).auth;
          if (!isCurrentSession()) return sessionChanged();
          if (latest.token && latest.token !== initial.token) return { data: { access_token: latest.token, refresh_token: latest.refreshToken } };
          const recovered = await baseQuery(
          {
            url: "/auth/refresh",
            method: "POST",
            timeout: 20000,
            body: { refresh_token: refreshToken },
            headers: {
              "Content-Type": "application/json",
            },
          },
          api,
          extraOptions,
          );
          if (!isCurrentSession()) return sessionChanged();
          const afterRefresh = (api.getState() as RootState).auth;
          if (afterRefresh.token && afterRefresh.token !== initial.token) return { data: {access_token: afterRefresh.token, refresh_token: afterRefresh.refreshToken} };
          const credentials = recovered.data as { access_token?: string; refresh_token?: string } | undefined;
          if (credentials?.access_token) api.dispatch(tokenRefreshed({ ...credentials, access_token: credentials.access_token, sessionVersion: initial.sessionVersion }));
          return recovered;
        }) };
        refreshFlight = flight;
        void flight.promise.finally(() => { if (refreshFlight === flight) refreshFlight = undefined; });
      }
      const refreshResult = await refreshFlight.promise;
      if (!isCurrentSession()) return sessionChanged();

      const credentials = refreshResult.data as { access_token?: string; refresh_token?: string } | undefined;
      if (typeof credentials?.access_token === 'string' && credentials.access_token) {
        // Retry the initial query
        result = await baseQuery(request, api, extraOptions);
        if (!isCurrentSession()) return sessionChanged();
        if (result.error?.status === 401) api.dispatch(logout());
      } else {
        // Refresh transport/server/403 failures do not prove session expiry.
        if (refreshResult.error?.status === 401) api.dispatch(logout());
        return refreshResult.error ? { error: refreshResult.error } : {
          error: { status: 'CUSTOM_ERROR', error: 'Invalid session recovery response.' },
        };
      }
    } else {
      api.dispatch(logout());
    }
  }

  return result;
};

let profileRequestOrder = 0;
// Client request ordering, not an invented server profile version. An older response
// must neither restore grants nor overwrite the RTK profile after newer evidence.
const publishProfile = (api: Parameters<typeof baseQuery>[1], data: unknown, version: number, order: number) => {
  const current = (api.getState() as RootState).auth;
  if (current.sessionVersion !== version || !current.token) return undefined;
  if (!data || typeof data !== 'object' || !(data as UserProfile).id) return undefined;
  const user = normalizeUserProfile(data as Parameters<typeof normalizeUserProfile>[0]);
  if (!user?.id || (current.user && current.user.id !== user.id)) return undefined;
  if (order < current.profileRequestOrder) return current.user ?? undefined;
  api.dispatch(sessionResolved({ user, sessionVersion: version, requestOrder: order }));
  if ('getUsersMe' in apiSlice.endpoints) api.dispatch(apiSlice.util.upsertQueryEntries([{ endpointName: 'getUsersMe', arg: undefined, value: user } as any]));
  return user;
};
const currentProfile: typeof baseQueryWithReauth = async (_args, api, options) => {
  synchronizeSession(api);
  const version = (api.getState() as RootState).auth.sessionVersion;
  const order = ++profileRequestOrder;
  const result = await baseQueryWithReauth('/user/users/me', api, options);
  if (result.error) return result;
  const user = publishProfile(api, result.data, version, order);
  return user ? { data: user, meta: result.meta } : { error: forbidden() };
};

const baseQueryWithAuthorization: BaseQueryFn<string | AuthorizedFetchArgs, unknown, FetchBaseQueryError> = async (args, api, options) => {
  synchronizeSession(api);
  const request = typeof args === 'string' ? { url: args } : args;
  if (['getUsersMe', 'getMe'].includes(api.endpoint)) return currentProfile(args, api, options);
  if (!needsAuthorization(api.endpoint, request)) return baseQueryWithReauth(args, api, options);
  const initial = (api.getState() as RootState).auth;
  if (!initial.isAuthenticated || !initial.token || !initial.user?.id) return { error: forbidden() };
  // Read routes use the one resolved session. Writes retain their fresh-profile preflight.
  const isRead = ['GET', 'HEAD'].includes((request.method || 'GET').toUpperCase());
  const profile = isRead ? { data: initial.user } : await currentProfile('/user/users/me', api, options);
  if (profile.error) return { error: profile.error };
  const user = profile.data as UserProfile | undefined;
  if (!user || user.id !== initial.user.id) return { error: forbidden() };
  const authorizationOrder = (api.getState() as RootState).auth.profileRequestOrder;
  const token = (api.getState() as RootState).auth.token;
  const targets = new Map<string, Awaited<ReturnType<typeof baseQueryWithReauth>>>();
  const readTarget = async (url: string) => {
    if (!targets.has(url)) targets.set(url, await baseQueryWithReauth(url, api, options));
    return targets.get(url)!;
  };
  const authorized = await authorizeRequest(api.endpoint, request, user,
    readTarget);
  if (authorized.error) return { error: authorized.error };
  const current = (api.getState() as RootState).auth;
  if (current.sessionVersion !== initial.sessionVersion || !current.isAuthenticated || !token || token !== current.token || current.user?.id !== user.id) return { error: forbidden() };
  if (current.profileRequestOrder > authorizationOrder) {
    const latest = await authorizeRequest(api.endpoint, request, current.user, readTarget);
    if (latest.error) return {error: latest.error};
  }
  const beforeSend = (api.getState() as RootState).auth;
  if (beforeSend.sessionVersion !== initial.sessionVersion || beforeSend.user?.id !== user.id || beforeSend.token !== token) return {error: forbidden()};
  // These client checks are UX safeguards. The server must authorize atomically at the write.
  const order = ++profileRequestOrder;
  let result = await baseQueryWithReauth(authorized.request!, api, options);
  if (!result.error && isRead) {
    const latest = (api.getState() as RootState).auth;
    if (!latest.user || latest.user.id !== user.id) return {error: forbidden()};
    if (latest.profileRequestOrder > authorizationOrder) {
      const allowed = await authorizeRequest(api.endpoint, request, latest.user, readTarget);
      if (allowed.error) return {error: allowed.error};
    }
  }
  if (!result.error && api.endpoint === 'uploadUserPhoto' && (result.data as UserProfile)?.avatar_url) {
    const photo = result.data as UserProfile;
    result = { data: {...photo, avatar_url: `${photo.avatar_url}${photo.avatar_url.includes('?') ? '&' : '?'}t=${Date.now()}`}, meta: result.meta };
  }
  if (!result.error && ['updateUsersMe', 'uploadUserPhoto'].includes(api.endpoint) && (result.data as UserProfile)?.id === user.id) {
    publishProfile(api, result.data, initial.sessionVersion, order);
  }
  if ((api.getState() as RootState).auth.sessionVersion !== initial.sessionVersion) return sessionChanged();
  return result;
};

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuthorization,
  tagTypes: [
    "User",
    "Article",
    "Event",
    "Training",
    "TrainingCategory",
    "TechnicoPro",
    "TechnicoProCategory",
    "Forum",
    "Post",
    "Topic",
    "Admin",
    "Folder",
    "Document",
    "EventCategory",
    "ArticleCategory",
    "UserRole",
    "RoleMembers",
    "NotificationPreference",
    "Search",
    "Dashboard",
  ],
  endpoints: (builder) => ({
    getStats: builder.query<any, void>({
      query: () => "/stats",
      providesTags: [{ type: 'Dashboard', id: 'STATS' }],
    }),
  }),
});

export const { useGetStatsQuery } = apiSlice;
