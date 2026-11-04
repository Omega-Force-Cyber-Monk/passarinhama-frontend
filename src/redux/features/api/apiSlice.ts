import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { RootState } from "../../store";
import { setCredentials, logout } from "../auth/authSlice";
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

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401 && !isAuthEndpoint(args)) {
    const refreshToken = (api.getState() as RootState).auth.refreshToken;

    if (refreshToken) {
      console.log("Access token expired. Attempting refresh...");
      // Try to get a new token
      const refreshResult = await baseQuery(
        {
          url: "/auth/refresh",
          method: "POST",
          body: { refresh_token: refreshToken },
          headers: {
            "Content-Type": "application/json",
          },
        },
        api,
        extraOptions,
      );

      if (refreshResult.data) {
        console.log("Refresh successful. Retrying original request.");
        // Store the new token
        api.dispatch(setCredentials(refreshResult.data as any));
        // Retry the initial query
        result = await baseQuery(args, api, extraOptions);
      } else {
        console.warn("Refresh failed. Logging out.");
        api.dispatch(logout());
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
  const profile = await baseQueryWithReauth('/user/users/me', api, options);
  if (profile.error) return { error: profile.error };
  const user = profile.data as UserProfile | undefined;
  if (!user || user.id !== initial.user.id) return { error: forbidden() };
  const token = (api.getState() as RootState).auth.token;
  const authorized = await authorizeRequest(api.endpoint, request, user,
    async (url) => baseQueryWithReauth(url, api, options));
  if (authorized.error) return { error: authorized.error };
  const current = (api.getState() as RootState).auth;
  if (!current.isAuthenticated || !token || token !== current.token || current.user?.id !== user.id) return { error: forbidden() };
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
