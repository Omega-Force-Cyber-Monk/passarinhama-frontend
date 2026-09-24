import React, { useEffect, useState } from "react";
import { CheckCircle2, Edit2, FileText, Grid, Plus, Trash2, Wrench } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { useAppToast } from "../components/ui/AppToastProvider";
import TiptapEditor from "../components/ui/TiptapEditor";
import { FilePreviewCard, SelectedFilesPreview } from "../components/ui/FileUploadPreview";
import { useI18n } from "../i18n";
import { RootState } from "../redux/store";
import { usePermissions } from "../hooks/usePermissions";
import { useUploadFileMutation } from "../redux/features/articles/articlesApi";
import {
  useCreateTechnicoProCategoryMutation,
  useCreateTechnicoProMutation,
  useDeleteTechnicoProCategoryMutation,
  useDeleteTechnicoProMutation,
  useGetTechnicoProCategoriesQuery,
  useGetTechnicoProsQuery,
  useUpdateTechnicoProCategoryMutation,
  useUpdateTechnicoProMutation,
} from "../redux/features/technicopro/technicoproApi";
import type {
  TechnicoPro,
  TechnicoProCategory,
  TechnicoProRequest,
  TechnicoProStatus,
} from "../redux/features/technicopro/technicoproTypes";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";

const PAGE_SIZE = 20;

type Attachment = string | { url: string; original_name?: string | null; file_name?: string | null };

type FormState = {
  title: string;
  excerpt: string;
  body: string;
  category_id: string;
  status: TechnicoProStatus;
  thumbnail: File | null;
  thumbnail_url: string | null;
  file_urls: Attachment[];
};

const defaultFormState = (categoryId = ""): FormState => ({
  title: "",
  excerpt: "",
  body: "",
  category_id: categoryId,
  status: "draft",
  thumbnail: null,
  thumbnail_url: null,
  file_urls: [],
});

const stripRichText = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const getAttachmentUrl = (attachment: Attachment) =>
  typeof attachment === "string" ? attachment : attachment.url;

const getAttachmentName = (attachment: Attachment) => {
  if (typeof attachment !== "string") {
    return attachment.original_name || attachment.file_name || attachment.url.split("/").pop() || attachment.url;
  }

  try {
    return decodeURIComponent(attachment.split("/").pop() || attachment);
  } catch {
    return attachment.split("/").pop() || attachment;
  }
};

const getLocalizedStatusLabel = (
  status: TechnicoProStatus,
  translate: (key: string, values?: Record<string, string | number>) => string,
) =>
  translate(`articlesPage.status${status.charAt(0).toUpperCase()}${status.slice(1)}`);

