import { apiSlice } from '../api/apiSlice';
import { NotificationPreference, UpdateNotificationPreferenceRequest } from './notificationTypes';

export const notificationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNotificationPreferences: builder.query<NotificationPreference[], void>({
      query: () => '/settings/notifications/preferences',
      providesTags: ['User'],
    }),
    updateNotificationPreference: builder.mutation<NotificationPreference, UpdateNotificationPreferenceRequest>({
      query: (body) => ({
        url: '/settings/notifications/preferences',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const { 
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferenceMutation,
} = notificationsApi;
