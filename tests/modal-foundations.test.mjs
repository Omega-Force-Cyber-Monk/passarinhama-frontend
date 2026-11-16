// Server-free: Node assertions + isolated TS evaluation + a small event/focus model.
// No browser, server, application store, HTTP request or new dependency is used.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function evaluate(path, mocks = {}, globals = {}, suffix = '') {
  const module = { exports: {} };
  const source = read(path).replaceAll('import.meta.env.VITE_API_BASE_URL', '""') + suffix;
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, Blob, File, URL,
    require: (name) => name.endsWith('.css') ? {} : mocks[name] ?? require(name), ...globals });
  return module.exports;
}
function hooks() {
  const values = [], effects = [], pending = [];
  let index = 0;
  const api = { ...React,
    useContext: (context) => context._currentValue,
    useId: () => `test-${index++}`,
    useMemo: (fn) => fn(),
    useRef: (initial) => { const i = index++; return values[i] ||= { current: initial }; },
    useState: (initial) => { const i = index++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], (next) => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useEffect: (fn, deps) => { const i = index++; const old = effects[i];
      if (!old || !deps || deps.some((value, n) => value !== old.deps[n])) {
        effects[i] = { deps, cleanup: old?.cleanup }; pending.push(() => { effects[i].cleanup?.(); effects[i].cleanup = fn(); });
      }
    },
  };
  return { api, render(fn, props) { index = 0; return fn(props); }, flush() { pending.splice(0).forEach((fn) => fn()); },
    cleanup() { effects.forEach((effect) => effect?.cleanup?.()); } };
}
const translate = (key, params = {}) => {
  let text = JSON.parse(read('src/i18n/locales/en.json'));
  for (const part of key.split('.')) text = text?.[part];
  return Object.entries(params).reduce((message, [name, value]) => message.replaceAll(`{${name}}`, value), text || key);
};
const i18n = { useI18n: () => ({ translate }) };
const motion = { motion: new Proxy({}, { get: (_, tag) => tag }), AnimatePresence: 'presence', useReducedMotion: () => false };
const all = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap((item) => all(item, predicate));
  return [...(predicate(node) ? [node] : []), ...all(node.props?.children, predicate)];
};
const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node) :
  Array.isArray(node) ? node.map(textOf).join(' ') : node && typeof node === 'object' ? textOf(node.props?.children) : '';
const byRole = (node, role) => all(node, (item) => item.props?.role === role)[0];

