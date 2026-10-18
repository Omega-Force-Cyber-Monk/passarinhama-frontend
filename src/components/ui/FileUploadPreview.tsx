import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { createObjectUrlLease, downloadLocalFile, localPreviewMime, openLocalFile } from "./localFilePreview";
import "./FileUploadPreview.css";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Music,
  Image as ImageIcon,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import {
  formatFileSize,
  resolveAttachmentUrl,
  getAttachmentCategory,
  getFileExtension,
  getUrlDisplayName,
  downloadUrlAsFile,
  openUrlAsBlob,
  type AttachmentCategory,
} from "../../utils/attachments";

type PreviewKind = AttachmentCategory;

export const getPreviewName = (value: string) => {
  return getUrlDisplayName(value, value);
};

export const getPreviewKind = ({
  file,
  url,
  name,
}: {
  file?: File | null;
  url?: string | null;
  name?: string | null;
}): PreviewKind => {
  if (file?.type) {
    return getAttachmentCategory({
      extension: getFileExtension(file.name),
      mimeType: file.type,
    });
  }

  const lookupValues = [
    file?.name,
    url ? getPreviewName(url) : "",
    name,
  ].filter(Boolean) as string[];

  for (const lookupValue of lookupValues) {
    const category = getAttachmentCategory({
      extension: getFileExtension(lookupValue),
    });

    if (category !== "file") return category;
  }

  return "file";
};

export const formatPreviewSize = (size: number) => formatFileSize(size) || `${size} B`;

const PreviewMedia = ({
  file,
  url,
  name,
  kind,
  shape = "rounded-2xl",
}: {
  file?: File | null;
  url?: string | null;
  name: string;
  kind: PreviewKind;
  shape?: string;
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || kind === "file") {
      setObjectUrl(null);
      return;
    }

    const nextObjectUrl = URL.createObjectURL(file);
    setObjectUrl(nextObjectUrl);

    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [file, kind]);

  const source = objectUrl || url || "";

  if (kind === "image" && source) {
    return <img src={source} alt={name} className={`h-full w-full object-cover ${shape}`} />;
  }

  if (kind === "video" && source) {
    return (
      <video
        src={source}
        controls
        preload="metadata"
        className={`h-full w-full bg-slate-950 object-cover ${shape}`}
      />
    );
  }

  if (kind === "audio" && source) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 p-4">
        <audio src={source} controls className="w-full" preload="metadata" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-50">
      <div className="rounded-2xl bg-white p-4 text-slate-400 shadow-sm">
        <FileText className="h-8 w-8" />
      </div>
    </div>
  );
};

export type FilePreviewCardProps = {
  file?: File | null; url?: string | null; name?: string | null; subtitle?: string | null;
  onRemove?: () => void; href?: string; emptyLabel?: string; aspectClassName?: string;
  mediaShapeClassName?: string; className?: string; presentation?: "legacy" | "compact";
  mimeType?: string | null; fileSize?: number | null;
};