export default function TechnicoProPage() {
  const { translate, localeCode } = useI18n();
  const toast = useAppToast();
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId?: string }>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { hasPermission } = usePermissions();
  const isSuperuser = Boolean(user?.is_superuser);
  const canView = hasPermission("technicopro", "view");
  const canCreate = hasPermission("technicopro", "create");
  const canEdit = hasPermission("technicopro", "edit");
  const canDelete = hasPermission("technicopro", "delete");
  const canManageCategories = canCreate || canEdit || isSuperuser;
  const canViewLifecycleContent = canCreate || canEdit || canDelete || isSuperuser;

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TechnicoProStatus>("published");
  const { data: categories = [] } = useGetTechnicoProCategoriesQuery();
  const { data, isLoading, isFetching } = useGetTechnicoProsQuery({
    page,
    pageSize: PAGE_SIZE,
    category_id: categoryId,
    status: statusFilter,
    details: true,
  });
  const items = data?.results || [];
  const totalPages = data?.total_pages || 1;
  const selectedCategory = categories.find((category) => category.id === categoryId);

  const [createItem, { isLoading: isCreating }] = useCreateTechnicoProMutation();
  const [updateItem, { isLoading: isUpdating }] = useUpdateTechnicoProMutation();
  const [deleteItem, { isLoading: isDeleting }] = useDeleteTechnicoProMutation();
  const [uploadFile] = useUploadFileMutation();
  const [createCategory, { isLoading: isCreatingCategory }] =
    useCreateTechnicoProCategoryMutation();
  const [updateCategory, { isLoading: isUpdatingCategory }] =
    useUpdateTechnicoProCategoryMutation();
  const [deleteCategory, { isLoading: isDeletingCategory }] =
    useDeleteTechnicoProCategoryMutation();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TechnicoPro | null>(null);
  const [formData, setFormData] = useState<FormState>(defaultFormState());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedFileUrls, setRemovedFileUrls] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TechnicoProCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [categoryDeletingId, setCategoryDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [categoryId, statusFilter]);

  useEffect(() => {
    if (!categoryId || !categories.length) return;
    if (!categories.some((category) => category.id === categoryId)) {
      navigate("/technicopro", { replace: true });
    }
  }, [categories, categoryId, navigate]);

  const defaultCategoryId = categoryId || categories[0]?.id || "";
  const canSubmitForm = Boolean(
    formData.title.trim() && formData.category_id && stripRichText(formData.body),
  );

  const openCreateForm = () => {
    setEditingItem(null);
    setFormData(defaultFormState(defaultCategoryId));
    setSelectedFiles([]);
    setRemovedFileUrls([]);
    setIsFormOpen(true);
  };

  const openEditForm = (item: TechnicoPro) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      excerpt: item.excerpt || "",
      body: item.body || "",
      category_id: item.category?.id || item.category_id || defaultCategoryId,
      status: item.status,
      thumbnail: null,
      thumbnail_url: item.thumbnail_url || null,
      file_urls: (item.structured_fields?.file_urls || []) as Attachment[],
    });
    setSelectedFiles([]);
    setRemovedFileUrls([]);
    setIsFormOpen(true);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const data = new FormData();
    data.append("file", file);
    const response = await uploadFile(data).unwrap();
    return response.url;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canSubmitForm) {
      toast.error(translate("common.requiredField", { field: translate("common.description") }));
      return;
    }

    const payload: TechnicoProRequest = {
      title: formData.title.trim(),
      excerpt: formData.excerpt.trim(),
      body: formData.body,
      category_id: formData.category_id,
      status: formData.status,
      thumbnail: formData.thumbnail,
      files: selectedFiles,
      structured_fields: {
        file_urls: formData.file_urls,
      },
      remove_file_urls: removedFileUrls.join(","),
    };

    try {
      if (editingItem) {
        await updateItem({ id: editingItem.id, data: payload }).unwrap();
      } else {
        await createItem(payload).unwrap();
      }
      toast.success(translate("technicoproPage.success"));
      setIsFormOpen(false);
      setEditingItem(null);
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteItem(deletingId).unwrap();
      toast.success(translate("technicoproPage.success"));
      setDeletingId(null);
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "" });
  };

  const handleSaveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error(translate("common.requiredField", { field: "Category" }));
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory({
          id: editingCategory.id,
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
        }).unwrap();
      } else {
        await createCategory({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
        }).unwrap();
      }
      resetCategoryForm();
      setIsCategoryModalOpen(false);
      toast.success(translate("technicoproPage.success"));
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategoryDeletingId(id);
    try {
      await deleteCategory(id).unwrap();
      toast.success(translate("technicoproPage.success"));
      if (categoryId === id) navigate("/technicopro");
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    } finally {
      setCategoryDeletingId(null);
    }
  };

  if (!canView) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  return (
    <div className="space-y-8 p-4 text-slate-900 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8 sm:text-3xl">
            {selectedCategory?.name || translate("common.technicopro")}
          </h2>
          {selectedCategory?.description ? (
            <p className="mt-3 max-w-2xl text-sm font-medium text-slate-500">
              {selectedCategory.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canManageCategories && (
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
            >
              <Grid className="h-5 w-5 text-primary" />
              {translate("articlesPage.newCategory")}
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-800"
            >
              <Plus className="h-5 w-5 text-primary" />
              {translate("technicoproPage.create")}
            </button>
          )}
        </div>
      </header>

      {canViewLifecycleContent ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {(["published", "pending", "draft"] as TechnicoProStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                statusFilter === status
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {getLocalizedStatusLabel(status, translate)}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading && !items.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          {translate("common.loading")}
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => navigate(`/technicopro/${item.id}`)}
                className="aspect-video bg-slate-100 text-left"
              >
                {item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <Wrench className="h-14 w-14" />
                  </div>
                )}
              </button>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-900">
                    {item.category?.name || translate("common.technicopro")}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {getLocalizedStatusLabel(item.status, translate)}
                  </span>
                </div>
                <h3 className="mt-4 line-clamp-2 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-3 line-clamp-3 text-sm font-medium leading-6 text-slate-500">
                  {item.excerpt || stripRichText(item.body || "")}
                </p>
                <div className="mt-auto flex items-center justify-between pt-5">
                  <span className="text-xs font-semibold text-slate-400">
                    {new Date(item.created_at).toLocaleDateString(localeCode)}
                  </span>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button type="button" onClick={() => openEditForm(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => setDeletingId(item.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          {translate("technicoproPage.empty")}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
          <button type="button" disabled={page <= 1 || isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40">
            Previous
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages || isFetching} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40">
            Next
          </button>
      </div>

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingItem ? translate("technicoproPage.edit") : translate("technicoproPage.create")} maxWidth="max-w-4xl">
        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input value={formData.title} onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))} placeholder={translate("trainingsPage.trainingTitle")} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none" />
            <select value={formData.category_id} onChange={(event) => setFormData((current) => ({ ...current, category_id: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none">
              <option value="">{translate("articlesPage.selectCategory")}</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <textarea value={formData.excerpt} onChange={(event) => setFormData((current) => ({ ...current, excerpt: event.target.value }))} placeholder={translate("articlesPage.excerpt")} className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none" />
          <TiptapEditor content={formData.body} onChange={(body) => setFormData((current) => ({ ...current, body }))} onImageUpload={handleImageUpload} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <select value={formData.status} onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value as TechnicoProStatus }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none">
              <option value="draft">{getLocalizedStatusLabel("draft", translate)}</option>
              <option value="pending">{getLocalizedStatusLabel("pending", translate)}</option>
              <option value="published">{getLocalizedStatusLabel("published", translate)}</option>
            </select>
            <input type="file" accept="image/*" onChange={(event) => setFormData((current) => ({ ...current, thumbnail: event.target.files?.[0] || null }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold" />
          </div>
          <input type="file" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold" />
          <SelectedFilesPreview files={selectedFiles} onRemove={(index) => setSelectedFiles((current) => current.filter((_, idx) => idx !== index))} />
          {formData.file_urls.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {formData.file_urls.map((attachment) => {
                const url = getAttachmentUrl(attachment);
                return <FilePreviewCard key={url} url={url} name={getAttachmentName(attachment)} href={url} onRemove={() => {
                  setRemovedFileUrls((current) => [...current, url]);
                  setFormData((current) => ({ ...current, file_urls: current.file_urls.filter((item) => getAttachmentUrl(item) !== url) }));
                }} />;
              })}
            </div>
          ) : null}
          <button type="submit" disabled={!canSubmitForm || isCreating || isUpdating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {translate("technicoproPage.save")}
          </button>
        </form>
      </Modal>

      <Modal isOpen={isCategoryModalOpen} onClose={() => { setIsCategoryModalOpen(false); setEditingCategory(null); setCategoryForm({ name: "", description: "" }); }} title={editingCategory ? translate("articlesPage.updateCategory") : translate("articlesPage.addNewCategory")}>
        <form noValidate onSubmit={handleSaveCategory} className="space-y-4">
          <input autoFocus value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder={translate("articlesPage.categoryNamePlaceholder")} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none" />
          <textarea value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} placeholder={translate("articlesPage.categoryDescriptionPlaceholder")} className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none" />
          {categories.length ? (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-bold text-slate-900">{category.name}</p>
                    {category.description ? <p className="line-clamp-2 text-xs text-slate-500">{category.description}</p> : null}
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => { setEditingCategory(category); setCategoryForm({ name: category.name, description: category.description || "" }); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"><Edit2 className="h-4 w-4" /></button>
                    <button type="button" disabled={categoryDeletingId === category.id || isDeletingCategory} onClick={() => handleDeleteCategory(category.id)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <button type="submit" disabled={!categoryForm.name.trim() || isCreatingCategory || isUpdatingCategory} className="w-full rounded-xl bg-slate-900 px-5 py-4 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50">
            {editingCategory ? translate("articlesPage.updateCategory") : translate("articlesPage.createCategory")}
          </button>
        </form>
      </Modal>

      <ConfirmModal isOpen={Boolean(deletingId)} onClose={() => setDeletingId(null)} onConfirm={handleDelete} title={translate("technicoproPage.delete")} message={translate("technicoproPage.deleteConfirm")} isLoading={isDeleting} closeOnConfirm={false} />
    </div>
  );
}
