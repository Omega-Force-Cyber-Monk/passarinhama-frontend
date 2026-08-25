import { apiSlice } from "../api/apiSlice";
import {
  Training,
  TrainingPermission,
  TrainingRequest,
  PaginatedTrainings,
  SetTrainingPermissionRequest,
  BulkTrainingPermissionResponse,
} from "./trainingTypes";

const appendIfDefined = (formData: FormData, key: string, value: unknown) => {
  if (value !== undefined && value !== null) {
    formData.append(key, String(value));
  }
};

const buildTrainingFormData = (body: Partial<TrainingRequest>) => {
  const formData = new FormData();

  appendIfDefined(formData, "title", body.title);
  appendIfDefined(formData, "description", body.description);
  appendIfDefined(formData, "instructor_name", body.instructor_name);
  appendIfDefined(formData, "format", body.format);
  appendIfDefined(formData, "training_date", body.training_date);
  appendIfDefined(formData, "end_date", body.end_date);
  appendIfDefined(formData, "duration_hours", body.duration_hours);
  appendIfDefined(formData, "max_attendees", body.max_attendees);
  appendIfDefined(formData, "status", body.status);
  body.remove_attachment_urls?.forEach((url) => {
    formData.append("remove_attachment_urls", url);
  });

  if (body.thumbnail) {
    formData.append("thumbnail", body.thumbnail);
  }

  body.attachments?.forEach((file) => {
    formData.append("attachments", file);
  });

  body.new_attachments?.forEach((file) => {
    formData.append("new_attachments", file);
  });

  return formData;
};

const resolveTrainingBody = (body: Partial<TrainingRequest> | FormData) =>
  body instanceof FormData ? body : buildTrainingFormData(body);

export const trainingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUpcomingTrainings: builder.query<
      PaginatedTrainings,
      { page?: number; pageSize?: number }
    >({
      query: ({ page = 1, pageSize = 20 }) =>
        `/trainings/trainings/upcoming?page=${page}&page_size=${pageSize}`,
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: "Training" as const,
                id,
              })),
              { type: "Training", id: "LIST" },
            ]
          : [{ type: "Training", id: "LIST" }],
    }),
    getAllTrainings: builder.query<Training[], void>({
      query: () => "/trainings/trainings",
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Training" as const, id })),
              { type: "Training", id: "LIST" },
            ]
          : [{ type: "Training", id: "LIST" }],
    }),
    getTrainingById: builder.query<Training, string>({
      query: (id) => `/trainings/trainings/${id}`,
      providesTags: (result, error, id) => [{ type: "Training", id }],
    }),
    getTrainingPermissions: builder.query<TrainingPermission[], string>({
      query: (id) => `/trainings/trainings/${id}/permissions`,
      providesTags: (_result, _error, id) => [{ type: "Training", id }],
    }),
    setTrainingPermission: builder.mutation<
      BulkTrainingPermissionResponse,
      SetTrainingPermissionRequest
    >({
      query: (body) => ({
        url: "/trainings/training/permissions/bulk",
        method: "PATCH",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: (_result, _error, { training_id }) => [
        { type: "Training", id: "LIST" },
        ...training_id.map((id) => ({ type: "Training" as const, id })),
      ],
    }),
    createTraining: builder.mutation<Training, TrainingRequest | FormData>({
      query: (data) => ({
        url: "/trainings/trainings",
        method: "POST",
        body: resolveTrainingBody(data),
      }),
      invalidatesTags: [{ type: "Training", id: "LIST" }],
    }),
    updateTraining: builder.mutation<
      Training,
      { id: string; data?: Partial<TrainingRequest>; formData?: FormData }
    >({
      query: ({ id, data, formData }) => ({
        url: `/trainings/trainings/${id}`,
        method: "PATCH",
        body: resolveTrainingBody(formData ?? data ?? {}),
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Training", id },
        { type: "Training", id: "LIST" },
      ],
    }),
    deleteTraining: builder.mutation<void, string>({
      query: (id) => ({
        url: `/trainings/trainings/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Training", id: "LIST" }],
    }),
    registerForTraining: builder.mutation<unknown, string>({
      query: (id) => ({
        url: `/trainings/trainings/${id}/register`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Training", id },
        { type: "Training", id: "LIST" },
      ],
    }),
    unregisterFromTraining: builder.mutation<void, string>({
      query: (id) => ({
        url: `/trainings/trainings/${id}/register`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Training", id },
        { type: "Training", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetUpcomingTrainingsQuery,
  useGetAllTrainingsQuery,
  useGetTrainingByIdQuery,
  useGetTrainingPermissionsQuery,
  useSetTrainingPermissionMutation,
  useCreateTrainingMutation,
  useUpdateTrainingMutation,
  useDeleteTrainingMutation,
  useRegisterForTrainingMutation,
  useUnregisterFromTrainingMutation,
} = trainingsApi;

export { buildTrainingFormData };
