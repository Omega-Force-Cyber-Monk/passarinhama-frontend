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

export interface DashboardSearchArticle {
  id: string;
  title: string;
  excerpt: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  structured_fields?: {
    author?: string;
    tags?: string[];
    difficulty?: string;
    estimated_read_time_minutes?: number;
    file_urls?: string[];
  } | null;
  category_name?: string | null;
  author_name?: string | null;
}

export interface DashboardSearchTopic {
  id: string;
  title: string;
  content?: string | null;
  forum_id?: string | null;
  forum?: {
    id: string;
    name?: string;
    slug?: string;
  } | null;
}

export interface DashboardSearchEvent {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  event_time: number | null;
  location: string | null;
  is_public: boolean;
}

export interface DashboardSearchTraining {
  id: string;
  title: string;
  excerpt?: string | null;
  category_name?: string | null;
  status: string;
  published_at?: string | null;
  created_at?: string | null;
  attachments?: string[] | null;
}

export interface DashboardSearchResponse {
  articles: DashboardSearchArticle[];
  topics: DashboardSearchTopic[];
  events: DashboardSearchEvent[];
  trainings: DashboardSearchTraining[];
  meta: {
    query: string;
    limit_per_category: number;
    totals: {
      articles: number;
      topics: number;
      events: number;
      trainings: number;
    };
  };
}

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStatsResponse, void>({
      query: () => `${DASHBOARD_BASE_PATH}/stats`,
      providesTags: ['User', 'Topic', 'Event', 'Training'],
    }),
    getDashboardActivity: builder.query<DashboardActivityItem[], void>({
      query: () => `${DASHBOARD_BASE_PATH}/activity`,
      providesTags: ['User', 'Topic', 'Event', 'Training', 'Article'],
    }),
    getDashboardUpcomingEvents: builder.query<DashboardUpcomingEventItem[], void>({
      query: () => `${DASHBOARD_BASE_PATH}/upcoming-events`,
      providesTags: ['Event'],
    }),
    getDashboardSearch: builder.query<
      DashboardSearchResponse,
      { q: string; limit?: number }
    >({
      query: ({ q, limit = 5 }) => {
        const params = new URLSearchParams({
          q: q.trim(),
          limit: String(limit),
        });

        return `/home/?${params.toString()}`;
      },
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetDashboardActivityQuery,
  useGetDashboardUpcomingEventsQuery,
  useLazyGetDashboardSearchQuery,
} = dashboardApi;
