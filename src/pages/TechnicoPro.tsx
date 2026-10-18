import { ModalFieldGrid, ModalFullWidth, ModalSection, ModalMediaSplit, ModalSubmitButton } from "../components/ui/ModalLayout";
import "./ResourceEditorModals.css";
import { ContentCard, ContentCardSkeleton, ContentPageHeader, ContentStatusField, ContentStatusTabs, useListingStatus } from "../components/ui/ContentListing";
import CategoryManagerDialog, { type CategoryValues } from "../components/ui/CategoryManagerDialog";
import React, { useEffect, useState } from "react";
import { CheckCircle2, Edit2, Trash2, Wrench } from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useListingStatus(canViewLifecycleContent);
  const { data: categoriesResponse, isLoading: isLoadingCategories, error: categoriesError, refetch: refetchCategories } = useGetTechnicoProCategoriesQuery({
    pageSize: 100,
  });
  const categories = categoriesResponse?.results ?? [];
  const { currentData: data, isLoading, isFetching, isError } = useGetTechnicoProsQuery({
    page,
    pageSize: PAGE_SIZE,
    category_id: categoryId,
    status: statusFilter,
    details: true,
  });
  const items = (data?.results || []).filter((item) => item.status === statusFilter);
  const totalPages = data?.total_pages || 1;
  const selectedCategory = categories.find((category) => category.id === categoryId);

  const [createItem, { isLoading: isCreating }] = useCreateTechnicoProMutation();
  const [updateItem, { isLoading: isUpdating }] = useUpdateTechnicoProMutation();
  const [deleteItem, { isLoading: isDeleting }] = useDeleteTechnicoProMutation();
  const [uploadFile] = useUploadFileMutation();
  const [createCategory] =
    useCreateTechnicoProCategoryMutation();
  const [updateCategory] =
    useUpdateTechnicoProCategoryMutation();
  const [deleteCategory] =
    useDeleteTechnicoProCategoryMutation();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TechnicoPro | null>(null);
  const [formData, setFormData] = useState<FormState>(defaultFormState());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedFileUrls, setRemovedFileUrls] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

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

  const handleCreateCategory = async (values: CategoryValues) => {
    await createCategory({ name: values.name, description: values.description }).unwrap();
    toast.success(translate("technicoproPage.success"));
  };

  const handleUpdateCategory = async (id: string, values: CategoryValues) => {
    await updateCategory({ id, name: values.name, description: values.description }).unwrap();
    toast.success(translate("technicoproPage.success"));
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id).unwrap();
    if (categoryId === id) navigate("/technicopro");
    toast.success(translate("technicoproPage.success"));
  };

  if (!canView) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  return (
    <div className="content-page">
      <ContentPageHeader
        title={selectedCategory?.name || translate("common.technicopro")}
        description={selectedCategory?.description}
        canManageCategories={canManageCategories}
        onCategories={() => setIsCategoryModalOpen(true)}
        canCreate={canCreate}
        onCreate={openCreateForm}
        createLabel={translate("technicoproPage.create")}
      />
      {canViewLifecycleContent ? <ContentStatusTabs value={statusFilter} onChange={setStatusFilter} /> : null}

      {(isLoading || isFetching) && !items.length ? (
        <div className="content-list-grid">
          {Array.from({ length: 4 }).map((_, index) => <ContentCardSkeleton key={index} />)}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">{translate("contentListing.loadError")}</div>
      ) : items.length ? (
        <div className="content-list-grid">
          {items.map((item) => (
            <ContentCard
              key={item.id}
              image={item.thumbnail_url}
              fallbackIcon={<Wrench className="h-8 w-8" />}
              category={item.category?.name || translate("common.technicopro")}
              status={getLocalizedStatusLabel(item.status, translate)}
              title={item.title}
              description={item.excerpt || stripRichText(item.body || "")}
              metadata={new Date(item.created_at).toLocaleDateString(localeCode)}
              onNavigate={() => navigate('/technicopro/' + item.id)}
              actions={[
                ...(canEdit ? [{ label: translate("technicoproPage.edit"), icon: <Edit2 className="h-4 w-4" />, onClick: () => openEditForm(item) }] : []),
                ...(canDelete ? [{ label: translate("technicoproPage.delete"), icon: <Trash2 className="h-4 w-4" />, onClick: () => setDeletingId(item.id) }] : []),
              ]}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          {translate("technicoproPage.empty")}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" disabled={page <= 1 || isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40">
            {translate("contentListing.previous")}
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages || isFetching} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40">
            {translate("contentListing.next")}
          </button>
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingItem ? translate("technicoproPage.edit") : translate("technicoproPage.create")}
        layout="sectioned"
        className="resource-editor-modal"
        footer={(<ModalSubmitButton
          formId="technicopro-editor-form"
          disabled={!canSubmitForm || isCreating || isUpdating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          {translate("technicoproPage.save")}
        </ModalSubmitButton>)}>
        <form
          id="technicopro-editor-form"
          noValidate
          onSubmit={handleSubmit}
          className="resource-editor-form">
          <ModalSection title={translate("modalBatchOne.basicInformation")}>
            <ModalFieldGrid>
              <ModalFullWidth>
                <label className="block space-y-2 text-left">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{translate("modalBatchTwo.title")}</span>
                  <input
                    value={formData.title}
                    onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                    placeholder={translate("trainingsPage.trainingTitle")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none" />
                </label>
              </ModalFullWidth>
              <label className="block space-y-2 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{translate("articlesPage.category")}</span>
                <select
                  value={formData.category_id}
                  onChange={(event) => setFormData((current) => ({ ...current, category_id: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none">
                  <option value="">{translate("articlesPage.selectCategory")}</option>
                  {categories.map((category) =>
                    <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <ContentStatusField value={formData.status} onChange={(status) => setFormData((current) => ({ ...current, status }))} />
              <ModalFullWidth>
                <label className="block space-y-2 text-left">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{translate("articlesPage.excerpt")}</span>
                  <textarea
                    value={formData.excerpt}
                    onChange={(event) => setFormData((current) => ({ ...current, excerpt: event.target.value }))}
                    placeholder={translate("articlesPage.excerpt")}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none" />
                </label>
              </ModalFullWidth>
            </ModalFieldGrid>
          </ModalSection>
          <ModalSection title={translate("modalBatchTwo.technicalContent")}>
            <ModalFullWidth>
              <div role="group" aria-label={translate("modalBatchTwo.technicalContent")}>
                <TiptapEditor
                  content={formData.body}
                  onChange={(body) => setFormData((current) => ({ ...current, body }))}
                  onImageUpload={handleImageUpload} />
              </div>
            </ModalFullWidth>
          </ModalSection>
          <ModalSection title={translate("modalBatchTwo.technicalMedia")}>
            <ModalMediaSplit preview={formData.thumbnail || formData.thumbnail_url ? (
              <FilePreviewCard
                presentation="compact"
                file={formData.thumbnail}
                url={formData.thumbnail_url || undefined}
                name={formData.thumbnail?.name || getAttachmentName(formData.thumbnail_url || "")} />
            ) : <p className="resource-editor-empty">{translate("modalFoundation.noFiles")}</p>}>
              <label className="block space-y-2 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{translate("trainingsPage.thumbnailLabel")}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setFormData((current) => ({ ...current, thumbnail: event.target.files?.[0] || null }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold" />
              </label>
            </ModalMediaSplit>
            <ModalMediaSplit preview={<SelectedFilesPreview
              presentation="compact"
              files={selectedFiles}
              onRemove={(index) => setSelectedFiles((current) => current.filter((_, idx) => idx !== index))} />}>
              <label className="block space-y-2 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{translate("articlesPage.attachmentsOptional")}</span>
                <input
                  type="file"
                  multiple
                  onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold" />
              </label>
            </ModalMediaSplit>
            {formData.file_urls.length ? (
              <ModalFieldGrid>
                {formData.file_urls.map((attachment) => {
                  const url = getAttachmentUrl(attachment);
                  return <FilePreviewCard
                    presentation="compact"
                    key={url}
                    url={url}
                    name={getAttachmentName(attachment)}
                    href={url}
                    onRemove={() => {
                      setRemovedFileUrls((current) => [...current, url]);
                      setFormData((current) => ({ ...current, file_urls: current.file_urls.filter((item) => getAttachmentUrl(item) !== url) }));
                    }} />;
                })}
              </ModalFieldGrid>
            ) : null}
          </ModalSection>
        </form>
      </Modal>

      <CategoryManagerDialog
        isOpen={isCategoryModalOpen && canManageCategories}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        isLoading={isLoadingCategories}
        error={categoriesError}
        onRetry={() => { void refetchCategories(); }}
        canCreate={canManageCategories}
        canEdit={canManageCategories}
        canDelete={canManageCategories}
        onCreate={handleCreateCategory}
        onUpdate={handleUpdateCategory}
        onDelete={handleDeleteCategory}
      />

      <ConfirmModal presentation="compact" isOpen={Boolean(deletingId)} onClose={() => setDeletingId(null)} onConfirm={handleDelete} title={translate("technicoproPage.delete")} message={translate("technicoproPage.deleteConfirm")} isLoading={isDeleting} closeOnConfirm={false} />
    </div>
  );
}
