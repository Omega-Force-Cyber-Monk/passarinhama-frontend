import type { ArticleAttachment } from "../redux/features/articles/articleTypes";
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

const getAuthHeaders = () => {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("token") : null;

  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export const fetchUrlAsObjectUrl = async (url: string, fallbackType?: string | null) => {
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`File request failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const typedBlob =
    blob.type || !fallbackType ? blob : new Blob([blob], { type: fallbackType });

  return URL.createObjectURL(typedBlob);
};

export const openUrlAsBlob = async (url: string, fallbackType?: string | null) => {
  const objectUrl = await fetchUrlAsObjectUrl(url, fallbackType);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
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
