import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  Video,
} from "lucide-react";

type PreviewKind = "image" | "video" | "file";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogg",
  "mov",
  "m4v",
]);

const getExtension = (value: string) =>
  value.includes(".") ? value.split(".").pop()?.toLowerCase() || "" : "";

export const getPreviewName = (value: string) => {
  try {
    return decodeURIComponent(value.split("/").pop() || value);
  } catch {
    return value.split("/").pop() || value;
  }
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
  if (file?.type.startsWith("image/")) return "image";
  if (file?.type.startsWith("video/")) return "video";

  const lookupValues = [
    file?.name,
    url ? getPreviewName(url) : "",
    name,
  ].filter(Boolean) as string[];

  for (const lookupValue of lookupValues) {
    const extension = getExtension(lookupValue);

    if (IMAGE_EXTENSIONS.has(extension)) return "image";
    if (VIDEO_EXTENSIONS.has(extension)) return "video";
  }

  return "file";
};

export const formatPreviewSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

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

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-50">
      <div className="rounded-2xl bg-white p-4 text-slate-400 shadow-sm">
        <FileText className="h-8 w-8" />
      </div>
    </div>
  );
};

export const FilePreviewCard = ({
  file,
  url,
  name,
  subtitle,
  onRemove,
  href,
  emptyLabel = "No file selected",
  aspectClassName = "aspect-[4/3]",
  mediaShapeClassName = "",
  className = "",
}: {
  file?: File | null;
  url?: string | null;
  name?: string | null;
  subtitle?: string | null;
  onRemove?: () => void;
  href?: string;
  emptyLabel?: string;
  aspectClassName?: string;
  mediaShapeClassName?: string;
  className?: string;
}) => {
  const resolvedName = useMemo(() => {
    if (name) return name;
    if (file?.name) return file.name;
    if (url) return getPreviewName(url);
    return emptyLabel;
  }, [emptyLabel, file?.name, name, url]);
  const kind = getPreviewKind({ file, url, name: resolvedName });
  const resolvedSubtitle =
    subtitle || (file ? formatPreviewSize(file.size) : href ? "Open file" : null);

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
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
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

export const SelectedFilesPreview = ({
  files,
  onRemove,
  emptyLabel = "No files selected",
  className = "",
}: {
  files: File[];
  onRemove: (index: number) => void;
  emptyLabel?: string;
  className?: string;
}) => {
  if (!files.length) {
    return (
      <div
        className={`flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 ${className}`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={`max-h-[336px] space-y-3 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-3 ${className}`}
    >
      {files.map((file, index) => (
        <FilePreviewCard
          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
          file={file}
          onRemove={() => onRemove(index)}
          className="bg-white"
        />
      ))}
    </div>
  );
};

export const FileUploadDropzone = ({
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
      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-all sm:px-8 ${
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
        className="hidden"
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : [];
          if (files.length) {
            onFilesSelected(files);
          }
          event.currentTarget.value = "";
        }}
      />
      <div
        className={`relative z-[1] flex h-16 w-16 items-center justify-center rounded-2xl border transition-colors ${
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
          Drag and drop here, or click to browse
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

  return (
    <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.35fr)_280px]">
      {content}
      <div className="flex h-full w-full max-w-[280px] justify-self-center md:max-w-none md:justify-self-auto md:min-h-[336px]">
        {preview || emptyPreview}
      </div>
    </div>
  );
};
