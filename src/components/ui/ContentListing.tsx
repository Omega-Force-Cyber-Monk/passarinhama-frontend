import { useEffect, useId, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Grid, Plus } from "lucide-react";
import { useI18n } from "../../i18n";

export type ListingStatus = "published" | "draft";

// Ignore legacy Pending/unknown filters, including navigation state. Draft
// visibility still follows the calling page's existing permission policy.
export function useListingStatus(canViewDraft: boolean): [ListingStatus, (status: ListingStatus) => void] {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigationStatus = (location.state as { status?: unknown; statusFilter?: unknown } | null)?.status
    ?? (location.state as { statusFilter?: unknown } | null)?.statusFilter;
  const requested = params.get("status") ?? params.get("statusFilter") ?? navigationStatus;
  const status = canViewDraft && requested === "draft" ? "draft" : "published";
  useEffect(() => {
    if (requested != null && requested !== status) {
      setParams((previous) => { const next = new URLSearchParams(previous); next.delete("statusFilter"); next.set("status", status); return next; }, { replace: true });
    }
  }, [requested, status, setParams]);
  return [status, (nextStatus) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("statusFilter");
      next.set("status", canViewDraft ? nextStatus : "published");
      return next;
    });
  }];
}

export function ContentPageHeader({ title, description, canManageCategories, onCategories, canCreate, onCreate, createLabel }: {
  title: string;
  description?: string | null;
  canManageCategories: boolean;
  onCategories: () => void;
  canCreate: boolean;
  onCreate: () => void;
  createLabel: string;
}) {
  const { translate } = useI18n();
  return <header className="content-page-header">
    <div className="min-w-0 flex-1">
      <h2 className="content-page-title">{title}</h2>
      {description ? <p className="mt-3 max-w-2xl text-sm text-[var(--archi-secondary)]">{description}</p> : null}
    </div>
    <div className="content-page-actions">
      {canManageCategories ? <button type="button" onClick={onCategories} className="content-page-button content-page-button-secondary"><Grid className="h-4 w-4 shrink-0" />{translate("categoryManager.title")}</button> : null}
      {canCreate ? <button type="button" onClick={onCreate} className="content-page-button content-page-button-primary"><Plus className="h-4 w-4 shrink-0" />{createLabel}</button> : null}
    </div>
  </header>;
}

export function ContentStatusTabs({ value, onChange }: { value: ListingStatus; onChange: (value: ListingStatus) => void }) {
  const { translate } = useI18n();
  return <div className="content-status-tabs" role="group" aria-label={translate("articlesPage.status")}>
    {(["published", "draft"] as const).map((status) => <button key={status} type="button" aria-pressed={value === status} onClick={() => onChange(status)} className={"content-status-tab" + (value === status ? " is-active" : "")}>
      {translate(status === "published" ? "articlesPage.statusPublished" : "articlesPage.statusDraft")}
    </button>)}
  </div>;
}

export function ContentStatusField({ value, onChange }: { value: string; onChange: (value: ListingStatus) => void }) {
  const { translate } = useI18n();
  const id = useId();
  const noticeId = useId();
  const selectable = value === "published" || value === "draft";
  return <div className="space-y-2 text-left">
    <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-slate-500">{translate("articlesPage.status")}</label>
    {!selectable ? <p id={noticeId} className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{translate("contentListing.preserveStatus", { status: translate(`articlesPage.status${value.charAt(0).toUpperCase()}${value.slice(1)}`) })}</p> : null}
    <select id={id} value={selectable ? value : ""} aria-describedby={!selectable ? noticeId : undefined} onChange={(event) => {
      if (event.target.value === "published" || event.target.value === "draft") onChange(event.target.value);
    }} className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30">
      {!selectable ? <option value="" disabled>{translate("contentListing.keepStatus")}</option> : null}
      <option value="published">{translate("articlesPage.statusPublished")}</option>
      <option value="draft">{translate("articlesPage.statusDraft")}</option>
    </select>
  </div>;
}

export type ContentCardAction = { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean };

export function ContentCard({ image, fallbackIcon, category, status, title, description, metadata, onNavigate, actions = [] }: {
  image?: string | null;
  fallbackIcon: ReactNode;
  category?: string | null;
  status: string;
  title: string;
  description?: string | null;
  metadata?: ReactNode;
  onNavigate: () => void;
  actions?: ContentCardAction[];
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return <article className="home-content-card content-list-card group">
    <button type="button" onClick={onNavigate} className="content-list-card-link" aria-label={title}>
      <div className="home-card-image">
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[var(--archi-muted)]">{fallbackIcon}</div>
        {image && failedImage !== image ? <img src={image} alt="" loading="lazy" onError={() => setFailedImage(image)} className="relative h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : null}
      </div>
      <div className="home-card-body">
        <div className="content-card-labels">
          <span className="content-card-category" title={category || undefined}>{category}</span>
          <span className="truncate text-[10px] font-semibold uppercase text-[var(--archi-secondary)]">{status}</span>
        </div>
        <h3 className="home-card-title">{title}</h3>
        <p className="home-card-description">{description}</p>
        <div className="home-card-metadata"><span>{metadata}</span></div>
      </div>
    </button>
    {actions.length ? <div className="content-card-actions">{actions.map((action) => <button key={action.label} type="button" aria-label={action.label} title={action.label} disabled={action.disabled} onClick={action.onClick} className="content-card-action">{action.icon}</button>)}</div> : null}
  </article>;
}

export function ContentCardSkeleton() {
  return <div className="home-content-card content-list-card animate-pulse" aria-hidden="true">
    <div className="home-card-image" />
    <div className="home-card-body">
      <div className="content-card-labels rounded bg-slate-100" />
      <div className="home-card-title w-4/5 rounded bg-slate-100" />
      <div className="home-card-description rounded bg-slate-100" />
      <div className="home-card-metadata w-3/5 rounded bg-slate-100" />
    </div>
  </div>;
}
