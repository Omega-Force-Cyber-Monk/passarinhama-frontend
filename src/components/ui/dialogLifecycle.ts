type Entry = {
  root: HTMLElement;
  panel: HTMLElement;
  opener: HTMLElement | null;
  parentRoot?: HTMLElement | null;
  initialFocus?: () => HTMLElement | null;
  dismiss: () => void;
  canDismiss: () => boolean;
};
type State = { entries: Entry[]; overflow: string; keydown: (event: KeyboardEvent) => void; focusin: (event: FocusEvent) => void };
const documents = new WeakMap<Document, State>();
const selector = 'button, a[href], input, select, textarea, summary, iframe, audio[controls], video[controls], [tabindex], [contenteditable="true"]';

function nativeDialogOpen(doc: Document) {
  // Native category dialogs own the browser's top layer and their own lifecycle.
  try { return Boolean(doc.querySelector('dialog:modal')); }
  catch { return Boolean(doc.querySelector('dialog[open]')); }
}

export function dialogFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter((element) =>
    element.tabIndex >= 0 && !element.matches(':disabled') &&
    !element.closest('[hidden], [inert], [aria-hidden="true"]') && element.getClientRects().length > 0 &&
    panel.ownerDocument.defaultView?.getComputedStyle(element).visibility !== 'hidden',
  );
}

function focusEntry(entry: Entry, last = false, initial = false) {
  const elements = dialogFocusableElements(entry.panel);
  const preferred = entry.initialFocus?.();
  const autofocus = entry.panel.querySelector<HTMLElement>('[autofocus]');
  const target = last ? elements.at(-1) : initial && preferred && elements.includes(preferred) ? preferred :
    initial && autofocus && elements.includes(autofocus) ? autofocus : elements[0];
  (target || entry.panel).focus({ preventScroll: true });
}

function updateStack(state: State) {
  let zIndex = 40;
  state.entries.forEach((entry, index) => {
    zIndex = Math.max(zIndex + 10, Number(entry.root.dataset.dialogBaseZ) || 50);
    entry.root.style.zIndex = String(zIndex);
    const top = index === state.entries.length - 1;
    entry.root.inert = !top;
    if (top) entry.root.removeAttribute('aria-hidden');
    else entry.root.setAttribute('aria-hidden', 'true');
    entry.panel.setAttribute('aria-modal', String(top));
  });
}

export function isTopDialog(root: HTMLElement) {
  const doc = root.ownerDocument;
  return documents.get(doc)?.entries.at(-1)?.root === root && !nativeDialogOpen(doc);
}

/** Returns an idempotent cleanup; no browser globals are read at module load. */
export function registerDialog(entry: Entry) {
  const doc = entry.root.ownerDocument;
  let state = documents.get(doc);
  if (!state) {
    const newState: State = {
      entries: [], overflow: doc.body.style.overflow,
      keydown: (event) => {
        const top = newState.entries.at(-1);
        if (!top || event.defaultPrevented || nativeDialogOpen(doc)) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          if (top.canDismiss()) top.dismiss();
        } else if (event.key === 'Tab') {
          const elements = dialogFocusableElements(top.panel);
          const active = doc.activeElement;
          if (!elements.length) { event.preventDefault(); top.panel.focus({ preventScroll: true }); }
          else if (!elements.includes(active as HTMLElement) || (event.shiftKey && active === elements[0]) || (!event.shiftKey && active === elements.at(-1))) {
            event.preventDefault();
            focusEntry(top, event.shiftKey);
          }
        }
      },
      focusin: (event) => {
        const top = newState.entries.at(-1);
        if (top && !nativeDialogOpen(doc) && !top.panel.contains(event.target as Node)) focusEntry(top);
      },
    };
    state = newState;
    documents.set(doc, state);
    // CategoryManagerDialog locks the document element, independently of this body lock.
    doc.body.style.overflow = 'hidden';
    doc.addEventListener('keydown', state.keydown);
    doc.addEventListener('focusin', state.focusin);
  }
  // React runs child effects before parent effects when both mount together.
  // An explicit React ancestry link keeps nested portals in the right order.
  const childIndex = state.entries.findIndex((item) => item.parentRoot === entry.root);
  if (childIndex < 0) state.entries.push(entry);
  else state.entries.splice(childIndex, 0, entry);
  entry.root.style.pointerEvents = '';
  updateStack(state);
  if (state.entries.at(-1) === entry && !nativeDialogOpen(doc) && (entry.initialFocus?.() || !entry.panel.contains(doc.activeElement))) focusEntry(entry, false, true);
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    const wasTop = state.entries.at(-1) === entry;
    state.entries = state.entries.filter((item) => item !== entry);
    entry.root.inert = true;
    entry.root.setAttribute('aria-hidden', 'true');
    entry.root.style.pointerEvents = 'none';
    updateStack(state);
    if (!state.entries.length) {
      doc.body.style.overflow = state.overflow;
      doc.removeEventListener('keydown', state.keydown);
      doc.removeEventListener('focusin', state.focusin);
      documents.delete(doc);
    }
    if (!wasTop || nativeDialogOpen(doc)) return;
    const parent = state.entries.at(-1);
    if (entry.opener?.isConnected && !entry.opener.matches(':disabled') && entry.opener.getClientRects().length &&
      doc.defaultView?.getComputedStyle(entry.opener).visibility !== 'hidden' &&
      !entry.opener.closest('[inert], [hidden], [aria-hidden="true"]') && (!parent || parent.panel.contains(entry.opener))) entry.opener.focus({ preventScroll: true });
    else if (parent) focusEntry(parent);
  };
}
