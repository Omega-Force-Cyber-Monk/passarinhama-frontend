import { ModalMediaSplit, ModalSubmitButton } from "../components/ui/ModalLayout";
import { FilePreviewCard } from "../components/ui/FileUploadPreview";
import "./AgendaDocumentModals.css";
import {
  Folder,
  File,
  Search,
  Upload,
  MoreVertical,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  Download,
  Trash2,
  FolderPlus,
  Info,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import React, { useState } from "react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import FeedbackToast, {
  type FeedbackToastState,
} from "../components/ui/FeedbackToast";
import { useI18n } from "../i18n";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  useGetDocumentFoldersQuery,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useDeleteFolderMutation,
  useGetDocumentsQuery,
  useUploadDocumentMutation,
  useRenameDocumentMutation,
  useDeleteDocumentMutation,
  useLazyDownloadDocumentQuery,
} from "../redux/features/documents/documentsApi";
import {
  DocumentFolder,
  Document,
} from "../redux/features/documents/documentsTypes";
import {
  downloadUrlAsFile,
  fetchUrlAsObjectUrl,
  getAttachmentCategory,
  normalizeAttachment,
} from "../utils/attachments";
import { getApiErrorDisplayMessage } from "../utils/apiErrorMessages";
import { usePermissions } from "../hooks/usePermissions";
import "./DocumentLibrary.css";

