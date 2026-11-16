
import { apiSlice } from '../api/apiSlice';

const DASHBOARD_BASE_PATH = '/admin%26modarator/dashboard';

export interface DashboardStatsResponse {
  total_active_members: number;
  active_topics: number;
  events_this_year: number;
  trainings_planned: number;
}

export interface DashboardActivityActor {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
}

export interface DashboardActivityItem {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  description: string | null;
  created_at: string;
  status_badge: string;
  actor: DashboardActivityActor;
}

export interface DashboardUpcomingEventItem {
  id: string;
  title: string;
  event_type: string;
  day: number;
  month: string;
  location: string;
  is_public: boolean;
}

export type GlobalSearchResultType =
  | 'agenda'
  | 'articles'
  | 'technicopro'
  | 'trainings'
  | 'forums'
  | 'forum_topics'
  | 'forum_posts'
  | 'documents'
  | 'document_folders';

export type GlobalSearchExtra = Record<string, unknown>;

export interface GlobalSearchResult {
  index: number;
  score: number;
  type: GlobalSearchResultType;
  id: string;
  title: string;
  matched_fields: string[];
  snippet: string | null;
  created_at: string | null;
  extra: GlobalSearchExtra;
}

export interface GlobalSearchMeta {
  query: string;
  limit: number;
  total_results: number;
  totals_by_type: Record<GlobalSearchResultType, number>;
}

export interface GlobalSearchResponse {
  results: GlobalSearchResult[];
  meta: GlobalSearchMeta;
}

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStatsResponse, void>({
      query: () => `${DASHBOARD_BASE_PATH}/stats`,
      providesTags: [{type:'Dashboard',id:'STATS'}],
    }),
    getDashboardActivity: builder.query<DashboardActivityItem[], void>({
      query: () => `${DASHBOARD_BASE_PATH}/activity`,
      providesTags: [{type:'Dashboard',id:'ACTIVITY'}],
    }),
    getDashboardUpcomingEvents: builder.query<DashboardUpcomingEventItem[], void>({
      query: () => `${DASHBOARD_BASE_PATH}/upcoming-events`,
      providesTags: (result) => [{type:'Event',id:'LIST'},...(result?.map(item=>({type:'Event' as const,id:item.id}))||[])],
    }),
    getDashboardSearch: builder.query<
      GlobalSearchResponse,
      { q: string; limit?: number; type?: GlobalSearchResultType }
    >({
      serializeQueryArgs: ({queryArgs}) => ({q: queryArgs.q.trim(), limit: queryArgs.limit ?? 10, type: queryArgs.type}),
      query: ({ q, limit = 10, type }) => {
        const params = new URLSearchParams({
          q: q.trim(),
          limit: String(limit),
        });

        if (type) {
          params.set('type', type);
        }

        return `/home/?${params.toString()}`;
      },
      providesTags: [{type:'Search',id:'GLOBAL'}],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetDashboardActivityQuery,
  useGetDashboardUpcomingEventsQuery,
  useLazyGetDashboardSearchQuery,
  useGetDashboardSearchQuery,
} = dashboardApi;
