import { apiSlice as baseApi } from '../api/apiSlice';
import type { CategoryQueryParams, PaginatedResponse } from '../api/apiTypes';
import {
  Event,
  EventCategory,
  CalendarStats,
  GetEventsQueryParams,
  CreateEventRequest,
  UpdateEventRequest,
  EventRegistrationResponse,
  EventRegistrationsList,
  CreateEventCategoryRequest,
  UpdateEventCategoryRequest,
} from './eventTypes';

const appendIfDefined = (formData: FormData, key: string, value: unknown) => {
  if (value !== undefined && value !== null) {
    formData.append(key, String(value));
  }
};

const buildEventFormData = (
  body: Partial<CreateEventRequest & UpdateEventRequest>,
) => {
  const formData = new FormData();

  appendIfDefined(formData, 'title', body.title);
  appendIfDefined(formData, 'event_category_id', body.event_category_id);
  appendIfDefined(formData, 'event_date', body.event_date);
  appendIfDefined(formData, 'end_date', body.end_date);
  appendIfDefined(formData, 'event_time', body.event_time);
  appendIfDefined(formData, 'location', body.location);
  appendIfDefined(formData, 'description', body.description);
  appendIfDefined(formData, 'max_attendees', body.max_attendees);
  appendIfDefined(formData, 'is_public', body.is_public);
  appendIfDefined(formData, 'status', body.status);
  body.remove_attachment_urls?.forEach((url) => {
    formData.append('remove_attachment_urls', url);
  });

  body.attachments?.forEach((file) => {
    formData.append('attachments', file);
  });

  body.new_attachments?.forEach((file) => {
    formData.append('new_attachments', file);
  });

  return formData;
};

export const eventsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUpcomingEvents: builder.query<Event[], { limit?: number }>({
      query: ({ limit = 6 }) => `/events/events/upcoming?limit=${limit}`,
      providesTags: ['Event'],
    }),

    getCalendarStats: builder.query<CalendarStats, void>({
      query: () => '/events/events/calendar-stats',
      providesTags: ['Event'],
    }),

    getEvents: builder.query<Event[], GetEventsQueryParams>({
      query: ({ year, month, event_category_id }) => {
        const params = new URLSearchParams({
          year: String(year),
          month: String(month).padStart(2, '0'),
        });

        if (event_category_id) {
          params.set('event_category_id', event_category_id);
        }

        return `/events/events?${params.toString()}`;
      },
      providesTags: ['Event'],
    }),

    getEventCategories: builder.query<
      PaginatedResponse<EventCategory>,
      CategoryQueryParams | void
    >({
      query: (arg) => {
        const params = arg && typeof arg === 'object' ? arg : undefined;
        const searchParams = new URLSearchParams();
        if (params?.page) {
          searchParams.set('page', String(params.page));
        }
        const pageSize = params?.pageSize ?? params?.page_size ?? params?.limit;
        if (pageSize) {
          searchParams.set('page_size', String(pageSize));
        }
        if (params?.search?.trim()) {
          searchParams.set('search', params.search.trim());
        }
        const queryString = searchParams.toString();
        return `/events/event-categories${queryString ? `?${queryString}` : ''}`;
      },
      providesTags: ['EventCategory'],
    }),

    createEventCategory: builder.mutation<EventCategory, CreateEventCategoryRequest>({
      query: (body) => ({
        url: '/events/event-categories',
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: ['EventCategory', 'Event'],
    }),

    updateEventCategory: builder.mutation<EventCategory, UpdateEventCategoryRequest>({
      query: ({ id, ...body }) => ({
        url: `/events/event-categories/${id}`,
        method: 'PATCH',
        body,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      invalidatesTags: ['EventCategory', 'Event'],
    }),

    deleteEventCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/events/event-categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['EventCategory', 'Event'],
    }),

    getEventById: builder.query<Event, string>({
      query: (id) => `/events/events/${id}`,
      providesTags: (result, error, id) => [{ type: 'Event', id }],
    }),

    createEvent: builder.mutation<Event, CreateEventRequest>({
      query: (data) => ({
        url: '/events/events',
        method: 'POST',
        body: buildEventFormData(data),
      }),
      invalidatesTags: ['Event'],
    }),

    updateEvent: builder.mutation<Event, { id: string; data: UpdateEventRequest }>({
      query: ({ id, data }) => ({
        url: `/events/events/${id}`,
        method: 'PATCH',
        body: buildEventFormData(data),
      }),
      invalidatesTags: (result, error, { id }) => ['Event', { type: 'Event', id }],
    }),

    deleteEvent: builder.mutation<void, string>({
      query: (id) => ({
        url: `/events/events/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Event'],
    }),

    registerForEvent: builder.mutation<EventRegistrationResponse, string>({
      query: (id) => ({
        url: `/events/events/${id}/register`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (result, error, id) => ['Event', { type: 'Event', id }],
    }),

    unregisterFromEvent: builder.mutation<void, string>({
      query: (id) => ({
        url: `/events/events/${id}/register`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => ['Event', { type: 'Event', id }],
    }),

    getEventRegistrations: builder.query<EventRegistrationsList, string>({
      query: (registrationId) => `/events/events/${registrationId}/registrations`,
      providesTags: (result, error, registrationId) => [{ type: 'Event', id: registrationId }],
    }),
  }),
});

export const {
  useGetUpcomingEventsQuery,
  useGetCalendarStatsQuery,
  useGetEventsQuery,
  useGetEventCategoriesQuery,
  useCreateEventCategoryMutation,
  useUpdateEventCategoryMutation,
  useDeleteEventCategoryMutation,
  useGetEventByIdQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useRegisterForEventMutation,
  useUnregisterFromEventMutation,
  useGetEventRegistrationsQuery,
} = eventsApi;
