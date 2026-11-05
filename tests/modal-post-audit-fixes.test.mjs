import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const parse = (file) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(root, predicate) {
  const result = [];
  function visit(node) { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }
  visit(root); return result;
}
function evaluate(expression, context) {
  runInNewContext(ts.transpileModule(`result = (${expression});`, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
  } }).outputText, context);
  return context.result;
}
const admin = parse('src/pages/AdminPanel.tsx');
const initializer = (sf, name) => find(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === name)[0].initializer.getText(sf);
const translate = (key) => key;
const helpers = Object.fromEntries(['FormField', 'SelectField', 'BeautifulDateTimePicker'].map((name) => [name,
  evaluate(initializer(admin, name), { React, useI18n: () => ({ translate }), Plus: () => null }),
]));

test('Admin helper labels name unique native controls across simultaneously mounted instances', () => {
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null,
    ...Array.from({ length: 12 }, (_, index) => [
      React.createElement(helpers.FormField, { key: `text-${index}`, label: `Text ${index}`, value: '', onChange() {} }),
      React.createElement(helpers.SelectField, { key: `select-${index}`, label: `Select ${index}`, options: ['active', 'suspended'], value: 'pending', onChange() {} }),
      React.createElement(helpers.BeautifulDateTimePicker, { key: `date-${index}`, label: `Date ${index}`, value: '', type: 'date', onChange() {} }),
      React.createElement(helpers.BeautifulDateTimePicker, { key: `time-${index}`, label: `Time ${index}`, value: '', type: 'time', onChange() {} }),
    ])));
  const controls = [...markup.matchAll(/<(input|select|button)\b[^>]*\bid="([^"]+)"/g)];
  const labels = [...markup.matchAll(/<label\b[^>]*\bfor="([^"]+)"[^>]*>([^<]+)<\/label>/g)];
  assert.equal(controls.length, 48); assert.equal(labels.length, 48);
  assert.equal(new Set(controls.map((m) => m[2])).size, 48);
  for (const [, id, text] of labels) { assert.ok(controls.some((m) => m[2] === id)); assert.match(text, /^(Text|Select|Date|Time) \d+$/); }
  assert.equal((markup.match(/type="button"/g) || []).length, 24);
  assert.equal((markup.match(/<option value="pending" disabled="" selected="">/g) || []).length, 12);
});

test('Admin helper rerenders retain IDs, original change handlers and picker toggle behavior', () => {
  let nextId = 0, state = false, changed;
  const ids = [], hooks = { ...React, useId: () => ':instance:', useState: (initial) => [typeof initial === 'boolean' ? state : initial, (value) => { state = value; }], useEffect() {}, useRef: () => ({ current: null }) };
  for (const name of ['FormField', 'SelectField']) {
    const helper = evaluate(initializer(admin, name), { React: hooks, useI18n: () => ({ translate }) });
    for (let render = 0; render < 2; render++) {
      const tree = helper({ label: 'Visible', type: 'email', required: false, autoComplete: 'email', minLength: 4, options: ['a'], value: '', onChange: (v) => { changed = v; } });
      const [label, control] = tree.props.children;
      ids.push(control.props.id); assert.equal(label.props.htmlFor, control.props.id); assert.equal(label.props.children, 'Visible');
      control.props.onChange({ target: { value: 'changed' } }); assert.equal(changed, 'changed');
      if (name === 'FormField') { assert.equal(control.props.type, 'email'); assert.equal(control.props.required, false); assert.equal(control.props.minLength, 4); assert.equal(control.props.autoComplete, 'email'); }
    }
  }
  assert.equal(new Set(ids).size, 1);
  const picker = evaluate(initializer(admin, 'BeautifulDateTimePicker'), { React: hooks, useI18n: () => ({ translate }), Plus: () => null });
  const tree = picker({ label: 'Date', value: '', onChange: () => { nextId++; }, type: 'date' });
  const [label, trigger] = tree.props.children;
  assert.equal(trigger.type, 'button'); assert.equal(trigger.props.type, 'button'); assert.equal(label.props.htmlFor, trigger.props.id);
  assert.equal(trigger.props['aria-expanded'], false); trigger.props.onClick(); assert.equal(state, true); assert.equal(nextId, 0);
});

