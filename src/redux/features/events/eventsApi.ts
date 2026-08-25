import { apiSlice as baseApi } from '../api/apiSlice';
import {
  Event,
  CalendarStats,
  GetEventsQueryParams,
  CreateEventRequest,
  UpdateEventRequest,
  EventRegistrationResponse,
  EventRegistrationsList
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
  appendIfDefined(formData, 'event_type', body.event_type);
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
      query: ({ year, month }) => {
        const params = new URLSearchParams({
          year: String(year),
          month: String(month).padStart(2, '0'),
        });

        return `/events/events?${params.toString()}`;
      },
      providesTags: ['Event'],
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
  useGetEventByIdQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useRegisterForEventMutation,
  useUnregisterFromEventMutation,
  useGetEventRegistrationsQuery,
} = eventsApi;
