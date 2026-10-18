import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const printer = ts.createPrinter({ removeComments: true });
const print = (node, sf) => printer.printNode(ts.EmitHint.Unspecified, node, sf).replace(/\s+/g, ' ').trim();
const nodes = (root, predicate) => {
  const result = [];
  function visit(node) { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }
  visit(root); return result;
};
const opening = (node) => ts.isJsxElement(node) ? node.openingElement : node;
const tag = (node) => opening(node).tagName?.getText();
const elements = (root, name) => nodes(root, (n) => (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && tag(n) === name);
const attrs = (node, sf, skip = []) => Object.fromEntries(opening(node).attributes.properties
  .filter((p) => ts.isJsxAttribute(p) && !skip.includes(p.name.text))
  .map((p) => [p.name.text, p.initializer ? print(p.initializer, sf) : true]));
function inspect(file) {
  const source = read(file), sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return { source, sf, modals: elements(sf, 'Modal') };
}

const files = ['src/pages/Articles.tsx', 'src/pages/Forums.tsx'];

{
  test('Batch 1 opts into shared layouts, form-associated footers and compact previews only', () => {
    for (const file of files) {
      const { sf, modals } = inspect(file);
      assert.equal(modals.length, file.endsWith('Articles.tsx') ? 1 : 5);
      const ids = new Set();
      for (const modal of modals) {
        assert.equal(attrs(modal, sf).layout, file.endsWith('Articles.tsx') ? '"sectioned"' : '"compact"');
        assert.ok(attrs(modal, sf).footer);
        const form = elements(modal, 'form')[0], submit = elements(modal, 'ModalSubmitButton')[0];
        assert.equal(attrs(form, sf).id, attrs(submit, sf).formId);
        assert.ok(!ids.has(attrs(form, sf).id)); ids.add(attrs(form, sf).id);
        assert.doesNotMatch(print(form, sf), /min-h-\[(220|260|336)px\]|max-h-\[70vh\]|forum-dialog/);
        for (const name of ['FileUploadDropzone', 'FilePreviewCard', 'SelectedFilesPreview'])
          for (const n of elements(modal, name)) assert.equal(attrs(n, sf).presentation, '"compact"');
      }
      for (const confirm of elements(sf, 'ConfirmModal')) assert.equal(attrs(confirm, sf).presentation, '"compact"');
    }
  });
  test('discussion and reply previews retain every persisted reference, with removal only for discussions', () => {
    const { sf, modals } = inspect('src/pages/Forums.tsx');
    for (const [index, state, removable] of [[3, 'editTopicData', true], [4, 'editPostData', false]]) {
      const modal = modals[index], source = print(modal, sf);
      assert.match(source, new RegExp(`${state}\\.attachments\\.map`));
      assert.doesNotMatch(source, new RegExp(`${state}\\.attachments\\[0\\]`));
      const card = elements(modal, 'FilePreviewCard')[0];
      assert.equal(!!attrs(card, sf).onRemove, removable);
      if (removable) assert.match(attrs(card, sf).onRemove, /handleRemoveExistingAttachment\(url\)/);
      assert.equal(elements(modal, 'SelectedFilesPreview').length, 1);
    }
  });

  function evaluate(expression, context) {
    const sandbox = { ...context };
    const code = ts.transpileModule(`result = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(code, sandbox);
    return sandbox.result;
  }

  test('article upload and removal callbacks preserve original Files, persisted thumbnail and unrelated metadata', () => {
    const { sf, modals } = inspect('src/pages/Articles.tsx');
    const original = new File(['old'], 'old.pdf'), added = new File(['new'], 'new.pdf');
    let selected = [original];
    const drop = elements(modals[0], 'FileUploadDropzone').find((n) => attrs(n, sf).inputId === '"article-attachments-upload"');
    evaluate(attributeExpression(drop, 'onFilesSelected', sf), { setSelectedFiles: (fn) => { selected = fn(selected); } })([added]);
    assert.equal(selected.length, 2); assert.equal(selected[0], original); assert.equal(selected[1], added);
    const formData = { thumbnail_url: 'cover.png', structured_fields: { author: 'Author', tags: ['one'], file_urls: ['one.pdf', 'two.pdf'] } };
    let next;
    const card = elements(modals[0], 'FilePreviewCard').find((n) => attrs(n, sf).onRemove?.includes('updatedUrls'));
    evaluate(attributeExpression(card, 'onRemove', sf), { formData, url: 'two.pdf', setFormData: (value) => { next = value; } })();
    assert.deepEqual(Array.from(next.structured_fields.file_urls), ['one.pdf']);
    assert.equal(next.structured_fields.tags, formData.structured_fields.tags);
    assert.equal(next.structured_fields.author, 'Author'); assert.equal(next.thumbnail_url, 'cover.png');
    assert.equal(formData.structured_fields.file_urls.length, 2);
  });

  function attributeExpression(node, name, sf) {
    return opening(node).attributes.properties.find((p) => p.name?.text === name).initializer.expression.getText(sf);
  }

  test('forum thumbnail callbacks retain create/edit replacement differences and original File objects', () => {
    const { sf, modals } = inspect('src/pages/Forums.tsx'), file = new File(['image'], 'cover.png', { type: 'image/png' });
    for (const [index, setter, expectedUrl] of [[1, 'setNewForumData', 'existing.png'], [2, 'setEditForumData', null]]) {
      let state = { name: 'Forum', thumbnail: null, thumbnail_url: 'existing.png' };
      const drop = elements(modals[index], 'FileUploadDropzone')[0];
      evaluate(attributeExpression(drop, 'onFilesSelected', sf), { [setter]: (fn) => { state = fn(state); } })([file]);
      assert.equal(state.thumbnail, file); assert.equal(state.thumbnail_url, expectedUrl); assert.equal(state.name, 'Forum');
    }
  });

  test('discussion persisted-file removal tracks each reference once and retains IDs and other files', () => {
    const { sf } = inspect('src/pages/Forums.tsx');
    const handler = nodes(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === 'handleRemoveExistingAttachment')[0];
    let state = { id: 'topic', forumId: 'forum', attachments: ['one.pdf', 'two.pdf', 'three.png'], deleteFiles: [] };
    const remove = evaluate(handler.initializer.getText(sf), { setEditTopicData: (fn) => { state = fn(state); } });
    remove('two.pdf'); remove('two.pdf'); remove('three.png');
    assert.deepEqual(Array.from(state.attachments), ['one.pdf']);
    assert.deepEqual(Array.from(state.deleteFiles), ['two.pdf', 'three.png']);
    assert.equal(state.id, 'topic'); assert.equal(state.forumId, 'forum');
  });

  test('native text controls retain associated labels and translated section headings exist in both locales', () => {
    for (const file of files) {
      const { sf, modals } = inspect(file);
      for (const modal of modals) {
        for (const name of ['input', 'select', 'textarea']) for (const field of elements(modal, name)) {
          const id = attrs(field, sf).id;
          assert.ok(id); assert.ok(elements(modal, 'label').some((n) => attrs(n, sf).htmlFor === id));
        }
      }
    }
    for (const locale of ['en', 'fr']) {
      const labels = JSON.parse(read(`src/i18n/locales/${locale}.json`)).modalBatchOne;
      for (const key of ['basicInformation', 'articleContent', 'mediaAttachments']) assert.ok(labels[key]);
    }
  });
}
