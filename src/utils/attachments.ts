import type { ArticleAttachment } from "../redux/features/articles/articleTypes";
import { store } from '../redux/store';
import { synchronizeSession } from '../redux/features/auth/sessionSync';
import { isActiveUser } from '../redux/features/auth/permissionUtils';
import type { Document } from "../redux/features/documents/documentsTypes";
import type { TechnicoProAttachment } from "../redux/features/technicopro/technicoproTypes";
import type { TrainingAttachment } from "../redux/features/trainings/trainingTypes";

export type AttachmentSource =
  | string
  | ArticleAttachment
  | TrainingAttachment
  | TechnicoProAttachment
  | Document;

export type AttachmentCategory =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "text"
  | "office"
  | "design"
  | "archive"
  | "file";

export interface NormalizedAttachment {
  url: string;
  originalName?: string | null;
  displayName: string;
  extension: string;
  mimeType?: string | null;
  fileSize?: number | null;
  fileSizeDisplay?: string | null;
  category: AttachmentCategory;
  canPreview: boolean;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "m4v"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "aac", "m4a", "oga", "flac"]);
const TEXT_EXTENSIONS = new Set(["txt", "csv", "md", "json", "xml"]);
const OFFICE_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);
const DESIGN_EXTENSIONS = new Set(["ai", "eps", "psd", "sketch", "fig"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz"]);

export const getUrlDisplayName = (url: string, fallback = "attachment") => {
  const cleanUrl = url.split("?")[0].split("#")[0];

  try {
    return decodeURIComponent(cleanUrl.split("/").pop() || fallback);
  } catch {
    return cleanUrl.split("/").pop() || fallback;
  }
};

export const getFileExtension = (value?: string | null) => {
  if (!value) return "";
  const cleanValue = value.split("?")[0].split("#")[0];
  const lastPart = cleanValue.split("/").pop() || cleanValue;
  const parts = lastPart.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
};

export const formatFileSize = (size?: number | null) => {
  if (typeof size !== "number" || Number.isNaN(size)) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const getAttachmentCategory = ({
  extension,
  mimeType,
}: {
  extension?: string | null;
  mimeType?: string | null;
}): AttachmentCategory => {
  const normalizedMimeType = mimeType?.toLowerCase() || "";
  const normalizedExtension = extension?.toLowerCase() || "";

  if (normalizedMimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(normalizedExtension)) return "image";
  if (normalizedMimeType === "application/pdf" || PDF_EXTENSIONS.has(normalizedExtension)) return "pdf";
  if (normalizedMimeType.startsWith("video/") || VIDEO_EXTENSIONS.has(normalizedExtension)) return "video";
  if (normalizedMimeType.startsWith("audio/") || AUDIO_EXTENSIONS.has(normalizedExtension)) return "audio";
  if (normalizedMimeType.startsWith("text/") || TEXT_EXTENSIONS.has(normalizedExtension)) return "text";
  if (
    normalizedMimeType.includes("word") ||
    normalizedMimeType.includes("excel") ||
    normalizedMimeType.includes("powerpoint") ||
    normalizedMimeType.includes("officedocument") ||
    OFFICE_EXTENSIONS.has(normalizedExtension)
  ) {
    return "office";
  }
  if (DESIGN_EXTENSIONS.has(normalizedExtension)) return "design";
  if (ARCHIVE_EXTENSIONS.has(normalizedExtension)) return "archive";
  return "file";
};

export const canPreviewAttachmentCategory = (category: AttachmentCategory) =>
  ["image", "pdf", "video", "audio", "text"].includes(category);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

export const normalizeAttachment = (
  source: AttachmentSource,
  fallbackName = "attachment",
): NormalizedAttachment | null => {
  if (typeof source === "string") {
    const displayName = getUrlDisplayName(source, fallbackName);
    const extension = getFileExtension(displayName || source);
    const category = getAttachmentCategory({ extension });

    return {
      url: source,
      displayName,
      extension,
      category,
      canPreview: canPreviewAttachmentCategory(category),
    };
  }

  if (!isRecord(source)) return null;

  const url =
    (typeof source.url === "string" && source.url) ||
    (typeof source.download_url === "string" && source.download_url) ||
    (typeof source.preview_url === "string" && source.preview_url) ||
    (typeof source.document_url === "string" && source.document_url) ||
    (typeof source.file_url === "string" && source.file_url) ||
    (typeof source.storage_path === "string" && source.storage_path) ||
    "";

  if (!url) return null;

  const originalName =
    (typeof source.original_name === "string" && source.original_name) ||
    (typeof source.file_name === "string" && source.file_name) ||
    null;
  const displayName = originalName || getUrlDisplayName(url, fallbackName);
  const mimeType = typeof source.mime_type === "string" ? source.mime_type : null;
  const fileSize = typeof source.file_size === "number" ? source.file_size : null;
  const extension =
    getFileExtension(displayName) ||
    (typeof source.file_type === "string" ? source.file_type.toLowerCase() : "") ||
    getFileExtension(url);
  const category = getAttachmentCategory({ extension, mimeType });

  return {
    url,
    originalName,
    displayName,
    extension,
    mimeType,
    fileSize,
    fileSizeDisplay:
      (typeof source.file_size_display === "string" && source.file_size_display) ||
      formatFileSize(fileSize),
    category,
    canPreview: canPreviewAttachmentCategory(category),
  };
};

export const normalizeAttachments = (
  sources: Array<AttachmentSource> | null | undefined,
  fallbackPrefix = "Attachment",
) =>
  (sources || [])
    .map((source, index) => normalizeAttachment(source, `${fallbackPrefix} ${index + 1}`))
    .filter((item): item is NormalizedAttachment => item !== null);

// Match the browser's existing relative-URL resolution; never invent a storage path.
export const resolveAttachmentUrl = (url: string) => {
  if (!url.trim() || ["undefined", "null"].includes(url.trim()) || url.trim().startsWith("#")) return null;
  try {
    const resolved = new URL(url, document.baseURI);
    if (resolved.username || resolved.password) return null;
    if (["http:", "https:"].includes(resolved.protocol)) return resolved.href;
    if (resolved.protocol === "blob:" && resolved.origin === window.location.origin) return resolved.href;
  } catch { /* Invalid references have no actionable link. */ }
  return null;
};

export const usesAuthenticatedFileRequest = (url: string) => {
  const resolved = resolveAttachmentUrl(url);
  if (!resolved || resolved.startsWith("blob:")) return false;
  const origin = new URL(resolved).origin;
  if (origin === window.location.origin) return true;
  const apiBase = import.meta.env.VITE_API_BASE_URL;
  return Boolean(apiBase && origin === new URL(apiBase, document.baseURI).origin);
};

const getAuthHeaders = (url: string) => {
  if (!usesAuthenticatedFileRequest(url)) return undefined;
  synchronizeSession(store);
  const { token, isAuthenticated, user } = store.getState().auth;
  if (!token || !isAuthenticated || !isActiveUser(user)) throw new Error('Session is not ready for a file request');
  return { Authorization: `Bearer ${token}` };
};

export const fetchUrlAsObjectUrl = async (url: string, fallbackType?: string | null) => {
  synchronizeSession(store);
  const version = store.getState().auth.sessionVersion;
  const resolved = resolveAttachmentUrl(url);
  if (!resolved) throw new Error("Invalid file URL");
  const response = await fetch(resolved, {
    headers: getAuthHeaders(resolved),
  });

  if (!response.ok) {
    throw new Error(`File request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  synchronizeSession(store);
  if (store.getState().auth.sessionVersion !== version) throw new Error('Session changed during file request');
  const typedBlob =
    blob.type || !fallbackType ? blob : new Blob([blob], { type: fallbackType });

  return URL.createObjectURL(typedBlob);
};

export const openUrlAsBlob = async (url: string, fallbackType?: string | null) => {
  // Reserve the tab before awaiting a request so the user's click grants it.
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("File tab was blocked by the browser");
  tab.opener = null;
  let objectUrl: string | undefined;
  try {
    objectUrl = await fetchUrlAsObjectUrl(url, fallbackType);
    if (tab.closed) {
      URL.revokeObjectURL(objectUrl);
      return;
    }
    tab.location.replace(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl!), 60_000);
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    tab.close();
    throw error;
  }
};

export const downloadUrlAsFile = async (
  url: string,
  filename: string,
  fallbackType?: string | null,
) => {
  const objectUrl = await fetchUrlAsObjectUrl(url, fallbackType);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
