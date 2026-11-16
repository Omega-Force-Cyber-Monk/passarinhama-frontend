import { projectionTags, mutationChanged } from '../api/cacheTags';
import { apiSlice } from "../api/apiSlice";
import type { CategoryQueryParams, PaginatedResponse } from "../api/apiTypes";
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
      providesTags: (result) => [{type:'TechnicoPro',id:'LIST'}, ...(result ? result.results.flatMap(item => [{type:'TechnicoPro' as const,id:item.id}, ...(item.category?.id ? [{type:'TechnicoProCategory' as const,id:item.category.id}] : [])]) : [])],
    }),
    getMyTechnicoPros: builder.query<
      PaginatedTechnicoPros,
      { page?: number; pageSize?: number }
    >({
      query: ({ page = 1, pageSize = 20 }) =>
        `/technicopro/my-technicopros?page=${page}&page_size=${pageSize}`,
      providesTags: (result) => [{type:'TechnicoPro',id:'MY_LIST'}, ...(result ? result.results.flatMap(item => [{type:'TechnicoPro' as const,id:item.id}, ...(item.category?.id ? [{type:'TechnicoProCategory' as const,id:item.category.id}] : [])]) : [])],
    }),
    getTechnicoProCategories: builder.query<
      PaginatedResponse<TechnicoProCategory>,
      CategoryQueryParams | void
    >({
      query: (arg) => {
        const params = arg && typeof arg === "object" ? arg : undefined;
        const searchParams = new URLSearchParams();
        if (params?.page) {
          searchParams.set("page", String(params.page));
        }
        const pageSize = params?.pageSize ?? params?.page_size ?? params?.limit;
        if (pageSize) {
          searchParams.set("page_size", String(pageSize));
        }
        if (params?.search?.trim()) {
          searchParams.set("search", params.search.trim());
        }
        const queryString = searchParams.toString();
        return `/technicopro/technicopro-categories${queryString ? `?${queryString}` : ""}`;
      },
      providesTags: (result) => [{type:'TechnicoProCategory',id:'LIST'}, ...(result?.results.map(item => ({type:'TechnicoProCategory' as const,id:item.id})) || [])],
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
      invalidatesTags: (result,error) => mutationChanged(error) ? [{type:'TechnicoProCategory',id:'LIST'}] : [],
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
      invalidatesTags: (result,error,arg) => mutationChanged(error) ? ([{type:'TechnicoProCategory',id:typeof arg==='string'?arg:arg.id},{type:'TechnicoProCategory',id:'LIST'},...projectionTags]) : [],
    }),
    deleteTechnicoProCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/technicopro/technicopro-categories/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result,error,arg) => mutationChanged(error) ? ([{type:'TechnicoProCategory',id:arg},{type:'TechnicoProCategory',id:'LIST'},...projectionTags,{type:'TechnicoPro',id:'LIST'},{type:'TechnicoPro',id:'MY_LIST'}]) : [],
    }),
    createTechnicoPro: builder.mutation<TechnicoPro, TechnicoProRequest>({
      query: (data) => ({
        url: "/technicopro/technicopros",
        method: "POST",
        body: buildTechnicoProFormData(data),
      }),
      invalidatesTags: (result,error) => mutationChanged(error) ? [
        { type: "TechnicoPro", id: "LIST" },
        { type: "TechnicoPro", id: "MY_LIST" },
        ...projectionTags] : [],
    }),
    getTechnicoProById: builder.query<TechnicoPro, string>({
      query: (id) => `/technicopro/technicopros/${id}`,
      providesTags: (result, error, id) => [{type:'TechnicoPro',id}, ...(result?.category?.id ? [{type:'TechnicoProCategory' as const,id:result.category.id}] : [])],
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
      invalidatesTags: (_result, _error, { id }) => mutationChanged(_error) ? ([
        { type: "TechnicoPro", id },
        { type: "TechnicoPro", id: "LIST" },
        { type: "TechnicoPro", id: "MY_LIST" },
        ...projectionTags]) : [],
    }),
    deleteTechnicoPro: builder.mutation<void, string>({
      query: (id) => ({
        url: `/technicopro/technicopros/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result,error,id) => mutationChanged(error) ? ([{type:'TechnicoPro',id},{type:'TechnicoPro',id:'LIST'},{type:'TechnicoPro',id:'MY_LIST'},...projectionTags]) : [],
    }),
    publishTechnicoPro: builder.mutation<PublishTechnicoProResponse, string>({
      query: (id) => ({
        url: `/technicopro/technicopros/${id}/publish`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (_result, _error, id) => mutationChanged(_error) ? ([
        { type: "TechnicoPro", id },
        { type: "TechnicoPro", id: "LIST" },
        { type: "TechnicoPro", id: "MY_LIST" },
        ...projectionTags]) : [],
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
      invalidatesTags: (_result, _error, { technicopro_id }) => mutationChanged(_error) ? ([
        { type: "TechnicoPro", id: "LIST" },
        ...technicopro_id.map((id) => ({ type: "TechnicoPro" as const, id })),
      ...projectionTags,]) : [],
    }),
  }),
});

export const {
  useGetTechnicoProsQuery,
  useGetMyTechnicoProsQuery,
  useGetTechnicoProCategoriesQuery,
  useLazyGetTechnicoProCategoriesQuery,
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
