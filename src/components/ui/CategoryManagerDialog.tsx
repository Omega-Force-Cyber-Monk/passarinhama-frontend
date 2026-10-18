import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useI18n } from "../../i18n";
import { getApiErrorDetail } from "../../utils/apiErrorMessages";

export type ManagedCategory = {
  id: string;
  name: string;
  description?: string | null;
  color_code?: string | null;
};

export type CategoryValues = { name: string; description: string | null; color_code?: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  categories: ManagedCategory[];
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  supportsColor?: boolean;
  onCreate: (values: CategoryValues) => Promise<unknown>;
  onUpdate: (id: string, values: CategoryValues) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
};

// Native modal dialogs provide top-layer stacking, focus containment and inert
// ancestors. Keep this isolated from existing event/article editor dialogs.
let openDialogs = 0;
let originalOverflow = "";

function CategoryDialog({ title, children, onClose, busy = false, child = false, headerAction, restoreToParent }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  child?: boolean;
  headerAction?: ReactNode;
  restoreToParent?: { current: boolean };
}) {
  const { translate } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openDialogs++ === 0) {
      originalOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    }
    dialog.showModal();
    return () => {
      dialog.close();
      if (--openDialogs === 0) document.documentElement.style.overflow = originalOverflow;
      if (trigger?.isConnected && !restoreToParent?.current) trigger.focus();
      else {
        const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
        dialogs[dialogs.length - 1]?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
      }
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      aria-busy={busy}
      className={`category-dialog${child ? " category-dialog-child" : ""}`}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className="category-dialog-header">
        <h3 id={titleId} className="min-w-0 flex-1 break-words text-lg font-bold text-slate-900">{title}</h3>
        {headerAction}
        <button type="button" disabled={busy} onClick={onClose} aria-label={translate("categoryManager.close")} className="category-icon-button">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="category-dialog-body">{children}</div>
    </dialog>, document.body,
  );
}

function collectValidationMessages(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectValidationMessages);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectValidationMessages);
  return [];
}

