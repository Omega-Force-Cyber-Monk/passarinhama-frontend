import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { RootState } from "../../store";
import { tokenRefreshed, logout } from "../auth/authSlice";
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
  const initial = (api.getState() as RootState).auth;
  const isCurrentSession = () => (api.getState() as RootState).auth.sessionVersion === initial.sessionVersion;
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
        const flight = { version: initial.sessionVersion, promise: Promise.resolve(baseQuery(
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
        )) };
        refreshFlight = flight;
        void flight.promise.finally(() => { if (refreshFlight === flight) refreshFlight = undefined; });
      }
      const refreshResult = await refreshFlight.promise;
      if (!isCurrentSession()) return sessionChanged();

      const credentials = refreshResult.data as { access_token?: string; refresh_token?: string } | undefined;
      if (typeof credentials?.access_token === 'string' && credentials.access_token) {
        api.dispatch(tokenRefreshed({ ...credentials, access_token: credentials.access_token, sessionVersion: initial.sessionVersion }));
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

const baseQueryWithAuthorization: BaseQueryFn<string | AuthorizedFetchArgs, unknown, FetchBaseQueryError> = async (args, api, options) => {
  const request = typeof args === 'string' ? { url: args } : args;
  if (!needsAuthorization(api.endpoint, request)) return baseQueryWithReauth(args, api, options);
  const initial = (api.getState() as RootState).auth;
  if (!initial.isAuthenticated || !initial.token || !initial.user?.id) return { error: forbidden() };
  // Read routes use the one resolved session. Writes retain their fresh-profile preflight.
  const isRead = ['GET', 'HEAD'].includes((request.method || 'GET').toUpperCase());
  const profile = isRead ? { data: initial.user } : await baseQueryWithReauth('/user/users/me', api, options);
  if (profile.error) return { error: profile.error };
  const user = profile.data as UserProfile | undefined;
  if (!user || user.id !== initial.user.id) return { error: forbidden() };
  const token = (api.getState() as RootState).auth.token;
  const authorized = await authorizeRequest(api.endpoint, request, user,
    async (url) => baseQueryWithReauth(url, api, options));
  if (authorized.error) return { error: authorized.error };
  const current = (api.getState() as RootState).auth;
  if (current.sessionVersion !== initial.sessionVersion || !current.isAuthenticated || !token || token !== current.token || current.user?.id !== user.id) return { error: forbidden() };
  // These client checks are UX safeguards. The server must authorize atomically at the write.
  return baseQueryWithReauth(authorized.request!, api, options);
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
  ],
  endpoints: (builder) => ({
    getStats: builder.query<any, void>({
      query: () => "/stats",
      providesTags: ["User", "Topic", "Event", "Training"],
    }),
  }),
});

export const { useGetStatsQuery } = apiSlice;
