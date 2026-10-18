import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bookmark, ChevronRight, Download, ExternalLink, FileText } from "lucide-react";
import { useI18n } from "../../i18n";
import { sanitizeRichContent } from "../../utils/richContent";
import { downloadUrlAsFile, openUrlAsBlob, resolveAttachmentUrl, usesAuthenticatedFileRequest, type NormalizedAttachment } from "../../utils/attachments";

export function formatDetailDate(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

export function ContentDetailLayout({ backTo, moduleLabel, category, children }: {
  backTo: string;
  moduleLabel: string;
  category?: { name: string; path?: string };
  children: ReactNode;
}) {
  const { translate } = useI18n();
  return <div className="content-detail-page">
    <div className="content-detail-shell">
      <div className="detail-navigation">
        <Link to={backTo} className="detail-back"><ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />{translate("articleDetailPage.back")}</Link>
        <nav className="detail-breadcrumbs" aria-label={translate("contentDetail.breadcrumbs")}>
          <Link to="/">{translate("common.home")}</Link><ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />
          <Link to={backTo}>{moduleLabel}</Link>
          {category?.name ? <><ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />{category.path ? <Link to={category.path}>{category.name}</Link> : <span>{category.name}</span>}</> : null}
          <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" /><span aria-current="page">{translate("contentDetail.details")}</span>
        </nav>
      </div>
      <article className="detail-article">{children}</article>
    </div>
  </div>;
}

export function DetailHeader({ title, category, status, author, authorRole, metadata, actions }: {
  title: string;
  category?: string | null;
  status: string;
  author?: string | null;
  authorRole?: string;
  metadata?: ReactNode;
  actions?: ReactNode;
}) {
  const { translate } = useI18n();
  const statusKey = `articlesPage.status${status.charAt(0).toUpperCase()}${status.slice(1)}`;
  const statusLabel = translate(statusKey);
  const initials = author?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <header className="detail-header">
    <div className="detail-labels">
      {category ? <span className="detail-category">{category}</span> : null}
      <span className={`detail-status ${status === "published" ? "bg-emerald-50 text-emerald-700" : status === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{statusLabel === statusKey ? status : statusLabel}</span>
    </div>
    <div className="detail-title-row"><h1>{title}</h1>{actions ? <div className="detail-actions">{actions}</div> : null}</div>
    <div className="detail-metadata">
      {author ? <div className="detail-author">
        <span className="detail-author-avatar" aria-hidden="true">{initials}</span>
        <div className="min-w-0"><p className="font-bold text-slate-900">{author}</p>{authorRole ? <p className="detail-meta-label">{authorRole}</p> : null}</div>
      </div> : null}
      {metadata}
    </div>
  </header>;
}

export function DetailMetadataItem({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-metadata-item"><span className="detail-meta-label">{label}</span><span>{children}</span></div>;
}

export function RichContentRenderer({ html, excerpt }: { html: string; excerpt?: string | null }) {
  const safeHtml = useMemo(() => sanitizeRichContent(html), [html]);
  if (!safeHtml.trim() && !excerpt) return null;
  return <section className="detail-reading-content">
    {excerpt ? <p className="detail-excerpt">{excerpt}</p> : null}
    <div className="detail-rich-content tiptap-content prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml }} />
  </section>;
}

export function DetailSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <section className="detail-section"><h2>{title}</h2>{children}</section>;
}

function DetailAttachment({ attachment }: { attachment: NormalizedAttachment }) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { translate } = useI18n();
  const url = resolveAttachmentUrl(attachment.url);
  const mimeType = attachment.mimeType || (attachment.category === "pdf" ? "application/pdf" : undefined);
  const content = <>
    <FileText aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" />
    <span className="detail-attachment-info"><span className="font-semibold">{attachment.displayName}</span><span className="detail-meta-label">{[attachment.fileSizeDisplay, attachment.mimeType, attachment.category.toUpperCase()].filter(Boolean).join(" · ")}</span></span>
    <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
  </>;
  return <div className="detail-attachment">
    <div className="detail-attachment-row">
      {url ? <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="detail-attachment-link" aria-busy={opening} onClick={(event) => {
        setError(null);
        if (!usesAuthenticatedFileRequest(url)) return;
        event.preventDefault();
        if (opening) return;
        setOpening(true);
        void openUrlAsBlob(url, mimeType).catch(() => setError(translate("contentDetail.openError"))).finally(() => setOpening(false));
      }}>{content}</a> : <div className="detail-attachment-link" aria-disabled="true">{content}</div>}
      {url ? <button type="button" className="detail-attachment-download" disabled={downloading} aria-label={`${translate("contentDetail.download")} ${attachment.displayName}`} title={translate("contentDetail.download")} onClick={() => {
        setError(null);
        setDownloading(true);
        void downloadUrlAsFile(url, attachment.displayName, mimeType).catch(() => setError(translate("contentDetail.downloadError"))).finally(() => setDownloading(false));
      }}><Download aria-hidden="true" className="h-5 w-5" /></button> : null}
    </div>
    {!url || error ? <p role="alert" className="detail-attachment-error">{!url ? translate("contentDetail.invalidFile") : error}</p> : null}
  </div>;
}

export function DetailAttachments({ attachments }: { attachments: NormalizedAttachment[] }) {
  const { translate } = useI18n();
  if (!attachments.length) return null;
  return <DetailSection title={<><Bookmark aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />{translate("articleDetailPage.attachmentsTitle")}</>}>
    <div className="detail-attachments-grid">{attachments.map((attachment, index) => <DetailAttachment key={`${attachment.url}-${index}`} attachment={attachment} />)}</div>
  </DetailSection>;
}

export function DetailUpdated({ value }: { value?: string | null }) {
  const { localeCode, translate } = useI18n();
  return value ? <footer className="detail-updated">{translate("articleDetailPage.lastUpdated", { date: formatDetailDate(value, localeCode) })}</footer> : null;
}
