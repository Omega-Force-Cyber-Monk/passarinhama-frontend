import { ModalFieldGrid, ModalFullWidth, ModalSection, ModalMediaSplit, ModalSubmitButton } from "../components/ui/ModalLayout";
import "./ResourceEditorModals.css";
import { ContentCard, ContentCardSkeleton, ContentPageHeader, ContentStatusField, ContentStatusTabs, useListingStatus } from "../components/ui/ContentListing";
import CategoryManagerDialog, { type CategoryValues } from "../components/ui/CategoryManagerDialog";
import React, { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Edit2,
  Trash2,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { useAppToast } from "../components/ui/AppToastProvider";
import { FilePreviewCard, SelectedFilesPreview } from "../components/ui/FileUploadPreview";
import TiptapEditor from "../components/ui/TiptapEditor";
import { useI18n } from "../i18n";
import { usePermissions } from "../hooks/usePermissions";
import { useUploadFileMutation } from "../redux/features/articles/articlesApi";
import {
  useCreateTrainingCategoryMutation,
  useCreateTrainingMutation,
  useDeleteTrainingCategoryMutation,
  useDeleteTrainingMutation,
  useGetTrainingsPaginatedQuery,
  useGetTrainingCategoriesQuery,
  useUpdateTrainingCategoryMutation,
  useUpdateTrainingMutation,
} from "../redux/features/trainings/trainingsApi";
import type {
  Training,
  TrainingRequest,
  TrainingStatus,
} from "../redux/features/trainings/trainingTypes";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";

const PAGE_SIZE = 20;

type Attachment = string | { url: string; original_name?: string | null; file_name?: string | null };

type TrainingFormState = {
  title: string;
  excerpt: string;
  description: string;
  category_id: string;
  status: TrainingStatus;
  thumbnail: File | null;
  thumbnail_url: string | null;
  attachments: Attachment[];
};

const defaultFormState = (categoryId = ""): TrainingFormState => ({
  title: "",
  excerpt: "",
  description: "",
  category_id: categoryId,
  status: "draft",
  thumbnail: null,
  thumbnail_url: null,
  attachments: [],
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
  status: TrainingStatus,
  translate: (key: string, values?: Record<string, string | number>) => string,
) =>
  translate(`articlesPage.status${status.charAt(0).toUpperCase()}${status.slice(1)}`);

export default function Trainings() {
  const { translate, localeCode } = useI18n();
  const toast = useAppToast();
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId?: string }>();
  const { hasPermission, canModify, canAccessAdminPanel: isSuperuser } = usePermissions();
  const canViewTraining = hasPermission("training", "view");
  const canCreateTraining = hasPermission("training", "create");
  const canEditTraining = hasPermission("training", "edit");
  const canDeleteTraining = hasPermission("training", "delete");
  const canManageCategories = isSuperuser;
  const canViewLifecycleContent =
    canCreateTraining || canEditTraining || canDeleteTraining || isSuperuser;

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useListingStatus(canViewLifecycleContent);
  const { data: categoriesResponse, isLoading: isLoadingCategories, error: categoriesError, refetch: refetchCategories } = useGetTrainingCategoriesQuery({
    pageSize: 100,
  });
  const categories = categoriesResponse?.results ?? [];
  const { currentData: trainingsData, isLoading, isFetching, isError } = useGetTrainingsPaginatedQuery({
    page,
    pageSize: PAGE_SIZE,
    category_id: categoryId,
    status: statusFilter,
    details: true,
  });
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const trainings = (trainingsData?.results || []).filter((training) => training.status === statusFilter);
  const totalPages = trainingsData?.total_pages || 1;

  const [createTraining, { isLoading: isCreating }] = useCreateTrainingMutation();
  const [updateTraining, { isLoading: isUpdating }] = useUpdateTrainingMutation();
  const [deleteTraining, { isLoading: isDeleting }] = useDeleteTrainingMutation();
  const [uploadFile] = useUploadFileMutation();
  const [createCategory] = useCreateTrainingCategoryMutation();
  const [updateCategory] = useUpdateTrainingCategoryMutation();
  const [deleteCategory] = useDeleteTrainingCategoryMutation();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [formData, setFormData] = useState<TrainingFormState>(defaultFormState());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedAttachmentUrls, setRemovedAttachmentUrls] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [categoryId, statusFilter]);

  useEffect(() => {
    if (!categoryId || !categories.length) return;
    if (!categories.some((category) => category.id === categoryId)) {
      navigate("/trainings", { replace: true });
    }
  }, [categories, categoryId, navigate]);

  const defaultCategoryId = categoryId || categories[0]?.id || "";
  const canSubmitForm = Boolean(
    formData.title.trim() &&
      formData.category_id &&
      stripRichText(formData.description),
  );

  const openCreateForm = () => {
    if (!canCreateTraining) return;
    setEditingTraining(null);
    setFormData(defaultFormState(defaultCategoryId));
    setSelectedFiles([]);
    setRemovedAttachmentUrls([]);
    setIsFormOpen(true);
  };

  const openEditForm = (training: Training) => {
    if (!canModify("training", training, "edit")) return;
    setEditingTraining(training);
    setFormData({
      title: training.title,
      excerpt: training.excerpt || "",
      description: training.description || "",
      category_id: training.category?.id || training.category_id || defaultCategoryId,
      status: training.status,
      thumbnail: null,
      thumbnail_url: training.thumbnail_url,
      attachments: (training.attachments || []) as Attachment[],
    });
    setSelectedFiles([]);
    setRemovedAttachmentUrls([]);
    setIsFormOpen(true);
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    if (editingTraining ? !canModify("training", trainings.find((item) => item.id === editingTraining.id), "edit") : !canCreateTraining) throw new Error(translate("apiErrors.forbidden"));
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await uploadFile({ formData: data, authorization: { feature: "training", resourceId: editingTraining?.id } }).unwrap();
      return response.url;
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
      throw error;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingTraining ? !canModify("training", trainings.find((item) => item.id === editingTraining.id), "edit") : !canCreateTraining) return;

    if (!canSubmitForm) {
      const field = !formData.title.trim() ? "trainingsPage.trainingTitle"
        : !formData.category_id ? "articlesPage.category" : "trainingsPage.descriptionLabel";
      toast.error(translate("common.requiredField", { field: translate(field) }));
      return;
    }

    const payload: TrainingRequest = {
      title: formData.title.trim(),
      excerpt: formData.excerpt.trim(),
      description: formData.description,
      category_id: formData.category_id,
      status: formData.status,
      thumbnail: formData.thumbnail,
      attachments: selectedFiles,
    };

    try {
      if (editingTraining) {
        const updatePayload: Partial<TrainingRequest> = {
          ...payload,
          new_attachments: selectedFiles,
          remove_attachment_urls: removedAttachmentUrls,
        };
        delete updatePayload.attachments;
        if (!formData.thumbnail) delete updatePayload.thumbnail;
        await updateTraining({ id: editingTraining.id, data: updatePayload }).unwrap();
      } else {
        await createTraining(payload).unwrap();
      }

      toast.success(translate(editingTraining ? "trainingsPage.trainingUpdated" : "trainingsPage.trainingProposed"));
      setIsFormOpen(false);
      setEditingTraining(null);
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleDelete = async () => {
    if (!deletingId || !canModify("training", trainings.find((item) => item.id === deletingId), "delete")) return;
    try {
      await deleteTraining(deletingId).unwrap();
      toast.success(translate("trainingsPage.trainingDeleted"));
      setDeletingId(null);
    } catch (error) {
      toast.error(getApiErrorDisplayMessage(error, translate, "apiErrors.default"));
    }
  };

  const handleCreateCategory = async (values: CategoryValues) => {
    if (!isSuperuser) return;
    await createCategory({ name: values.name, description: values.description }).unwrap();
    toast.success(translate("trainingsPage.success"));
  };

  const handleUpdateCategory = async (id: string, values: CategoryValues) => {
    if (!isSuperuser) return;
    await updateCategory({ id, name: values.name, description: values.description }).unwrap();
    toast.success(translate("trainingsPage.success"));
  };

  const handleDeleteCategory = async (id: string) => {
    if (!isSuperuser) return;
    await deleteCategory(id).unwrap();
    if (categoryId === id) navigate("/trainings");
    toast.success(translate("trainingsPage.success"));
  };

  if (!canViewTraining) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  return (
    <div className="content-page">
      <ContentPageHeader
        title={selectedCategory?.name || translate("common.training")}
        description={selectedCategory?.description}
        canManageCategories={canManageCategories}
        onCategories={() => setIsCategoryModalOpen(true)}
        canCreate={canCreateTraining}
        onCreate={openCreateForm}
        createLabel={translate("trainingsPage.createTraining")}
      />
      {canViewLifecycleContent ? <ContentStatusTabs value={statusFilter} onChange={setStatusFilter} /> : null}

      {(isLoading || isFetching) && !trainings.length ? (
        <div className="content-list-grid">
          {Array.from({ length: 4 }).map((_, index) => <ContentCardSkeleton key={index} />)}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">{translate("contentListing.loadError")}</div>
      ) : trainings.length ? (
        <div className="content-list-grid">
          {trainings.map((training) => (
            <ContentCard
              key={training.id}
              image={training.thumbnail_url}
              fallbackIcon={<BookOpen className="h-8 w-8" />}
              category={training.category?.name || translate("common.training")}
              status={getLocalizedStatusLabel(training.status, translate)}
              title={training.title}
              description={training.excerpt || stripRichText(training.description || "")}
              metadata={new Date(training.created_at).toLocaleDateString(localeCode)}
              onNavigate={() => navigate('/trainings/' + training.id)}
              actions={[
                ...(canModify("training", training, "edit") ? [{ label: translate("trainingsPage.editTraining"), icon: <Edit2 className="h-4 w-4" />, onClick: () => openEditForm(training) }] : []),
                ...(canModify("training", training, "delete") ? [{ label: translate("trainingsPage.deleteTraining"), icon: <Trash2 className="h-4 w-4" />, onClick: () => { if (canModify("training", training, "delete")) setDeletingId(training.id); } }] : []),
              ]}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          {translate("trainingsPage.noTrainings")}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            {translate("contentListing.previous")}
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            {translate("contentListing.next")}
          </button>
      </div>

      <Modal
        isOpen={isFormOpen && (editingTraining ? canModify("training", trainings.find((item) => item.id === editingTraining.id), "edit") : canCreateTraining)}
        onClose={() => setIsFormOpen(false)}
        title={editingTraining ? translate("trainingsPage.editTraining") : translate("trainingsPage.createTraining")}
        layout="sectioned"
        className="resource-editor-modal"
        footer={(<ModalSubmitButton
          formId="training-editor-form"
          disabled={!canSubmitForm || isCreating || isUpdating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5 text-primary" />
          {isCreating || isUpdating ? translate("trainingsPage.savingEllipsis") : editingTraining ? translate("trainingsPage.saveTraining") : translate("trainingsPage.createTraining")}
        </ModalSubmitButton>)}
      >
        <form
          id="training-editor-form"
          noValidate
          onSubmit={handleSubmit}
          className="resource-editor-form">
          <ModalSection title={translate("modalBatchOne.basicInformation")}>
            <ModalFieldGrid>
              <ModalFullWidth>
                <label className="space-y-2 text-left">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {translate("trainingsPage.trainingTitle")}
                  </span>
                  <input
                    value={formData.title}
                    onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              </ModalFullWidth>
              <label className="space-y-2 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {translate("articlesPage.category")}
                </span>
                <select
                  value={formData.category_id}
                  onChange={(event) => setFormData((current) => ({ ...current, category_id: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{translate("articlesPage.selectCategory")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <ContentStatusField value={formData.status} onChange={(status) => setFormData((current) => ({ ...current, status }))} />
              <ModalFullWidth>
                <label className="block space-y-2 text-left">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {translate("articlesPage.excerpt")}
                  </span>
                  <textarea
                    value={formData.excerpt}
                    onChange={(event) => setFormData((current) => ({ ...current, excerpt: event.target.value }))}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              </ModalFullWidth>
            </ModalFieldGrid>
          </ModalSection>
          <ModalSection title={translate("modalBatchTwo.trainingContent")}>
            <ModalFullWidth>
              <div
                role="group"
                aria-labelledby="training-content-label"
                className="space-y-2 text-left">
                <span id="training-content-label" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {translate("trainingsPage.descriptionLabel")}
                </span>
                <TiptapEditor
                  content={formData.description}
                  placeholder={translate("trainingsPage.descriptionPlaceholder")}
                  ariaLabelledBy="training-content-label"
                  onChange={(description) => setFormData((current) => ({ ...current, description }))}
                  onImageUpload={handleImageUpload}
                />
              </div>
            </ModalFullWidth>
          </ModalSection>
          <ModalSection title={translate("modalBatchOne.mediaAttachments")}>
            <ModalMediaSplit preview={formData.thumbnail || formData.thumbnail_url ? (
              <FilePreviewCard
                presentation="compact"
                file={formData.thumbnail}
                url={formData.thumbnail_url || undefined}
                name={formData.thumbnail?.name || getAttachmentName(formData.thumbnail_url || "")} />
            ) : <p className="resource-editor-empty">{translate("modalFoundation.noFiles")}</p>}>
              <label className="space-y-2 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {translate("trainingsPage.thumbnailLabel")}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      thumbnail: event.target.files?.[0] || null,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"
                />
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold"
                />
              </label>
            </ModalMediaSplit>
            {formData.attachments.length ? (
              <ModalFieldGrid>
                {formData.attachments.map((attachment) => {
                  const url = getAttachmentUrl(attachment);
                  return (
                    <FilePreviewCard
                      presentation="compact"
                      key={url}
                      url={url}
                      name={getAttachmentName(attachment)}
                      href={url}
                      onRemove={() => {
                        setRemovedAttachmentUrls((current) => [...current, url]);
                        setFormData((current) => ({
                          ...current,
                          attachments: current.attachments.filter((item) => getAttachmentUrl(item) !== url),
                        }));
                      }}
                    />
                  );
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

      <ConfirmModal presentation="compact"
        isOpen={Boolean(deletingId && canModify("training", trainings.find((item) => item.id === deletingId), "delete"))}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title={translate("trainingsPage.deleteTraining")}
        message={translate("trainingsPage.deleteTrainingMessage")}
        isLoading={isDeleting}
        closeOnConfirm={false}
      />
    </div>
  );
}