export const FilePreviewCard = ({
  file,
  url,
  name,
  subtitle,
  onRemove,
  href,
  presentation = "legacy",
  mimeType,
  fileSize,
  emptyLabel = "No file selected",
  aspectClassName = "aspect-[4/3]",
  mediaShapeClassName = "",
  className = "",
}: FilePreviewCardProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const resolvedName = useMemo(() => {
    if (name) return name;
    if (file?.name) return file.name;
    if (url) return getPreviewName(url);
    return emptyLabel;
  }, [emptyLabel, file?.name, name, url]);
  const kind = getPreviewKind({ file, url, name: resolvedName });
  const resolvedSubtitle =
    subtitle || (file ? formatPreviewSize(file.size) : kind.toUpperCase());
  const fallbackMimeType =
    kind === "pdf"
      ? "application/pdf"
      : kind === "text"
        ? "text/plain"
        : kind === "audio"
          ? "audio/mpeg"
          : kind === "video"
            ? "video/mp4"
            : kind === "image"
              ? "image/*"
              : undefined;

  const handleDownload = async () => {
    if (!url || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadUrlAsFile(url, resolvedName, fallbackMimeType);
    } catch (error) {
      window.alert("Download failed. Open the file and download it from the viewer if available.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpen = async () => {
    const targetUrl = href || url;
    if (!targetUrl || isOpening) return;

    setIsOpening(true);
    try {
      await openUrlAsBlob(targetUrl, fallbackMimeType);
    } catch (error) {
      window.alert("Unable to open this file. The server rejected the file request.");
    } finally {
      setIsOpening(false);
    }
  };

  if (presentation === "compact") return <CompactFilePreviewCard file={file} url={url} href={href} name={name} subtitle={subtitle} onRemove={onRemove} emptyLabel={emptyLabel} className={className} mimeType={mimeType} fileSize={fileSize} />;

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className={`${aspectClassName} overflow-hidden bg-slate-100 p-2`}>
        <PreviewMedia
          file={file}
          url={url}
          name={resolvedName}
          kind={kind}
          shape={mediaShapeClassName}
        />
      </div>
      <div className="flex items-start justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-slate-700">
            {kind === "image" ? (
              <ImageIcon className="h-4 w-4 shrink-0 text-primary" />
            ) : kind === "video" ? (
              <Video className="h-4 w-4 shrink-0 text-primary" />
            ) : kind === "audio" ? (
              <Music className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <FileIcon className="h-4 w-4 shrink-0 text-primary" />
            )}
            <p className="truncate text-xs font-bold">{resolvedName}</p>
          </div>
          {resolvedSubtitle ? (
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {resolvedSubtitle}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {url ? (
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          ) : null}
          {href || url ? (
            <button
              type="button"
              onClick={handleOpen}
              disabled={isOpening}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Open"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

function CompactFilePreviewCard({ file, url, href, name, subtitle, onRemove, emptyLabel, className = "", mimeType, fileSize }: FilePreviewCardProps) {
  const { translate } = useI18n();
  const [localUrl, setLocalUrl] = useState<{ file: File; url: string } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const displayName = name || file?.name || (url ? getPreviewName(url) : emptyLabel && emptyLabel !== "No file selected" ? emptyLabel : null) || translate("modalFoundation.file");
  const kind = mimeType && !file ? getAttachmentCategory({ extension: getFileExtension(displayName), mimeType }) : getPreviewKind({ file, url, name: displayName });
  useEffect(() => {
    if (!file || !["image", "video", "audio"].includes(kind)) { setLocalUrl(null); return; }
    try {
      const lease = createObjectUrlLease(file);
      setLocalUrl({ file, url: lease.url });
      return lease.release;
    } catch { setLocalUrl(null); }
  }, [file, kind]);
  useEffect(() => { setError(""); }, [file, url, href]);
  const source = (file ? localUrl?.file === file ? localUrl.url : "" : url && resolveAttachmentUrl(url)) || "";
  const validRemote = (href || url) ? resolveAttachmentUrl(href || url || "") : null;
  const sizeBytes = file?.size ?? fileSize;
  const size = sizeBytes === 0 ? "0 B" : formatFileSize(sizeBytes);
  const type = file?.type || mimeType || getFileExtension(displayName).toUpperCase() || kind.toUpperCase();
  const metadata = [...new Set([type, size, subtitle].filter(Boolean))].join(" · ");
  const canOpen = file ? Boolean(localPreviewMime(file)) : Boolean(validRemote);
  const canDownload = Boolean(file || (url && resolveAttachmentUrl(url)));
  const Icon = kind === "image" ? ImageIcon : kind === "video" ? Video : kind === "audio" ? Music : kind === "pdf" || kind === "text" ? FileText : FileIcon;
  return <div className={`compact-file-card ${className}`}>
    <div className="compact-file-row">
      <div className="compact-file-thumbnail">
        {kind === "image" && source && failedSource !== source ? <img src={source} alt={displayName} onError={() => setFailedSource(source)} /> : <Icon aria-hidden="true" className="h-6 w-6" />}
      </div>
      <div className="compact-file-info"><p title={displayName}>{displayName}</p><span>{metadata}</span></div>
      <div className="compact-file-actions">
        {canOpen ? <button type="button" disabled={opening} aria-label={translate("modalFoundation.openNamed", { name: displayName })} title={translate("modalFoundation.open")} onClick={() => {
          setError("");
          if (file) { try { openLocalFile(file); } catch { setError(translate("modalFoundation.openError")); } return; }
          setOpening(true);
          void openUrlAsBlob(validRemote!, mimeType).catch(() => setError(translate("modalFoundation.openError"))).finally(() => setOpening(false));
        }}><ExternalLink aria-hidden="true" className="h-4 w-4" /></button> : null}
        {canDownload ? <button type="button" disabled={downloading} aria-label={translate("modalFoundation.downloadNamed", { name: displayName })} title={translate("modalFoundation.download")} onClick={() => {
          setError("");
          if (file) { try { downloadLocalFile(file); } catch { setError(translate("modalFoundation.downloadError")); } return; }
          setDownloading(true);
          void downloadUrlAsFile(url!, displayName, mimeType).catch(() => setError(translate("modalFoundation.downloadError"))).finally(() => setDownloading(false));
        }}><Download aria-hidden="true" className="h-4 w-4" /></button> : null}
        {onRemove ? <button type="button" onClick={onRemove} aria-label={translate("modalFoundation.removeNamed", { name: displayName })} title={translate("modalFoundation.remove")}><Trash2 aria-hidden="true" className="h-4 w-4" /></button> : null}
      </div>
    </div>
    {!canOpen && file ? <p className="compact-file-note">{translate("modalFoundation.downloadOnly")}</p> : null}
    {!file && (href || url) && !validRemote ? <p role="alert" className="compact-file-error">{translate("modalFoundation.invalidFile")}</p> : null}
    {error ? <p role="alert" className="compact-file-error">{error}</p> : null}
  </div>;
}

export const SelectedFilesPreview = ({
  files,
  onRemove,
  presentation = "legacy",
  emptyLabel = "No files selected",
  className = "",
}: {
  presentation?: "legacy" | "compact";
  files: File[];
  onRemove: (index: number) => void;
  emptyLabel?: string;
  className?: string;
}) => {
  if (!files.length) {
    return (
      <div
        className={`${presentation === "compact" ? "compact-file-empty " : ""}flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 ${className}`}
      >
        {presentation === "compact" && emptyLabel === "No files selected" ? <CompactEmptyFilesLabel /> : emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={`${presentation === "compact" ? "compact-file-list " : ""}max-h-[336px] space-y-3 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-3 ${className}`}
    >
      {files.map((file, index) => (
        <FilePreviewCard
          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
          presentation={presentation}
          file={file}
          onRemove={() => onRemove(index)}
          className="bg-white"
        />
      ))}
    </div>
  );
};

function CompactBrowseLabel() {
  const { translate } = useI18n();
  return <>{translate("modalFoundation.browseFiles")}</>;
}

function CompactEmptyFilesLabel() {
  const { translate } = useI18n();
  return <>{translate("modalFoundation.noFiles")}</>;
}

export const FileUploadDropzone = ({
  presentation = "legacy",
  inputId,
  title,
  hint,
  onFilesSelected,
  multiple = true,
  accept,
  selectedLabel,
  preview,
  emptyPreview,
  className = "",
}: {
  presentation?: "legacy" | "compact";
  inputId: string;
  title: string;
  hint: string;
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  selectedLabel?: string | null;
  preview?: React.ReactNode;
  emptyPreview?: React.ReactNode;
  className?: string;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const hasPreviewPanel = Boolean(preview || emptyPreview);

  const content = (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const files = Array.from(event.dataTransfer.files || []);
        if (files.length) {
          onFilesSelected(files);
        }
      }}
      className={`${presentation === "compact" ? "compact-file-dropzone " : ""}group relative flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-all sm:px-8 ${
        isDragging
          ? "border-primary bg-primary/5 shadow-[0_12px_30px_rgba(13,110,253,0.12)]"
          : "border-slate-200 bg-white hover:border-primary/50 hover:bg-slate-50 hover:shadow-sm"
      } ${
        hasPreviewPanel ? "min-h-[220px] md:min-h-[336px]" : "min-h-[180px] sm:min-h-[200px]"
      } ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-20 bg-gradient-to-b from-primary/[0.06] to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className={presentation === "compact" ? "compact-file-input" : "hidden"}
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : [];
          if (files.length) {
            onFilesSelected(files);
          }
          event.currentTarget.value = "";
        }}
      />
      <div
        className={`${presentation === "compact" ? "compact-file-upload-icon " : ""}relative z-[1] flex h-16 w-16 items-center justify-center rounded-2xl border transition-colors ${
          isDragging
            ? "border-primary/30 bg-primary/15"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <Upload
          className={`h-7 w-7 ${isDragging ? "text-primary" : "text-slate-500"}`}
        />
      </div>
      <div className="relative z-[1] space-y-2">
        <p className="text-sm font-bold text-slate-900 sm:text-base">
          {title}
        </p>
        <p className="text-xs font-medium text-slate-500">
          {presentation === "compact" ? <CompactBrowseLabel /> : "Drag and drop here, or click to browse"}
        </p>
        {selectedLabel ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="max-w-[220px] truncate">{selectedLabel}</span>
          </div>
        ) : null}
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {hint}
        </p>
      </div>
    </label>
  );

  if (!preview && !emptyPreview) {
    return content;
  }

  if (presentation === "compact") return <div className="compact-file-split-boundary"><div className="compact-file-split">
    {content}<div className="compact-file-split-preview">{preview || emptyPreview}</div>
  </div></div>;

  return (
    <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.35fr)_280px]">
      {content}
      <div className="flex h-full w-full max-w-[280px] justify-self-center md:max-w-none md:justify-self-auto md:min-h-[336px]">
        {preview || emptyPreview}
      </div>
    </div>
  );
};