test('all Admin rich-editor names reference visible labels; checkbox, password and textarea IDs are instance scoped', () => {
  const editors = find(admin, (n) => ts.isJsxSelfClosingElement(n) && n.tagName.getText(admin) === 'TiptapEditor');
  const attribute = (node, name) => node.attributes.properties.find((p) => p.name?.getText(admin) === name)?.initializer;
  assert.equal(editors.length, 4);
  const ids = [];
  for (const editor of editors) {
    const wrapper = editor.parent;
    const label = wrapper.children.find((n) => ts.isJsxElement(n) && n.openingElement.tagName.getText(admin) === 'label');
    assert.ok(label);
    const labelledBy = attribute(editor, 'ariaLabelledBy');
    assert.equal(labelledBy.getText(admin), attribute(label.openingElement, 'id').getText(admin));
    assert.match(label.getText(admin), /translate\("adminPanelPage\.form\./);
    for (const adminFieldId of [':first:', ':second:']) ids.push(evaluate(labelledBy.expression.getText(admin), { adminFieldId }));
  }
  const fields = find(admin, (n) => (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && ['input', 'textarea', 'AdminPasswordField'].includes(n.tagName.getText(admin)) && attribute(n, 'id')?.getText(admin).includes('adminFieldId'));
  assert.equal(fields.length, 6);
  for (const field of fields) {
    const id = attribute(field, 'id');
    for (const adminFieldId of [':first:', ':second:']) ids.push(evaluate(id.expression.getText(admin), { adminFieldId }));
    if (field.tagName.getText(admin) !== 'AdminPasswordField') {
      const labels = find(field.parent, (n) => ts.isJsxOpeningElement(n) && n.tagName.getText(admin) === 'label');
      assert.ok(labels.some((label) => attribute(label, 'htmlFor')?.getText(admin) === id.getText(admin)));
    }
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('Tiptap opt-in naming reaches editorProps attributes without changing content/update bindings or legacy names', () => {
  const sf = parse('src/components/ui/TiptapEditor.tsx'); let options, changed;
  const extension = { configure: (config) => ({ config }) };
  const context = { React, useI18n: () => ({ translate: (key) => key }), useRef: (value) => ({ current: value }), useEffect() {}, useEditor: (value) => { options = value; return null; }, cn: (...classes) => classes.filter(Boolean).join(' '), Toolbar: () => null, EditorContent: () => null };
  for (const name of ['StarterKit', 'Underline', 'Link', 'Image', 'Table', 'TableRow', 'TableHeader', 'TableCell', 'Placeholder', 'YouTubeEmbed']) context[name] = extension;
  const Editor = evaluate(initializer(sf, 'TiptapEditor'), context);
  Editor({ content: '<p>Existing</p>', onChange: (value) => { changed = value; }, ariaLabelledBy: ':admin:-content' });
  assert.equal(options.editorProps.attributes['aria-labelledby'], ':admin:-content');
  assert.equal(options.editorProps.attributes.role, 'textbox'); assert.equal(options.editorProps.attributes['aria-multiline'], 'true');
  assert.equal(options.content, '<p>Existing</p>'); assert.equal(options.extensions.length, 10);
  options.onUpdate({ editor: { getHTML: () => '<p>Changed</p>' } }); assert.equal(changed, '<p>Changed</p>');
  Editor({ content: '', onChange() {} }); assert.equal(Object.hasOwn(options.editorProps.attributes, 'aria-labelledby'), false);
});

// Evaluate the real page effect and its real dependency expression. No app/store,
// network, browser or replacement lifecycle implementation is used.
const docs = parse('src/pages/DocumentLibrary.tsx');
const effect = find(docs, (n) => ts.isCallExpression(n) && n.expression.getText(docs) === 'React.useEffect' && n.arguments[0]?.getText(docs).includes('fetchUrlAsObjectUrl'))[0];
function previewHarness() {
  const requests = [], revoked = [], errors = [], writes = [];
  const c = { fileId: null, folderId: 'folder', files: [], previewSourceUrl: null, previewMimeType: undefined,
    previewUrl: null, loading: false,
    fetchUrlAsObjectUrl: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
    URL: { revokeObjectURL: (url) => revoked.push(url) }, notifyError: (error) => errors.push(error),
    setPreviewUrl: (url) => { writes.push(['url', url]); c.previewUrl = url; },
    setIsLoadingPreview: (value) => { writes.push(['loading', value]); c.loading = value; },
  };
  let previous, cleanup;
  function render(fileId, files = c.files, folderId = c.folderId) {
    Object.assign(c, { fileId, files, folderId });
    c.selectedPreviewFile = files.find((file) => file.id === fileId) || null;
    c.getDocumentPreviewUrl = (file) => file.url;
    for (const name of ['previewSourceUrl', 'previewMimeType']) c[name] = evaluate(initializer(docs, name), c);
    const deps = evaluate(effect.arguments[1].getText(docs), c);
    if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
      cleanup?.(); cleanup = evaluate(effect.arguments[0].getText(docs), c)(); previous = deps;
    }
  }
  return { c, requests, revoked, errors, writes, render, unmount: () => cleanup?.() };
}
const a = { id: 'A', url: 'https://api.example/A', mime_type: 'application/pdf' };
const b = { id: 'B', url: 'https://api.example/B', mime_type: 'image/png' };
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('Document normal preview retains authenticated helper URL/MIME arguments and releases exactly once on close', async () => {
  const h = previewHarness(); h.render('A', [a]);
  assert.equal(h.c.loading, true); assert.equal(h.c.previewUrl, null);
  assert.deepEqual(h.requests[0].args, [a.url, a.mime_type]);
  h.requests[0].resolve('blob:A'); await settle();
  assert.equal(h.c.previewUrl, 'blob:A'); assert.equal(h.c.loading, false); assert.deepEqual(h.revoked, []);
  h.render(null); assert.deepEqual(h.revoked, ['blob:A']); assert.equal(h.c.previewUrl, null); assert.equal(h.c.loading, false);
  h.unmount(); h.unmount(); assert.deepEqual(h.revoked, ['blob:A']);
});

test('Document close before resolution discards late success and revokes its URL without stale state writes', async () => {
  const h = previewHarness(); h.render('A', [a]); h.render(null); const writes = h.writes.length;
  h.requests[0].resolve('blob:late'); await settle();
  assert.deepEqual(h.revoked, ['blob:late']); assert.equal(h.c.previewUrl, null); assert.equal(h.c.loading, false); assert.equal(h.writes.length, writes);
  h.unmount(); assert.deepEqual(h.revoked, ['blob:late']);
});

test('Document A to B switch ignores late A while B is still loading', async () => {
  const h = previewHarness(); h.render('A', [a, b]); h.render('B');
  h.requests[0].resolve('blob:old-A'); await settle();
  assert.equal(h.c.previewUrl, null); assert.equal(h.c.loading, true); assert.deepEqual(h.revoked, ['blob:old-A']);
  h.requests[1].resolve('blob:B'); await settle();
  assert.equal(h.c.previewUrl, 'blob:B'); assert.equal(h.c.loading, false);
  h.unmount(); assert.deepEqual(h.revoked, ['blob:old-A', 'blob:B']);
});

test('Document late A cannot replace or revoke already displayed B', async () => {
  const h = previewHarness(); h.render('A', [a, b]); h.render('B');
  assert.deepEqual(h.requests[1].args, [b.url, b.mime_type]);
  h.requests[1].resolve('blob:B'); await settle(); h.requests[0].resolve('blob:A'); await settle();
  assert.equal(h.c.previewUrl, 'blob:B'); assert.deepEqual(h.revoked, ['blob:A']);
  h.unmount(); h.unmount(); assert.deepEqual(h.revoked, ['blob:A', 'blob:B']);
});

test('Document same-file array/object refresh retains active URL and pending request without duplicate fetching', async () => {
  const h = previewHarness(); h.render('A', [a]); h.render('A', [{ ...a }, b]);
  assert.equal(h.requests.length, 1); h.requests[0].resolve('blob:active'); await settle();
  h.render('A', [{ ...a, original_name: 'Renamed.pdf' }, { ...b }]);
  assert.equal(h.requests.length, 1); assert.equal(h.c.previewUrl, 'blob:active'); assert.deepEqual(h.revoked, []);
  h.unmount(); assert.deepEqual(h.revoked, ['blob:active']);
});

test('Document rapid reopen creates a new owner and safely releases every late and active URL', async () => {
  const h = previewHarness(); h.render('A', [a]); h.render(null); h.render('A'); h.render(null); h.render('A');
  assert.equal(h.requests.length, 3);
  h.requests[2].resolve('blob:current'); await settle();
  h.requests[0].resolve('blob:first'); h.requests[1].resolve('blob:second'); await settle();
  assert.equal(h.c.previewUrl, 'blob:current'); assert.deepEqual(h.revoked, ['blob:first', 'blob:second']);
  h.unmount(); assert.deepEqual(h.revoked, ['blob:first', 'blob:second', 'blob:current']);
});

test('Document current rejection clears loading and reports original error; stale rejection cannot affect newer state', async () => {
  const h = previewHarness(), error = new Error('denied'); h.render('A', [a, b]); h.requests[0].reject(error); await settle();
  assert.equal(h.c.loading, false); assert.equal(h.c.previewUrl, null); assert.deepEqual(h.errors, [error]); assert.deepEqual(h.revoked, []);
  h.render(null); h.render('A'); h.render('B'); h.requests[1].reject(new Error('stale')); await settle();
  assert.equal(h.c.loading, true); assert.deepEqual(h.errors, [error]);
  h.requests[2].resolve('blob:B'); await settle(); h.unmount(); assert.deepEqual(h.revoked, ['blob:B']);
});

test('Document settled file switches and changed source/MIME release the previous owner and load current resource', async () => {
  const h = previewHarness(); h.render('A', [a, b]); h.requests[0].resolve('blob:A'); await settle();
  h.render('B'); assert.deepEqual(h.revoked, ['blob:A']); assert.equal(h.c.previewUrl, null);
  h.requests[1].resolve('blob:B'); await settle();
  const updated = { ...b, url: 'https://api.example/B-new', mime_type: 'application/pdf' };
  h.render('B', [updated]); assert.deepEqual(h.revoked, ['blob:A', 'blob:B']); assert.deepEqual(h.requests[2].args, [updated.url, updated.mime_type]);
  h.requests[2].resolve('blob:new'); await settle(); h.unmount(); assert.deepEqual(h.revoked, ['blob:A', 'blob:B', 'blob:new']);
});

test('Document missing/unsupported source does not load, and unmounted pending requests still release late results', async () => {
  const h = previewHarness(); h.render('A', []); assert.equal(h.requests.length, 0); assert.equal(h.c.loading, false);
  h.render('A', [{ ...a, url: null }]); assert.equal(h.requests.length, 0);
  h.render('A', [a]); h.unmount(); h.unmount(); h.requests[0].resolve('blob:unmounted'); await settle();
  assert.deepEqual(h.revoked, ['blob:unmounted']); assert.equal(h.c.previewUrl, null);
});

test('Document route validation preserves folder redirect and waits for initial content loading', () => {
  const validation = find(docs, (n) => ts.isCallExpression(n) && n.expression.getText(docs) === 'React.useEffect' && n.arguments[0]?.getText(docs).includes('!selectedPreviewFile'))[0];
  const calls = [], c = { fileId: 'A', folderId: 'folder', selectedPreviewFile: null, isLoadingContent: true, navigate: (...args) => calls.push(args) };
  const check = () => evaluate(validation.arguments[0].getText(docs), c)();
  check(); assert.equal(calls.length, 0);
  c.isLoadingContent = false; c.selectedPreviewFile = a; check(); assert.equal(calls.length, 0);
  c.selectedPreviewFile = null; check(); assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/documents/folder/folder'); assert.equal(calls[0][1].replace, true);
  c.fileId = null; check(); assert.equal(calls.length, 1);
});