export default function CategoryManagerDialog({ isOpen, onClose, categories, isLoading, error, onRetry, canCreate, canEdit, canDelete, supportsColor = false, onCreate, onUpdate, onDelete }: Props) {
  const { translate } = useI18n();
  const [operation, setOperation] = useState<{ kind: "add" } | { kind: "edit" | "delete"; category: ManagedCategory } | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color_code: "#F2C41E" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);
  const restoreToParent = useRef(false);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const nameId = useId();
  const descriptionId = useId();
  const colorId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!isOpen) { setOperation(null); setMessage(""); setOrderedIds((previous) => previous.length ? [] : previous); return; }
    setOrderedIds((previous) => {
      const ids = new Set(categories.map((category) => category.id));
      const retained = previous.filter((id) => ids.has(id));
      const known = new Set(retained);
      const next = [...retained, ...categories.filter((category) => !known.has(category.id)).map((category) => category.id)];
      return next.length === previous.length && next.every((id, index) => id === previous[index]) ? previous : next;
    });
  }, [isOpen, categories]);

  if (!isOpen) return null;
  const allowed = operation?.kind === "add" ? canCreate : operation?.kind === "edit" ? canEdit : canDelete;
  const begin = (next: NonNullable<typeof operation>) => {
    if (pendingRef.current) return;
    restoreToParent.current = false;
    const category = next.kind === "add" ? null : next.category;
    setForm({ name: category?.name || "", description: category?.description || "", color_code: category?.color_code || "#F2C41E" });
    setMessage("");
    setOperation(next);
  };
  const closeChild = () => { if (!pendingRef.current) { setOperation(null); setMessage(""); } };
  const submit = async () => {
    if (!operation || !allowed || pendingRef.current) return;
    if (operation.kind !== "delete" && !form.name.trim()) {
      setMessage(translate("common.requiredField", { field: translate("categoryManager.name") }));
      return;
    }
    pendingRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const values: CategoryValues = { name: form.name.trim(), description: form.description.trim() || null, ...(supportsColor ? { color_code: form.color_code } : {}) };
      if (operation.kind === "add") await onCreate(values);
      else if (operation.kind === "edit") await onUpdate(operation.category.id, values);
      else {
        await onDelete(operation.category.id);
        // The deleted row may disappear after the mutation invalidates the list.
        // Restore focus to a stable parent action instead of that row.
        restoreToParent.current = true;
      }
      setOperation(null);
    } catch (failure) {
      const payload = failure && typeof failure === "object" && "data" in failure ? failure.data : undefined;
      setMessage(collectValidationMessages(payload).join(" ") || getApiErrorDetail(failure) || translate("apiErrors.default"));
    } finally {
      pendingRef.current = false;
      setBusy(false);
    }
  };
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  const listedCategories = [...categories].sort((a, b) => (rank.get(a.id) ?? orderedIds.length) - (rank.get(b.id) ?? orderedIds.length));

  return <>
    <CategoryDialog title={translate("categoryManager.title")} onClose={() => { if (!operation) onClose(); }} headerAction={canCreate ? (
      <button type="button" onClick={() => begin({ kind: "add" })} className="category-primary-button inline-flex items-center gap-1.5">
        <Plus className="h-4 w-4 shrink-0" />{translate("categoryManager.add")}
      </button>
    ) : undefined}>
      {isLoading ? <p role="status" className="py-6 text-center text-sm text-slate-500">{translate("common.loading")}</p> : null}
      {error ? <div role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
        <p>{translate("categoryManager.loadError")}</p>
        <button type="button" onClick={onRetry} className="mt-2 font-bold underline">{translate("categoryManager.retry")}</button>
      </div> : null}
      {!isLoading && !error && !categories.length ? <p className="py-6 text-center text-sm text-slate-500">{translate("categoryManager.empty")}</p> : null}
      <ul className="space-y-2">
        {listedCategories.map((category) => <li key={category.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-full border border-slate-200" style={{ backgroundColor: category.color_code || "var(--archi-accent)" }} />
          <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
            <p className="line-clamp-2 text-sm font-bold text-slate-900" title={category.name}>{category.name}</p>
            {category.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500" title={category.description}>{category.description}</p> : null}
          </div>
          <div className="flex shrink-0 gap-1">
            {canEdit ? <button type="button" onClick={() => begin({ kind: "edit", category })} className="category-icon-button" aria-label={translate("categoryManager.editNamed", { name: category.name })}><Edit2 className="h-4 w-4" /></button> : null}
            {canDelete ? <button type="button" onClick={() => begin({ kind: "delete", category })} className="category-icon-button hover:bg-red-50 hover:text-red-600" aria-label={translate("categoryManager.deleteNamed", { name: category.name })}><Trash2 className="h-4 w-4" /></button> : null}
          </div>
        </li>)}
      </ul>
    </CategoryDialog>
    {operation ? <CategoryDialog child restoreToParent={restoreToParent} busy={busy} onClose={closeChild} title={translate(operation.kind === "add" ? "categoryManager.add" : operation.kind === "edit" ? "categoryManager.edit" : "categoryManager.delete")}>
      <form noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-4">
        {operation.kind === "delete" ? <p className="break-words text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{translate("categoryManager.deleteMessage", { name: operation.category.name })}</p> : <fieldset disabled={busy} className="space-y-4">
          <div>
            <label htmlFor={nameId} className="category-field-label">{translate("categoryManager.name")}</label>
            <input id={nameId} autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-describedby={message ? errorId : undefined} className="category-field" />
          </div>
          <div>
            <label htmlFor={descriptionId} className="category-field-label">{translate("common.description")}</label>
            <textarea id={descriptionId} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="category-field resize-y" />
          </div>
          {supportsColor ? <div>
            <label htmlFor={colorId} className="category-field-label">{translate("categoryManager.color")}</label>
            <input id={colorId} type="color" value={form.color_code} onChange={(event) => setForm({ ...form, color_code: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 bg-white p-1" />
          </div> : null}
        </fieldset>}
        {!allowed ? <p role="alert" className="text-sm text-red-700">{translate("common.accessRestrictedTitle")}</p> : null}
        {message ? <p id={errorId} role="alert" className="break-words rounded-xl bg-red-50 p-3 text-sm text-red-700 [overflow-wrap:anywhere]">{message}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" autoFocus={operation.kind === "delete"} disabled={busy} onClick={closeChild} className="category-secondary-button">{translate("common.cancel")}</button>
          <button type="submit" disabled={busy || !allowed} className={operation.kind === "delete" ? "category-danger-button" : "category-primary-button"}>
            {translate(busy ? "common.loading" : operation.kind === "add" ? "categoryManager.create" : operation.kind === "edit" ? "categoryManager.save" : "categoryManager.delete")}
          </button>
        </div>
      </form>
    </CategoryDialog> : null}
  </>;
}