const SkeletonBar = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-full bg-slate-100 ${className}`} />
);

const FolderGridSkeleton = () => (
  <div className="documents-grid">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm animate-pulse"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="h-12 w-12 rounded-xl bg-slate-100" />
          <div className="flex gap-1">
            <div className="h-8 w-8 rounded-lg bg-slate-100" />
            <div className="h-8 w-8 rounded-lg bg-slate-100" />
            <div className="h-8 w-8 rounded-lg bg-slate-100" />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <SkeletonBar className="h-4 w-2/3" />
          <SkeletonBar className="h-3 w-4/5" />
        </div>
      </div>
    ))}
  </div>
);

const FolderListSkeleton = () => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
      <SkeletonBar className="h-3 w-24" />
      <SkeletonBar className="h-3 w-20" />
    </div>
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="documents-loading-row px-6 py-4 border-b border-slate-50 last:border-b-0 animate-pulse"
      >
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-slate-100" />
          <SkeletonBar className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-slate-100" />
          <div className="h-8 w-8 rounded-lg bg-slate-100" />
          <div className="h-8 w-8 rounded-lg bg-slate-100" />
        </div>
      </div>
    ))}
  </div>
);

const FileGridSkeleton = () => (
  <div className="documents-grid">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-pulse"
      >
        <div className="h-32 bg-slate-100 rounded-xl mb-4" />
        <SkeletonBar className="h-4 w-4/5" />
        <div className="documents-file-footer">
          <SkeletonBar className="h-3 w-24" />
          <div className="flex gap-1">
            <div className="h-7 w-7 rounded-lg bg-slate-100" />
            <div className="h-7 w-7 rounded-lg bg-slate-100" />
            <div className="h-7 w-7 rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const FileListSkeleton = () => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
      <SkeletonBar className="h-3 w-24" />
      <SkeletonBar className="h-3 w-20" />
    </div>
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="documents-loading-row px-6 py-4 border-b border-slate-50 last:border-b-0 animate-pulse"
      >
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-slate-100" />
          <SkeletonBar className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-slate-100" />
          <div className="h-8 w-8 rounded-lg bg-slate-100" />
          <div className="h-8 w-8 rounded-lg bg-slate-100" />
        </div>
      </div>
    ))}
  </div>
);

const PreviewSkeleton = () => (
  <div className="space-y-4">
    <div className="documents-preview-toolbar flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <div className="min-w-0 space-y-2 flex-1">
        <SkeletonBar className="h-4 w-56" />
        <SkeletonBar className="h-3 w-32" />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SkeletonBar className="h-10 w-28 rounded-xl" />
        <SkeletonBar className="h-10 w-24 rounded-xl" />
      </div>
    </div>
    <div className="min-h-[60vh] bg-slate-50 border border-slate-100 rounded-2xl p-6">
      <div className="h-[60vh] rounded-2xl bg-slate-100 animate-pulse" />
    </div>
  </div>
);

const getPreviewType = (file?: Document | null) => {
  if (!file) return "unsupported" as const;
  const attachment = normalizeAttachment(file);
  if (!attachment) return "unsupported" as const;
  const category = getAttachmentCategory({
    extension: attachment.extension,
    mimeType: attachment.mimeType,
  });

  if (category === "office") return "document" as const;
  if (category === "file" || category === "archive" || category === "design") {
    return "unsupported" as const;
  }
  return category;
};

const getDocumentPreviewUrl = (file?: Document | null) =>
  file?.preview_url ||
  file?.document_url ||
  file?.file_url ||
  file?.storage_path ||
  null;

const DocumentContentPreview = ({
  file,
  compact = false,
}: {
  file: Document;
  compact?: boolean;
}) => {
  const previewType = getPreviewType(file);
  const previewUrl = getDocumentPreviewUrl(file);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const containerClass = compact ? "documents-thumbnail h-12 w-12 rounded-xl" : "documents-thumbnail h-32 rounded-xl";

  if (previewUrl && failedUrl !== previewUrl && previewType === "image") {
    return (
      <div className={`${containerClass} bg-slate-50 overflow-hidden`}>
        <img
          src={previewUrl}
          alt={file.original_name}
          onError={() => setFailedUrl(previewUrl)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (previewUrl && failedUrl !== previewUrl && previewType === "video") {
    return (
      <div className={`${containerClass} bg-black overflow-hidden`}>
        <video
          src={previewUrl}
          className="w-full h-full object-cover"
          onError={() => setFailedUrl(previewUrl)}
          muted
          playsInline
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <div
      className={`${containerClass} bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden px-3 text-center`}
    >
      <File className="w-8 h-8 text-slate-300" />
      {!compact && (
        <span className="mt-2 max-w-full truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {file.file_type || file.mime_type?.split("/")[1] || "file"}
        </span>
      )}
    </div>
  );
};

const DocumentLibraryPageSkeleton = () => (
  <div className="documents-page"><div className="documents-content" aria-hidden="true">
    <header className="documents-header">
      <div className="space-y-4">
        <SkeletonBar className="h-10 w-52" />
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-4 w-16" />
          <SkeletonBar className="h-4 w-4 rounded-full" />
          <SkeletonBar className="h-4 w-20" />
        </div>
      </div>
      <div className="flex gap-2">
        <SkeletonBar className="h-10 w-36 rounded-xl" />
        <SkeletonBar className="h-10 w-28 rounded-xl" />
      </div>
    </header>

    <div className="documents-toolbar bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
      <div className="documents-search h-11 rounded-xl bg-slate-100 animate-pulse" />
      <div className="documents-view-toggle flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
        <div className="h-9 w-9 rounded-lg bg-white shadow-sm animate-pulse" />
        <div className="h-9 w-9 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    </div>

    <div className="space-y-10">
      <section className="space-y-4">
        <SkeletonBar className="h-3 w-20" />
        <FolderGridSkeleton />
      </section>
      <section className="space-y-4">
        <SkeletonBar className="h-3 w-16" />
        <FileGridSkeleton />
      </section>
    </div>
  </div></div>
);

const getFolderItemCount = (folder: DocumentFolder): number =>
  (folder.document_count ?? 0) + (folder.children?.length ?? 0);

export default function DocumentLibrary() {
  const { translate } = useI18n();

  const formatFolderItemCount = (folder: DocumentFolder) => {
    const itemCount = getFolderItemCount(folder);
    const key =
      itemCount === 1
        ? "documentLibraryPage.itemLabel"
        : "documentLibraryPage.itemsLabel";
    return translate(key, { count: itemCount });
  };
  const { hasPermission } = usePermissions();
  const canViewDocument = hasPermission("document", "view");
  const canCreateDocument = hasPermission("document", "create");
  const canEditDocument = hasPermission("document", "edit");
  const canDeleteDocument = hasPermission("document", "delete");
  const navigate = useNavigate();
  const { folderId, fileId } = useParams<{
    folderId?: string;
    fileId?: string;
  }>();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allFolders, isLoading: isLoadingFolders } =
    useGetDocumentFoldersQuery();

  const [createFolder] = useCreateFolderMutation();
  const [updateFolderMutation] = useUpdateFolderMutation();
  const [deleteFolderMutation] = useDeleteFolderMutation();
  const [uploadDocument, { isLoading: isUploading }] = useUploadDocumentMutation();
  const [renameDocumentMutation] = useRenameDocumentMutation();
  const [deleteDocumentMutation] = useDeleteDocumentMutation();
  const [downloadTrigger] = useLazyDownloadDocumentQuery();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [deletingInfo, setDeletingInfo] = useState<{
    id: string;
    type: "folder" | "file";
  } | null>(null);

  const [renameInfo, setRenameInfo] = useState<{
    id: string;
    name: string;
    type: "folder" | "file";
  } | null>(null);

  const [newFolderName, setNewFolderName] = useState("");
  const [renamingName, setRenamingName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [toast, setToast] = useState<FeedbackToastState | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);

  const rootPath = [{ id: null, name: translate("documentLibraryPage.root") }];

  const findFolderInTree = (
    folders: DocumentFolder[],
    id: string,
  ): DocumentFolder | undefined => {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      if (folder.children && folder.children.length > 0) {
        const found = findFolderInTree(folder.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const buildFolderPath = (
    folders: DocumentFolder[],
    id: string,
    trail: { id: string | null; name: string }[] = rootPath,
  ): { id: string | null; name: string }[] | null => {
    for (const folder of folders) {
      const nextTrail = [...trail, { id: folder.id, name: folder.name }];

      if (folder.id === id) {
        return nextTrail;
      }

      if (folder.children?.length) {
        const foundTrail = buildFolderPath(folder.children, id, nextTrail);

        if (foundTrail) {
          return foundTrail;
        }
      }
    }

    return null;
  };

  const path =
    folderId && allFolders
      ? buildFolderPath(allFolders, folderId) || rootPath
      : rootPath;

  const currentFolder = path[path.length - 1];
  const { data: folderContent, isLoading: isLoadingContent } =
    useGetDocumentsQuery(
      { folder_id: currentFolder.id || "" },
      { skip: !currentFolder.id },
    );

  const folders = !currentFolder.id
    ? allFolders || []
    : (allFolders
        ? findFolderInTree(allFolders, currentFolder.id)?.children
        : []) || [];

  const files = folderContent?.documents || [];
  const selectedPreviewFile = files.find((file) => file.id === fileId) || null;
  const previewSourceUrl = selectedPreviewFile ? getDocumentPreviewUrl(selectedPreviewFile) : null;
  const previewMimeType = selectedPreviewFile?.mime_type;

  React.useEffect(() => {
    if (!folderId) {
      return;
    }

    if (isLoadingFolders || !allFolders) {
      return;
    }

    const matchedPath = buildFolderPath(allFolders, folderId);

    if (!matchedPath) {
      navigate("/documents", { replace: true });
    }
  }, [allFolders, buildFolderPath, folderId, isLoadingFolders, navigate]);

  React.useEffect(() => {
    if (fileId && folderId && !isLoadingContent && !selectedPreviewFile) {
      navigate(`/documents/folder/${folderId}`, { replace: true });
    }
  }, [fileId, folderId, isLoadingContent, selectedPreviewFile, navigate]);

  React.useEffect(() => {
    setPreviewUrl(null);
    if (!fileId || !folderId || !previewSourceUrl) {
      setIsLoadingPreview(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    setIsLoadingPreview(true);
    void fetchUrlAsObjectUrl(previewSourceUrl, previewMimeType)
      .then((nextObjectUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }
        objectUrl = nextObjectUrl;
        setPreviewUrl(nextObjectUrl);
      })
      .catch((error) => {
        if (!cancelled) {
          notifyError(error);
          setPreviewUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPreview(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
  }, [fileId, folderId, previewSourceUrl, previewMimeType]);

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const filteredFiles = files.filter((f) =>
    f.original_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const notify = (
    message: string,
    type: FeedbackToastState["type"] = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const notifySuccess = (message = translate("documentLibraryPage.success")) => {
    notify(message);
  };

  const notifyError = (error: unknown) => {
    notify(getApiErrorDisplayMessage(error, translate), "error");
  };

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateDocument) return;
    if (!newFolderName.trim()) {
      notify(
        translate("common.requiredField", {
          field: translate("documentLibraryPage.folderName"),
        }),
        "error",
      );
      return;
    }
    try {
      await createFolder({
        name: newFolderName.trim(),
        parent_id: currentFolder.id,
      }).unwrap();
      setNewFolderName("");
      setIsFolderModalOpen(false);
      notifySuccess();
    } catch (error) {
      notifyError(error);
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateDocument) return;
    if (!selectedFile) {
      notify(
        translate("common.requiredField", {
          field: translate("documentLibraryPage.uploadFileTitle"),
        }),
        "error",
      );
      return;
    }
    try {
      await uploadDocument({
        folder_id: currentFolder.id || "",
        file: selectedFile,
      }).unwrap();
      closeUploadModal();
      notifySuccess();
    } catch (error) {
      notifyError(error);
    }
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setIsDragActive(false);
  };

  const handleFileSelection = (file: File | null) => {
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
      return;
    }
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);

    const file = e.dataTransfer.files?.[0] || null;
    handleFileSelection(file);
  };

  const confirmDelete = (
    id: string,
    type: "folder" | "file",
    e?: React.MouseEvent,
  ) => {
    if (!canDeleteDocument) return;
    if (e) e.stopPropagation();
    setDeletingInfo({ id, type });
    setIsConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (deletingInfo) {
      try {
        if (deletingInfo.type === "folder") {
          await deleteFolderMutation(deletingInfo.id).unwrap();
        } else {
          await deleteDocumentMutation(deletingInfo.id).unwrap();
        }
        setDeletingInfo(null);
        setIsConfirmOpen(false);
        notifySuccess();

        if (deletingInfo.type === "folder") {
          const deletedFolderIndex = path.findIndex(
            (item) => item.id === deletingInfo.id,
          );

          if (deletedFolderIndex !== -1) {
            const parentFolderId = path[deletedFolderIndex - 1]?.id;
            navigate(
              parentFolderId
                ? `/documents/folder/${parentFolderId}`
                : "/documents",
            );
          }
        }

        if (deletingInfo.type === "file" && fileId === deletingInfo.id) {
          navigate(
            currentFolder.id
              ? `/documents/folder/${currentFolder.id}`
              : "/documents",
          );
        }
      } catch (error) {
        notifyError(error);
      }
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditDocument || !renameInfo) return;
    if (!renamingName.trim()) {
      notify(
        translate("common.requiredField", {
          field: translate("documentLibraryPage.newName"),
        }),
        "error",
      );
      return;
    }
    try {
      if (renameInfo.type === "folder") {
        await updateFolderMutation({
          id: renameInfo.id,
          body: { name: renamingName.trim() },
        }).unwrap();
      } else {
        await renameDocumentMutation({
          id: renameInfo.id,
          body: { original_name: renamingName.trim() },
        }).unwrap();
      }
      setIsRenameModalOpen(false);
      setRenameInfo(null);
      notifySuccess();
    } catch (error) {
      notifyError(error);
    }
  };

  const handleDownload = async (id: string, fallbackName?: string) => {
    if (downloadingIds.includes(id)) return;

    setDownloadingIds((current) => [...current, id]);
    try {
      const { download_url, filename } = await downloadTrigger(id).unwrap();
      await downloadUrlAsFile(download_url, filename || fallbackName || "download");
    } catch (error) {
      notifyError(error);
    } finally {
      setDownloadingIds((current) => current.filter((item) => item !== id));
    }
  };

  const handleOpenFolder = (folder: DocumentFolder) => {
    navigate(`/documents/folder/${folder.id}`);
  };

  const handleOpenFile = async (file: Document) => {
    if (!currentFolder.id) {
      return;
    }

    navigate(`/documents/folder/${currentFolder.id}/file/${file.id}`);
  };

  const navigateToPathItem = (id: string | null) => {
    navigate(id ? `/documents/folder/${id}` : "/documents");
  };

  const handleClosePreview = () => {
    navigate(currentFolder.id ? `/documents/folder/${currentFolder.id}` : "/documents");
  };

  const previewType = getPreviewType(selectedPreviewFile);
  const openPreviewUrl = previewUrl;
  const showInitialPageSkeleton = isLoadingFolders && !allFolders;

  if (!canViewDocument) {
    return <Navigate to="/" replace state={{ accessRestricted: true }} />;
  }

  if (showInitialPageSkeleton) {
    return <DocumentLibraryPageSkeleton />;
  }

  return (
    <div className="documents-page">
      <FeedbackToast toast={toast} />

      <div className="documents-content">
      <header className="documents-header">
        <div className="documents-heading">
          <h2 className="documents-title text-3xl font-bold tracking-tight text-slate-900 underline decoration-primary decoration-4 underline-offset-8">
            {translate("documentLibraryPage.title")}
          </h2>
          <nav className="documents-breadcrumbs" aria-label={translate("documentLibraryPage.location")}>
            {path.map((item, idx) => (
              <div key={item.id || "root"} className="documents-breadcrumb">
                <button
                  aria-current={idx === path.length - 1 ? "page" : undefined}
                  onClick={() => navigateToPathItem(item.id)}
                  className={`transition-colors font-medium cursor-pointer ${idx === path.length - 1 ? "text-slate-900 font-bold" : "hover:text-primary-dark"}`}
                >
                  {item.name}
                </button>
                {idx < path.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                )}
              </div>
            ))}
          </nav>
        </div>
        <div className="documents-header-actions">
          {canCreateDocument && (
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="content-page-button content-page-button-secondary"
            >
              <FolderPlus className="w-4 h-4" />{" "}
              {translate("documentLibraryPage.newFolder")}
            </button>
          )}
          {canCreateDocument && currentFolder.id && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="content-page-button content-page-button-primary"
            >
              <Upload className="w-4 h-4" />{" "}
              {translate("documentLibraryPage.upload")}
            </button>
          )}
        </div>
      </header>

      {/* Tool bar */}
      <div className="documents-toolbar rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="documents-search relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            aria-label={translate("documentLibraryPage.searchPlaceholder")}
            placeholder={translate("documentLibraryPage.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="documents-view-toggle flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100" role="group" aria-label={translate("documentLibraryPage.displayMode")}>
          <button
            aria-label={translate("documentLibraryPage.gridView")}
            title={translate("documentLibraryPage.gridView")}
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-900"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            aria-label={translate("documentLibraryPage.listView")}
            title={translate("documentLibraryPage.listView")}
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg transition-all cursor-pointer ${viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-900"}`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-10">
        {/* Folders */}
        <section>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">
            {translate("documentLibraryPage.folders")}
          </h3>
          {isLoadingFolders ? (
            viewMode === "grid" ? (
              <FolderGridSkeleton />
            ) : (
              <FolderListSkeleton />
            )
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === "grid" ? (
                <motion.div
                  key="folders-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="documents-grid"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredFolders.map((folder) => {
                      const colors = [
                        "bg-blue-50 text-blue-600",
                        "bg-emerald-50 text-emerald-600",
                        "bg-purple-50 text-purple-600",
                        "bg-amber-50 text-amber-600",
                      ];
                      const colorClass = colors[folder.name.length % colors.length];

                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          key={folder.id}
                          whileHover={{ y: -4 }}
                          onClick={() => handleOpenFolder(folder)}
                          className="documents-folder-card bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
                        >
                          <div className="flex items-start justify-between">
                            <div className={`documents-folder-icon p-3 rounded-xl ${colorClass}`}>
                              <Folder className="w-6 h-6" />
                            </div>
                            {(canEditDocument || canDeleteDocument) && (
                              <div className="flex gap-1">
                                {canEditDocument && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenameInfo({
                                        id: folder.id,
                                        name: folder.name,
                                        type: "folder",
                                      });
                                      setRenamingName(folder.name);
                                      setIsRenameModalOpen(true);
                                    }}
                                    className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                    aria-label={translate("documentLibraryPage.rename")}
                                    title={translate("documentLibraryPage.rename")}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                )}
                                {canDeleteDocument && (
                                  <button
                                    aria-label={translate("documentLibraryPage.delete")}
                                    onClick={(e) =>
                                      confirmDelete(folder.id, "folder", e)
                                    }
                                    className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="mt-4">
                            <h4 className="documents-name font-bold text-slate-900 group-hover:text-primary-dark transition-colors">
                          <button type="button" className="documents-open" title={folder.name} onClick={(event) => { event.stopPropagation(); handleOpenFolder(folder); }} aria-label={translate("documentLibraryPage.openItem", { name: folder.name })}>{folder.name}</button>
                        </h4>
                            <p className="text-xs text-slate-400 mt-1">
                              {formatFolderItemCount(folder)}{" "}
                              •{" "}
                              {folder.can_upload
                                ? translate("documentLibraryPage.uploadEnabled")
                                : translate("documentLibraryPage.readOnly")}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <div className="documents-list-wrap">
                <motion.div
                  key="folders-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  <table role="table" className="documents-table documents-folder-table">
                    <thead role="rowgroup" className="bg-slate-50/50 border-b border-slate-100">
                      <tr role="row">
                        <th role="columnheader" scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {translate("documentLibraryPage.name")}
                        </th>
                        <th role="columnheader" scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {translate("documentLibraryPage.items")}
                        </th>
                        <th role="columnheader" scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {translate("documentLibraryPage.permissions")}
                        </th>
                        <th role="columnheader" scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                          {translate("documentLibraryPage.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup" className="divide-y divide-slate-50 text-sm">
                      {filteredFolders.map((folder) => (
                        <tr role="row"
                          key={folder.id}
                          onClick={() => handleOpenFolder(folder)}
                          className="transition-colors group cursor-pointer hover:bg-slate-50/50"
                        >
                          <td role="cell" className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Folder className="w-5 h-5 text-slate-400" />
                              <div className="documents-name font-semibold text-slate-900"><button type="button" className="documents-open" title={folder.name} onClick={(event) => { event.stopPropagation(); handleOpenFolder(folder); }} aria-label={translate("documentLibraryPage.openItem", { name: folder.name })}>{folder.name}</button></div>
                            </div>
                          </td>
                          <td role="cell" data-label={translate("documentLibraryPage.items")} className="px-6 py-4 text-slate-500">
                            {formatFolderItemCount(folder)}
                          </td>
                          <td role="cell" data-label={translate("documentLibraryPage.permissions")} className="px-6 py-4 text-slate-500">
                            {folder.can_upload
                              ? translate("documentLibraryPage.uploadEnabled")
                              : translate("documentLibraryPage.readOnly")}
                          </td>
                          <td role="cell" className="px-6 py-4 text-right">
                            {(canEditDocument || canDeleteDocument) && (
                              <div className="flex justify-end gap-2">
                                {canEditDocument && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenameInfo({
                                        id: folder.id,
                                        name: folder.name,
                                        type: "folder",
                                      });
                                      setRenamingName(folder.name);
                                      setIsRenameModalOpen(true);
                                    }}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
                                    aria-label={translate("documentLibraryPage.rename")}
                                    title={translate("documentLibraryPage.rename")}
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                )}
                                {canDeleteDocument && (
                                  <button
                                    aria-label={translate("documentLibraryPage.delete")}
                                    onClick={(e) =>
                                      confirmDelete(folder.id, "folder", e)
                                    }
                                    className="p-2 hover:bg-red-50 rounded-lg text-red-400 cursor-pointer"
                                    title={translate("documentLibraryPage.delete")}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
                </div>
              )}
            </AnimatePresence>
          )}
        </section>

        {currentFolder.id && (
          <section>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">
              {translate("documentLibraryPage.files")}
            </h3>
            {isLoadingContent ? (
              viewMode === "grid" ? (
                <FileGridSkeleton />
              ) : (
                <FileListSkeleton />
              )
            ) : (
              <AnimatePresence mode="wait">
                {viewMode === "grid" ? (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="documents-grid"
                  >
                    {filteredFiles.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleOpenFile(file)}
                        className={`documents-file-card bg-white p-4 rounded-2xl border shadow-sm transition-colors group cursor-pointer ${
                          fileId === file.id
                            ? "border-primary/60 ring-2 ring-primary/10"
                            : "border-slate-100 hover:border-primary/40"
                        }`}
                      >
                        <div className="relative mb-4">
                          <DocumentContentPreview file={file} />
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-white border border-slate-100 rounded text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                            {file.mime_type.split("/")[1]}
                          </span>
                        </div>
                        <h4 className="documents-name text-sm font-bold text-slate-900">
                          <button type="button" className="documents-open" title={file.original_name} onClick={(event) => { event.stopPropagation(); handleOpenFile(file); }} aria-label={translate("documentLibraryPage.openItem", { name: file.original_name })}>{file.original_name}</button>
                        </h4>
                        <div className="documents-file-footer">
                          <span className="text-[10px] text-slate-400 font-medium tracking-tight uppercase">
                            {file.file_size_display} •{" "}
                            {new Date(file.created_at).toLocaleDateString()}
                          </span>
                          <div className="documents-file-actions">
                            <button
                              aria-label={translate("documentLibraryPage.download")}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(file.id, file.original_name);
                              }}
                              disabled={downloadingIds.includes(file.id)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer disabled:opacity-50"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {canEditDocument && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameInfo({
                                    id: file.id,
                                    name: file.original_name,
                                    type: "file",
                                  });
                                  setRenamingName(file.original_name);
                                  setIsRenameModalOpen(true);
                                }}
                                aria-label={translate("documentLibraryPage.rename")}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteDocument && (
                              <button
                                aria-label={translate("documentLibraryPage.delete")}
                                onClick={(e) => confirmDelete(file.id, "file", e)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="documents-list-wrap">
                  <motion.div
                    key="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                  >
                    <table role="table" className="documents-table documents-file-table">
                      <thead role="rowgroup" className="bg-slate-50/50 border-b border-slate-100">
                        <tr role="row">
                          <th role="columnheader" scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {translate("documentLibraryPage.name")}
                          </th>
                          <th role="columnheader" scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {translate("documentLibraryPage.modified")}
                          </th>
                          <th role="columnheader" scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {translate("documentLibraryPage.size")}
                          </th>
                          <th role="columnheader" scope="col" className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                            {translate("documentLibraryPage.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup" className="divide-y divide-slate-50 text-sm">
                        {filteredFiles.map((file) => (
                          <tr role="row"
                            key={file.id}
                            onClick={() => handleOpenFile(file)}
                            className={`transition-colors group cursor-pointer ${
                              fileId === file.id
                                ? "bg-primary/5"
                                : "hover:bg-slate-50/50"
                            }`}
                          >
                            <td role="cell" className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <DocumentContentPreview file={file} compact />
                                <div className="documents-name font-semibold text-slate-900"><button type="button" className="documents-open" title={file.original_name} onClick={(event) => { event.stopPropagation(); handleOpenFile(file); }} aria-label={translate("documentLibraryPage.openItem", { name: file.original_name })}>{file.original_name}</button><p className="mt-1 text-xs font-normal text-slate-500">{file.file_type || file.mime_type}</p></div>
                              </div>
                            </td>
                            <td role="cell" data-label={translate("documentLibraryPage.modified")} className="px-6 py-4 text-slate-500">
                              {new Date(file.created_at).toLocaleDateString()}
                            </td>
                            <td role="cell" data-label={translate("documentLibraryPage.size")} className="px-6 py-4 text-slate-500">
                              {file.file_size_display}
                            </td>
                            <td role="cell" className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {canEditDocument && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenameInfo({
                                        id: file.id,
                                        name: file.original_name,
                                        type: "file",
                                      });
                                      setRenamingName(file.original_name);
                                      setIsRenameModalOpen(true);
                                    }}
                                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
                                    aria-label={translate("documentLibraryPage.rename")}
                                    title={translate("documentLibraryPage.rename")}
                                  >
                                    <Info className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(file.id, file.original_name);
                                  }}
                                  disabled={downloadingIds.includes(file.id)}
                                  className="p-2 hover:bg-primary/10 rounded-lg text-primary-dark cursor-pointer disabled:opacity-50"
                                  aria-label={translate("documentLibraryPage.download")}
                                  title={translate("documentLibraryPage.download")}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                {canDeleteDocument && (
                                  <button
                                    aria-label={translate("documentLibraryPage.delete")}
                                    onClick={(e) => confirmDelete(file.id, "file", e)}
                                    className="p-2 hover:bg-red-50 rounded-lg text-red-400 cursor-pointer"
                                    title={translate("documentLibraryPage.delete")}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                  </div>
                )}
              </AnimatePresence>
            )}
          </section>
        )}
      </div>

      </div>

      <Modal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        title={translate("documentLibraryPage.newFolder")}
        layout="compact"
        className="batch-three-modal"
        maxWidth="max-w-md"
        footer={(<ModalSubmitButton formId="document-folder-form"
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all font-bold uppercase tracking-widest cursor-pointer"
        >
          {translate("documentLibraryPage.createFolder")}
        </ModalSubmitButton>)}>
        <form
          id="document-folder-form"
          noValidate
          onSubmit={handleAddFolder}
          className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="document-folder-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("documentLibraryPage.folderName")}
            </label>
            <input
              required
              autoFocus
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              id="document-folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        title={
          renameInfo?.type === "folder"
            ? translate("documentLibraryPage.renameFolder")
            : translate("documentLibraryPage.renameFile")
        }
        layout="compact"
        className="batch-three-modal"
        maxWidth="max-w-md"
        footer={(<ModalSubmitButton formId="document-rename-form"
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all font-bold uppercase tracking-widest cursor-pointer"
        >
          {translate("documentLibraryPage.rename")}
        </ModalSubmitButton>)}>
        <form
          id="document-rename-form"
          noValidate
          onSubmit={handleRename}
          className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="document-rename-name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {translate("documentLibraryPage.newName")}
            </label>
            <input
              required
              autoFocus
              type="text"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              id="document-rename-name"
              value={renamingName}
              onChange={(e) => setRenamingName(e.target.value)}
            />
          </div>
        </form>
      </Modal>
      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={closeUploadModal}
        title={translate("documentLibraryPage.uploadFileTitle")}
        layout="compact"
        className="batch-three-modal"
        footer={(<ModalSubmitButton
          formId="document-upload-form"
          disabled={isUploading}
          className="w-full py-3 bg-slate-900 text-white cursor-pointer rounded-xl font-bold text-sm hover:bg-slate-800 transition-all font-bold uppercase tracking-widest disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {isUploading ? (
            translate("documentLibraryPage.uploading")
          ) : (
            translate("documentLibraryPage.uploadDocument")
          )}
        </ModalSubmitButton>)}>
        <form
          id="document-upload-form"
          noValidate
          onSubmit={handleUploadFile}
          className="space-y-4">
          <ModalMediaSplit preview={selectedFile ? <FilePreviewCard presentation="compact" file={selectedFile} /> : <p className="batch-three-empty">{translate("modalFoundation.noFiles")}</p>}>
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label={translate("documentLibraryPage.uploadFileTitle")}
              onKeyDown={(event) => {
                if(event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); fileInputRef.current?.click(); }
              }}
              className={`documents-dropzone border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center transition-colors group cursor-pointer ${isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 bg-slate-50 hover:bg-white"
                }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
              />
              <Upload
                className={`w-10 h-10 transition-colors mb-4 ${isDragActive
                    ? "text-primary"
                    : "text-slate-300 group-hover:text-primary"
                  }`}
              />
              <p className="text-sm font-medium text-slate-600">
                {selectedFile
                  ? selectedFile.name
                  : translate("documentLibraryPage.uploadDropzone")}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">
                {translate("documentLibraryPage.uploadHelp")}
              </p>
            </div>
          </ModalMediaSplit>
        </form>
      </Modal>
      <ConfirmModal
        presentation="compact"
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleDelete}
        title={
          deletingInfo?.type === "folder"
            ? translate("documentLibraryPage.deleteFolder")
            : translate("documentLibraryPage.deleteFile")
        }
        message={
          deletingInfo?.type === "folder"
            ? translate("documentLibraryPage.deleteFolderMessage")
            : translate("documentLibraryPage.deleteFileMessage")
        }
      />
      <Modal
        className="batch-three-modal document-preview-drawer"
        layout="drawer"
        footer={!isLoadingPreview && selectedPreviewFile ? (<div className="batch-three-action-row">
          <button
            onClick={() =>
              handleDownload(
                selectedPreviewFile.id,
                selectedPreviewFile.original_name,
              )
            }
            disabled={downloadingIds.includes(selectedPreviewFile.id)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {translate("documentLibraryPage.download")}
          </button>
          {openPreviewUrl && (
            <button
              onClick={() => {
                window.open(openPreviewUrl, "_blank", "noopener,noreferrer");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              {translate("documentLibraryPage.open")}
            </button>
          )}
        </div>) : undefined}
        isOpen={Boolean(fileId && selectedPreviewFile)}
        onClose={handleClosePreview}
        title={
          selectedPreviewFile?.original_name ||
          translate("documentLibraryPage.filePreview")
        }
        maxWidth="max-w-6xl"
      >
        <div className="space-y-4">
          {isLoadingPreview ? (
            <PreviewSkeleton />
          ) : (
            selectedPreviewFile && (
              <div className="batch-three-file-information flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 break-words">
                    {selectedPreviewFile.original_name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedPreviewFile.file_size_display} • {selectedPreviewFile.mime_type}
                  </p>
                </div>
              </div>
            )
          )}
          <div className="min-h-[60vh] bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
            {isLoadingPreview ? (
              <div className="h-[60vh] p-6">
                <div className="h-full rounded-2xl bg-slate-100 animate-pulse" />
              </div>
            ) : !previewUrl || !selectedPreviewFile ? (
              <div className="h-[60vh] flex items-center justify-center text-slate-400">
                {translate("documentLibraryPage.previewUnavailable")}
              </div>
            ) : previewType === "image" ? (
              <div className="h-[60vh] flex items-center justify-center p-4 bg-slate-100">
                <img
                  src={previewUrl}
                  alt={selectedPreviewFile.original_name}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-sm"
                />
              </div>
            ) : previewType === "video" ? (
              <video
                src={previewUrl}
                controls
                className="w-full h-[60vh] bg-black"
              />
            ) : previewType === "audio" ? (
              <div className="h-[60vh] flex items-center justify-center p-8">
                <audio
                  src={previewUrl}
                  controls
                  preload="metadata"
                  className="w-full max-w-2xl"
                />
              </div>
            ) : previewType === "pdf" ? (
              <iframe
                src={previewUrl}
                title={selectedPreviewFile.original_name}
                className="w-full h-[70vh]"
              />
            ) : previewType === "text" ? (
              <iframe
                src={previewUrl}
                title={selectedPreviewFile.original_name}
                className="w-full h-[70vh]"
              />
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
                <File className="w-12 h-12 text-slate-300" />
                <div>
                  <p className="font-bold text-slate-700">
                    {translate("documentLibraryPage.previewNotAvailableTitle")}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {translate(
                      "documentLibraryPage.previewNotAvailableDescription",
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