class Element {
  constructor(doc, options = {}) { Object.assign(this, { ownerDocument: doc, children: [], parent: null, tabIndex: -1,
    isConnected: true, inert: false, disabled: false, hidden: false, visible: true, attributes: {}, style: {}, dataset: {}, ...options }); }
  append(child) { child.parent = this; this.children.push(child); return child; }
  contains(other) { return other === this || this.children.some((child) => child.contains(other)); }
  querySelectorAll() { return this.children.flatMap((child) => [child, ...child.querySelectorAll()]); }
  querySelector(selector) { return selector === '[autofocus]' ? this.querySelectorAll().find((item) => item.autofocus) || null : null; }
  closest() { return this.inert || this.hidden || this.attributes['aria-hidden'] === 'true' ? this : this.parent?.closest() || null; }
  matches(selector) { return selector === ':disabled' && this.disabled; }
  getClientRects() { return this.visible ? [{}] : []; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  focus() { this.ownerDocument.activeElement = this; this.ownerDocument.emit('focusin', { target: this }); }
}
function documentModel() {
  const listeners = new Map();
  const doc = { native: false, activeElement: null,
    defaultView: { getComputedStyle: (element) => ({ visibility: element.visibility || 'visible' }) },
    querySelector: () => doc.native ? {} : null,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type, event) { for (const fn of [...listeners.get(type) || []]) fn(event); },
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
  doc.body = new Element(doc, { style: { overflow: 'scroll' } });
  doc.documentElement = new Element(doc, { style: { overflow: '' } });
  doc.activeElement = doc.body.append(new Element(doc, { tabIndex: 0 }));
  return doc;
}
function key(doc, value, shift = false) {
  const event = { key: value, shiftKey: shift, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
  doc.emit('keydown', event); return event;
}
const lifecycle = evaluate('src/components/ui/dialogLifecycle.ts');
function entry(doc, onClose = () => {}) {
  const root = new Element(doc, { dataset: { dialogBaseZ: '50' } });
  const panel = root.append(new Element(doc));
  const first = panel.append(new Element(doc, { tabIndex: 0 }));
  const last = panel.append(new Element(doc, { tabIndex: 0 }));
  const record = { root, panel, opener: doc.activeElement, dismiss: onClose, canDismiss: () => true };
  return { ...record, first, last, record };
}

test('dialog lifecycle focuses, traps both Tab directions, restores focus and restores scroll/listeners', () => {
  const doc = documentModel(), opener = doc.activeElement, modal = entry(doc);
  const cleanup = lifecycle.registerDialog(modal.record);
  assert.equal(doc.body.style.overflow, 'hidden');
  assert.equal(doc.activeElement, modal.first);
  modal.last.focus(); assert.equal(key(doc, 'Tab').defaultPrevented, true); assert.equal(doc.activeElement, modal.first);
  key(doc, 'Tab', true); assert.equal(doc.activeElement, modal.last);
  opener.focus(); assert.equal(doc.activeElement, modal.first);
  cleanup(); cleanup();
  assert.equal(doc.activeElement, opener);
  assert.equal(doc.body.style.overflow, 'scroll');
  assert.equal(doc.listenerCount(), 0);
});
test('nested dialogs dismiss only the top, stay locked until last cleanup, and restore the parent trigger', () => {
  const doc = documentModel(), calls = [];
  const parent = entry(doc, () => calls.push('parent')), releaseParent = lifecycle.registerDialog(parent.record);
  parent.last.focus();
  const child = entry(doc, () => calls.push('child')), releaseChild = lifecycle.registerDialog(child.record);
  assert.equal(parent.root.inert, true);
  assert.ok(Number(child.root.style.zIndex) > Number(parent.root.style.zIndex));
  assert.equal(lifecycle.isTopDialog(parent.root), false);
  key(doc, 'Escape'); assert.deepEqual(calls, ['child']);
  releaseChild(); assert.equal(parent.root.inert, false); assert.equal(doc.activeElement, parent.last);
  assert.equal(doc.body.style.overflow, 'hidden');
  key(doc, 'Escape'); assert.deepEqual(calls, ['child', 'parent']);
  releaseParent(); assert.equal(doc.body.style.overflow, 'scroll');
});
test('loading/Escape guards, hidden controls, empty dialogs and native-category ownership are respected', () => {
  const doc = documentModel(); let closes = 0;
  const modal = entry(doc, () => closes++);
  modal.first.disabled = true; modal.last.visibility = 'hidden'; modal.record.canDismiss = () => false;
  const cleanup = lifecycle.registerDialog(modal.record);
  assert.equal(doc.activeElement, modal.panel);
  assert.equal(key(doc, 'Tab').defaultPrevented, true);
  key(doc, 'Escape'); assert.equal(closes, 0);
  modal.record.canDismiss = () => true;
  doc.native = true; doc.documentElement.style.overflow = 'hidden';
  assert.equal(key(doc, 'Escape').defaultPrevented, false);
  assert.equal(lifecycle.isTopDialog(modal.root), false);
  cleanup();
  assert.equal(closes, 0); assert.equal(doc.documentElement.style.overflow, 'hidden');
  assert.equal(doc.body.style.overflow, 'scroll');
});
test('nested portals remain above parents when child effects register first', () => {
  const doc = documentModel(), parent = entry(doc), child = entry(doc);
  child.record.parentRoot = parent.root;
  const releaseChild = lifecycle.registerDialog(child.record);
  const releaseParent = lifecycle.registerDialog(parent.record);
  assert.equal(lifecycle.isTopDialog(child.root), true);
  assert.equal(parent.root.inert, true);
  assert.equal(doc.activeElement, child.first);
  releaseChild(); assert.equal(doc.activeElement, parent.first);
  releaseParent(); assert.equal(doc.body.style.overflow, 'scroll');
});
test('missing opener and parent-first cleanup do not leave inert state or locks behind', () => {
  const doc = documentModel(), parent = entry(doc), releaseParent = lifecycle.registerDialog(parent.record);
  const child = entry(doc), releaseChild = lifecycle.registerDialog(child.record);
  parent.record.opener.isConnected = false;
  releaseParent(); assert.equal(doc.activeElement, child.first); assert.equal(child.root.inert, false);
  releaseChild(); assert.equal(doc.body.style.overflow, 'scroll'); assert.equal(doc.listenerCount(), 0);
});
test('hidden or disabled child triggers restore focus to an available parent control', () => {
  for (const condition of ['visibility', 'disabled']) {
    const doc = documentModel(), parent = entry(doc), releaseParent = lifecycle.registerDialog(parent.record);
    parent.last.focus();
    const child = entry(doc), releaseChild = lifecycle.registerDialog(child.record);
    if (condition === 'visibility') parent.last.visibility = 'hidden';
    else parent.last.disabled = true;
    releaseChild(); assert.equal(doc.activeElement, parent.first);
    releaseParent(); assert.equal(doc.body.style.overflow, 'scroll');
  }
});
test('lifecycle hook uses current close callbacks/disabled state without re-registering on form changes', () => {
  const h = hooks(), doc = documentModel(), calls = [];
  const { useDialogLifecycle } = evaluate('src/components/ui/useDialogLifecycle.ts', { react: h.api, './dialogLifecycle': lifecycle }, { document: doc });
  const modal = entry(doc);
  const render = (open, options) => h.render(() => useDialogLifecycle(open, options));
  let refs = render(true, { onClose: () => calls.push('old') });
  refs.rootRef.current = modal.root; refs.panelRef.current = modal.panel; h.flush();
  refs = render(true, { onClose: () => calls.push('new'), closeDisabled: true }); h.flush();
  key(doc, 'Escape'); refs.requestClose(); assert.deepEqual(calls, []);
  refs = render(true, { onClose: () => calls.push('new'), closeOnEscape: false }); h.flush();
  key(doc, 'Escape'); assert.deepEqual(calls, []);
  refs.requestClose(); assert.deepEqual(calls, ['new']);
  render(false, { onClose() {} }); h.flush(); assert.equal(doc.body.style.overflow, 'scroll');
});

function component(path, reducedMotion = false) {
  const h = hooks();
  const closeHook = { DialogParentContext: React.createContext(null), useDialogLifecycle: (_, options) => ({ rootRef: { current: null }, panelRef: { current: null },
    requestClose: () => { if (!options.closeDisabled) options.onClose(); } }) };
  return { h, exports: evaluate(path, { react: h.api, 'motion/react': { ...motion, useReducedMotion: () => reducedMotion }, '../../i18n': i18n,
    './useDialogLifecycle': closeHook, 'react-dom': { createPortal: (child) => child } }) };
}
test('legacy Modal props/classes survive; opt-in variants, semantics, footer and form association are explicit', () => {
  const { h, exports: { default: Modal } } = component('src/components/ui/Modal.tsx');
  let closes = 0;
  const props = { isOpen: true, title: 'Title', children: React.createElement('form', { id: 'editor' }), onClose: () => closes++, className: 'existing-root', maxWidth: 'max-w-4xl' };
  let tree = h.render(Modal, props), panel = byRole(tree, 'dialog');
  assert.match(panel.props.className, /max-w-4xl/); assert.ok(panel.props['aria-labelledby']);
  assert.equal(all(tree, (node) => node.props?.className?.includes('shared-modal')).length, 0);
  const backdrop = all(tree, (node) => node.props?.className?.startsWith('absolute inset-0'))[0];
  backdrop.props.onClick(); all(tree, (node) => node.props?.['aria-label'] === 'Close dialog')[0].props.onClick(); assert.equal(closes, 2);
  assert.equal(byRole(h.render(Modal, { ...props, isOpen: false }), 'dialog'), undefined);
  const layout = evaluate('src/components/ui/ModalLayout.tsx', { react: h.api });
  const footer = layout.ModalSubmitButton({ formId: 'editor', disabled: true, children: 'Save' });
  assert.equal(footer.props.form, 'editor'); assert.equal(footer.props.type, 'submit'); assert.equal(footer.props.disabled, true);
  for (const variant of ['compact', 'sectioned', 'drawer']) {
    tree = h.render(Modal, { ...props, layout: variant, footer, closeDisabled: true });
    assert.ok(all(tree, (node) => node.props?.className?.includes(`shared-modal--${variant}`)).length);
    assert.equal(all(tree, (node) => node.type === 'form').length, 1);
    assert.equal(all(tree, (node) => node.props?.className === 'shared-modal-footer').length, 1);
    assert.match(byRole(tree, 'dialog').props.className, /max-w-4xl/);
    all(tree, (node) => node.props?.className?.startsWith('absolute inset-0'))[0].props.onClick();
  }
  assert.equal(closes, 2);
  tree = h.render(Modal, { ...props, closeOnBackdrop: false });
  assert.equal(all(tree, (node) => node.props?.className?.startsWith('absolute inset-0'))[0].props.onClick, undefined);
});
test('reduced-motion preference suppresses movement without changing content', () => {
  const { h, exports: { default: Modal } } = component('src/components/ui/Modal.tsx', true);
  const panel = byRole(h.render(Modal, { isOpen: true, title: 'Title', onClose() {}, layout: 'drawer', children: 'Content' }), 'dialog');
  assert.equal(panel.props.initial, false);
  assert.equal(panel.props.exit.opacity, 1);
  assert.equal(panel.props.exit.x, undefined);
  assert.match(textOf(panel), /Content/);
});
test('ConfirmModal preserves synchronous confirm/close policy, labels, busy guards and legacy sizing', () => {
  const { h, exports: { default: Confirm } } = component('src/components/ui/ConfirmModal.tsx');
  const calls = [], props = { isOpen: true, onConfirm: () => { calls.push('confirm'); return Promise.resolve(); }, onClose: () => calls.push('close'), title: 'Delete', message: 'Message', confirmText: 'Remove', cancelText: 'Keep' };
  let tree = h.render(Confirm, props);
  assert.ok(byRole(tree, 'alertdialog').props['aria-describedby']);
  assert.match(byRole(tree, 'alertdialog').props.className, /max-w-md/);
  all(tree, (node) => node.type === 'button' && textOf(node).includes('Remove'))[0].props.onClick();
  assert.deepEqual(calls, ['confirm', 'close']);
  tree = h.render(Confirm, { ...props, closeOnConfirm: false });
  all(tree, (node) => node.type === 'button' && textOf(node).includes('Remove'))[0].props.onClick();
  assert.deepEqual(calls, ['confirm', 'close', 'confirm']);
  tree = h.render(Confirm, { ...props, isLoading: true });
  assert.ok(all(tree, (node) => node.type === 'button').every((node) => node.props.disabled));
  all(tree, (node) => node.type === 'button').forEach((node) => node.props.onClick());
  assert.deepEqual(calls, ['confirm', 'close', 'confirm']);
  assert.equal(h.render(Confirm, { ...props, isOpen: false }), null);
});

test('object-URL leases and local viewer/download paths clean up, preserve files and fail safely', () => {
  const created = [], revoked = [], timers = [], tabs = [], links = [];
  let blocked = false;
  const api = { createObjectURL: (file) => { created.push(file); return `blob:local-${created.length}`; }, revokeObjectURL: (url) => revoked.push(url) };
  const local = evaluate('src/components/ui/localFilePreview.ts', {}, { URL: api,
    window: { open() { if (blocked) return null; const tab = { opener: {}, location: { replace: (url) => { tab.url = url; } }, close() { tab.closed = true; } }; tabs.push(tab); return tab; }, setTimeout: (fn) => timers.push(fn) },
    document: { body: { appendChild: (link) => links.push(link) }, createElement: () => ({ click() { this.clicked = true; }, remove() { this.removed = true; } }) },
  });
  const file = new File(['content'], 'image.png', { type: 'image/png' });
  const lease = local.createObjectUrlLease(file); lease.release(); lease.release(); assert.equal(revoked.length, 1);
  local.openLocalFile(file); assert.equal(tabs[0].opener, null); assert.equal(created.at(-1), file); assert.match(tabs[0].url, /^blob:/);
  local.downloadLocalFile(file); assert.equal(links[0].download, 'image.png'); assert.equal(links[0].clicked, true); assert.equal(links[0].removed, true);
  timers.forEach((fn) => fn()); assert.equal(revoked.length, 3);
  blocked = true; const before = created.length; assert.throws(() => local.openLocalFile(file), /blocked/); assert.equal(created.length, before);
  assert.equal(local.localPreviewMime(new File(['pdf'], 'file.pdf')), 'application/pdf');
  assert.equal(local.localPreviewMime(new File(['<svg>'], 'image.svg', { type: 'image/svg+xml' })), null);
  assert.throws(() => local.openLocalFile(new File(['x'], 'file.html', { type: 'text/html' })), /download only/);
});

function fileComponents() {
  const h = hooks(), created = [], released = [], calls = [];
  const attachment = evaluate('src/utils/attachments.ts', {
    '../redux/store': {store: {getState() { throw new Error('File presentation must not read session state'); }}},
    '../redux/features/auth/sessionSync': {synchronizeSession() {}},
    '../redux/features/auth/permissionUtils': {isActiveUser: () => false},
  });
  const local = { createObjectUrlLease: (file) => { const url = `blob:${created.length}`; created.push(file); return { url, release: () => released.push(url) }; },
    localPreviewMime: (file) => file.type === 'image/png' || file.type === 'application/pdf',
    openLocalFile: (file) => calls.push(['local-open', file]), downloadLocalFile: (file) => calls.push(['local-download', file]) };
  const exports = evaluate('src/components/ui/FileUploadPreview.tsx', { react: h.api, '../../i18n': i18n,
    '../../utils/attachments': { ...attachment, resolveAttachmentUrl: (url) => url.startsWith('https://') ? url : null,
      openUrlAsBlob: async (...args) => calls.push(['remote-open', ...args]), downloadUrlAsFile: async (...args) => calls.push(['remote-download', ...args]) },
    './localFilePreview': local,
  }, {}, '\nexports.CompactFilePreviewCard = CompactFilePreviewCard;');
  return { h, exports, created, released, calls };
}
test('compact file metadata, local thumbnail lifecycle, permitted callbacks and auth opening are preserved', async () => {
  const { h, exports: { CompactFilePreviewCard: Card }, created, released, calls } = fileComponents();
  const file = new File(['data'], 'photo.png', { type: 'image/png' }); let removed = 0;
  let tree = h.render(Card, { file, onRemove: () => removed++ }); h.flush();
  tree = h.render(Card, { file, onRemove: () => removed++ });
  assert.match(textOf(tree), /photo.png/); assert.match(textOf(tree), /4 B/); assert.match(textOf(tree), /image\/png/);
  assert.equal(all(tree, (node) => node.type === 'img')[0].props.src, 'blob:0');
  all(tree, (node) => node.props?.title === 'Open')[0].props.onClick();
  all(tree, (node) => node.props?.title === 'Remove')[0].props.onClick(); assert.equal(removed, 1); assert.equal(calls[0][1], file);
  const replacement = new File(['next'], 'next.png', { type: 'image/png' });
  h.render(Card, { file: replacement }); h.flush(); assert.equal(created.length, 2); assert.equal(released.length, 1);
  h.cleanup(); assert.equal(released.length, 2);
  const other = fileComponents(); tree = other.h.render(other.exports.CompactFilePreviewCard, { url: 'https://files.example/file.pdf', name: 'Original.pdf', mimeType: 'application/pdf', fileSize: 1024 });
  assert.match(textOf(tree), /1.0 KB/); assert.equal(other.calls.length, 0); // No metadata fetch.
  await all(tree, (node) => node.props?.title === 'Open')[0].props.onClick();
  assert.deepEqual(other.calls[0], ['remote-open', 'https://files.example/file.pdf', 'application/pdf']);
  assert.equal(all(tree, (node) => node.props?.title === 'Remove').length, 0);
});
test('legacy file cards/lists/dropzones stay opt-in; original selected files and acceptance callbacks survive', () => {
  const { h, exports: { FilePreviewCard: Card, FileUploadDropzone: Drop, SelectedFilesPreview: List } } = fileComponents();
  const file = new File(['x'], 'file.pdf', { type: 'application/pdf' });
  const legacy = h.render(Card, { file });
  assert.match(legacy.props.className, /rounded-2xl/); assert.doesNotMatch(legacy.props.className, /compact-file/);
  assert.equal(all(legacy, (node) => node.props?.title === 'Open').length, 0);
  let received;
  const drop = h.render(Drop, { inputId: 'upload', title: 'Upload', hint: 'Hint', accept: 'image/*', multiple: false, onFilesSelected: (files) => { received = files; } });
  const input = all(drop, (node) => node.type === 'input')[0]; assert.equal(input.props.accept, 'image/*'); assert.equal(input.props.multiple, false); assert.equal(input.props.className, 'hidden');
  input.props.onChange({ target: { files: [file] }, currentTarget: { value: 'file' } }); assert.equal(received[0], file);
  const list = h.render(List, { files: [file], onRemove: (index) => { received = index; }, presentation: 'compact' });
  const card = all(list, (node) => node.type === Card)[0]; assert.equal(card.props.file, file); assert.equal(card.props.presentation, 'compact'); card.props.onRemove(); assert.equal(received, 0);
});

test('compact cards display known zero-byte sizes without fetching metadata or changing file actions', () => {
  const { h, exports: { CompactFilePreviewCard: Card }, calls } = fileComponents();
  const file = new File([], 'empty.txt', { type: 'text/plain' });
  const local = h.render(Card, { file });
  assert.match(textOf(local), /empty\.txt/); assert.match(textOf(local), /0 B/);
  const remote = h.render(Card, { url: 'https://files.example/empty.pdf', name: 'empty.pdf', fileSize: 0 });
  assert.match(textOf(remote), /0 B/); assert.equal(calls.length, 0);
  const unknown = h.render(Card, { url: 'https://files.example/unknown.pdf', name: 'unknown.pdf' });
  assert.doesNotMatch(textOf(unknown), /0 B/);
});

test('mobile custom drawers, modern input targets and editor font/focus overrides stay scoped to opt-in layouts', () => {
  const css = read('src/components/ui/ModalLayout.css');
  assert.match(css, /@media \(max-width: 767px\)\s*\{\s*\.shared-modal--drawer > \.relative\s*\{[^}]*max-width: 100%;[^}]*border-radius: 0;/);
  assert.match(css, /\.shared-modal-body :is\(input:not\(\[type="checkbox"\]\):not\(\[type="color"\]\):not\(\[type="file"\]\), select\)\s*\{ min-height: 2\.75rem;/);
  assert.match(css, /\.shared-modal-body \.tiptap\s*\{ font-family: var\(--font-sans\);/);
  assert.match(css, /\.shared-modal-body \.tiptap-wrapper:focus-within\s*\{ border-color: var\(--archi-accent\); box-shadow:.*var\(--archi-accent-soft\)/);
  // Wider document viewing still has a supplied cap, while the day drawer keeps its desktop cap.
  assert.match(read('src/pages/DocumentLibrary.tsx'), /maxWidth="max-w-6xl"/);
  assert.match(read('src/pages/Agenda/Agenda.tsx'), /maxWidth="max-w-lg"/);
});
test('new styles are scoped; unrelated callers and native category lifecycle remain unchanged after Batches 1–4', () => {
  const css = read('src/components/ui/ModalLayout.css');
  assert.match(css, /@container shared-modal-body/); assert.match(css, /prefers-reduced-motion/);
  for (const file of ['Dashboard.tsx', 'Events.tsx', 'Moderation.tsx']) {
    assert.doesNotMatch(read(`src/pages/${file}`), /layout="(compact|sectioned|drawer)"|presentation="compact"/);
  }
  assert.match(read('src/components/ui/CategoryManagerDialog.tsx'), /dialog\.showModal\(\)/);
});
