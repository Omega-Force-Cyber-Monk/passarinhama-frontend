import { apiSlice } from "../api/apiSlice";
import {
  BulkTechnicoProPermissionResponse,
  CreateTechnicoProCategoryRequest,
  GetTechnicoProsQueryParams,
  PaginatedTechnicoPros,
  PublishTechnicoProResponse,
  SetTechnicoProPermissionRequest,
  TechnicoPro,
  TechnicoProCategory,
  TechnicoProPermission,
  TechnicoProRequest,
  UpdateTechnicoProCategoryRequest,
} from "./technicoproTypes";

const appendIfDefined = (formData: FormData, key: string, value: unknown) => {
  if (value !== undefined && value !== null) {
    formData.append(key, String(value));
  }
};

const buildTechnicoProFormData = (body: Partial<TechnicoProRequest>) => {
  const formData = new FormData();

  appendIfDefined(formData, "title", body.title);
  appendIfDefined(formData, "category_id", body.category_id);
  appendIfDefined(formData, "excerpt", body.excerpt);
  appendIfDefined(formData, "body", body.body);
  appendIfDefined(formData, "status", body.status);
  appendIfDefined(formData, "remove_file_urls", body.remove_file_urls);

  if (body.structured_fields !== undefined && body.structured_fields !== null) {
    formData.append(
      "structured_fields",
      typeof body.structured_fields === "string"
        ? body.structured_fields
        : JSON.stringify(body.structured_fields),
    );
  }

  if (body.thumbnail) {
    formData.append("thumbnail", body.thumbnail);
  }

  body.files?.forEach((file) => {
    formData.append("files", file);
  });

  return formData;
};

export const technicoProApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTechnicoPros: builder.query<PaginatedTechnicoPros, GetTechnicoProsQueryParams>({
      query: ({
        page = 1,
        pageSize = 20,
        status,
        category_id,
        search,
        details,
      }) => {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(pageSize),
        });

        if (status) params.set("status", status);
        if (category_id) params.set("category_id", category_id);
        if (search?.trim()) params.set("search", search.trim());
        if (details !== undefined) params.set("details", String(details));

        return `/technicopro/technicopros?${params.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: "TechnicoPro" as const,
                id,
              })),
              { type: "TechnicoPro", id: "LIST" },
            ]
          : [{ type: "TechnicoPro", id: "LIST" }],
    }),
    getMyTechnicoPros: builder.query<
      PaginatedTechnicoPros,
      { page?: number; pageSize?: number }
    >({
      query: ({ page = 1, pageSize = 20 }) =>
        `/technicopro/my-technicopros?page=${page}&page_size=${pageSize}`,
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: "TechnicoPro" as const,
                id,
              })),
              { type: "TechnicoPro", id: "MY_LIST" },
            ]
          : [{ type: "TechnicoPro", id: "MY_LIST" }],
    }),
    getTechnicoProCategories: builder.query<TechnicoProCategory[], void>({
      query: () => "/technicopro/technicopro-categories",
      providesTags: ["TechnicoProCategory"],
    }),
    createTechnicoProCategory: builder.mutation<
      TechnicoProCategory,
      CreateTechnicoProCategoryRequest
    >({
      query: (body) => ({
        url: "/technicopro/technicopro-categories",
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: ["TechnicoProCategory", { type: "TechnicoPro", id: "LIST" }],
    }),
    updateTechnicoProCategory: builder.mutation<
      TechnicoProCategory,
      UpdateTechnicoProCategoryRequest
    >({
      query: ({ id, ...body }) => ({
        url: `/technicopro/technicopro-categories/${id}`,
        method: "PATCH",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: ["TechnicoProCategory", { type: "TechnicoPro", id: "LIST" }],
    }),
    deleteTechnicoProCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/technicopro/technicopro-categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TechnicoProCategory", { type: "TechnicoPro", id: "LIST" }],
    }),
    createTechnicoPro: builder.mutation<TechnicoPro, TechnicoProRequest>({
      query: (data) => ({
        url: "/technicopro/technicopros",
        method: "POST",
        body: buildTechnicoProFormData(data),
      }),
      invalidatesTags: [
        { type: "TechnicoPro", id: "LIST" },
        { type: "TechnicoPro", id: "MY_LIST" },
      ],
    }),
    getTechnicoProById: builder.query<TechnicoPro, string>({
      query: (id) => `/technicopro/technicopros/${id}`,
      providesTags: (_result, _error, id) => [{ type: "TechnicoPro", id }],
    }),
    updateTechnicoPro: builder.mutation<
      TechnicoPro,
      { id: string; data: Partial<TechnicoProRequest> }
    >({
      query: ({ id, data }) => ({
        url: `/technicopro/technicopros/${id}`,
        method: "PATCH",
        body: buildTechnicoProFormData(data),
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "TechnicoPro", id },
        { type: "TechnicoPro", id: "LIST" },
        { type: "TechnicoPro", id: "MY_LIST" },
      ],
    }),
    deleteTechnicoPro: builder.mutation<void, string>({
      query: (id) => ({
        url: `/technicopro/technicopros/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "TechnicoPro", id: "LIST" },
        { type: "TechnicoPro", id: "MY_LIST" },
      ],
    }),
    publishTechnicoPro: builder.mutation<PublishTechnicoProResponse, string>({
      query: (id) => ({
        url: `/technicopro/technicopros/${id}/publish`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "TechnicoPro", id },
        { type: "TechnicoPro", id: "LIST" },
        { type: "TechnicoPro", id: "MY_LIST" },
      ],
    }),
    getTechnicoProPermissions: builder.query<TechnicoProPermission[], string>({
      query: (id) => `/technicopro/technicopros/${id}/permissions`,
      providesTags: (_result, _error, id) => [{ type: "TechnicoPro", id }],
    }),
    setTechnicoProPermission: builder.mutation<
      BulkTechnicoProPermissionResponse,
      SetTechnicoProPermissionRequest
    >({
      query: (body) => ({
        url: "/technicopro/technicopro/permissions/bulk",
        method: "PATCH",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      }),
      invalidatesTags: (_result, _error, { technicopro_id }) => [
        { type: "TechnicoPro", id: "LIST" },
        ...technicopro_id.map((id) => ({ type: "TechnicoPro" as const, id })),
      ],
    }),
  }),
});

export const {
  useGetTechnicoProsQuery,
  useGetMyTechnicoProsQuery,
  useGetTechnicoProCategoriesQuery,
  useCreateTechnicoProCategoryMutation,
  useUpdateTechnicoProCategoryMutation,
  useDeleteTechnicoProCategoryMutation,
  useCreateTechnicoProMutation,
  useGetTechnicoProByIdQuery,
  useUpdateTechnicoProMutation,
  useDeleteTechnicoProMutation,
  usePublishTechnicoProMutation,
  useGetTechnicoProPermissionsQuery,
  useSetTechnicoProPermissionMutation,
} = technicoProApi;
