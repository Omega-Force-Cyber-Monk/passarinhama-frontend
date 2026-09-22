import { apiSlice } from "../api/apiSlice";
import {
  Training,
  TrainingCategory,
  TrainingPermission,
  TrainingRequest,
  PaginatedTrainings,
  GetTrainingsQueryParams,
  CreateTrainingCategoryRequest,
  UpdateTrainingCategoryRequest,
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
  appendIfDefined(formData, "excerpt", body.excerpt);
  appendIfDefined(formData, "description", body.description);
  appendIfDefined(formData, "category_id", body.category_id);
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
    getTrainingsPaginated: builder.query<PaginatedTrainings, GetTrainingsQueryParams | void>({
      query: (queryParams) => {
        const {
          page = 1,
          pageSize = 20,
          status,
          category_id,
          search,
          details,
        } = queryParams || {};
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(pageSize),
        });

        if (status) params.set("status", status);
        if (category_id) params.set("category_id", category_id);
        if (search?.trim()) params.set("search", search.trim());
        if (details !== undefined) params.set("details", String(details));

        return `/trainings/trainings?${params.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: "Training" as const, id })),
              { type: "Training", id: "LIST" },
            ]
          : [{ type: "Training", id: "LIST" }],
    }),
    getAllTrainings: builder.query<Training[], GetTrainingsQueryParams | void>({
      query: (queryParams) => {
        const {
          page = 1,
          pageSize = 100,
          status,
          category_id,
          search,
          details = true,
        } = queryParams || {};
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(pageSize),
          details: String(details),
        });

        if (status) params.set("status", status);
        if (category_id) params.set("category_id", category_id);
        if (search?.trim()) params.set("search", search.trim());

        return `/trainings/trainings?${params.toString()}`;
      },
      transformResponse: (response: Training[] | PaginatedTrainings): Training[] =>
        Array.isArray(response) ? response : response.results,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Training" as const, id })),
              { type: "Training", id: "LIST" },
            ]
          : [{ type: "Training", id: "LIST" }],
    }),
    getTrainingCategories: builder.query<TrainingCategory[], void>({
      query: () => "/trainings/training-categories",
      providesTags: ["TrainingCategory"],
    }),
    createTrainingCategory: builder.mutation<
      TrainingCategory,
      CreateTrainingCategoryRequest
    >({
      query: (body) => ({
        url: "/trainings/training-categories",
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: ["TrainingCategory", { type: "Training", id: "LIST" }],
    }),
    updateTrainingCategory: builder.mutation<
      TrainingCategory,
      UpdateTrainingCategoryRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/trainings/training-categories/${id}`,
        method: "PATCH",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: ["TrainingCategory", { type: "Training", id: "LIST" }],
    }),
    deleteTrainingCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/trainings/training-categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TrainingCategory", { type: "Training", id: "LIST" }],
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
  }),
});

export const {
  useGetTrainingsPaginatedQuery,
  useGetAllTrainingsQuery,
  useGetTrainingCategoriesQuery,
  useCreateTrainingCategoryMutation,
  useUpdateTrainingCategoryMutation,
  useDeleteTrainingCategoryMutation,
  useGetTrainingByIdQuery,
  useGetTrainingPermissionsQuery,
  useSetTrainingPermissionMutation,
  useCreateTrainingMutation,
  useUpdateTrainingMutation,
  useDeleteTrainingMutation,
} = trainingsApi;

export { buildTrainingFormData };
