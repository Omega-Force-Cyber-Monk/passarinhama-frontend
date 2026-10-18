import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const files = ['src/pages/Trainings.tsx', 'src/pages/TechnicoPro.tsx'];
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const printer = ts.createPrinter({ removeComments: true });
const print = (n, sf) => printer.printNode(ts.EmitHint.Unspecified, n, sf).replace(/\s+/g, ' ').trim();
const find = (root, predicate) => {
  const result = [];
  function visit(n) { if (predicate(n)) result.push(n); ts.forEachChild(n, visit); }
  visit(root); return result;
};
const opening = (n) => ts.isJsxElement(n) ? n.openingElement : n;
const elements = (root, name) => find(root, (n) => (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && opening(n).tagName.getText() === name);
const attrs = (n, sf, skip = []) => Object.fromEntries(opening(n).attributes.properties
  .filter((p) => ts.isJsxAttribute(p) && !skip.includes(p.name.text))
  .map((p) => [p.name.text, p.initializer ? print(p.initializer, sf) : true]));
function inspect(file) {
  const source = read(file), sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return { source, sf, modal: elements(sf, 'Modal')[0] };
}

{
  function evaluate(expression, context) {
    const code = ts.transpileModule(`result = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
    runInNewContext(code, context);
    return context.result;
  }
  function model(file, overrides = {}) {
    const { sf, modal } = inspect(file);
    const context = {
      React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
      translate: (key) => key, isFormOpen: true, canSubmitForm: true, isCreating: false, isUpdating: false,
      editingTraining: null, editingItem: null, defaultCategoryId: 'fallback-category',
      categories: [{ id: 'category', name: 'Category' }], selectedFiles: [], removedFileUrls: [], removedAttachmentUrls: [],
      formData: { title: ' Title ', excerpt: ' Excerpt ', category_id: 'category', status: 'pending',
        body: '<p>Body</p>', description: '<p>Description</p>', thumbnail: null, thumbnail_url: 'https://files.example/cover.png',
        attachments: [], file_urls: [] },
      handleSubmit() {}, handleImageUpload() {}, toast: { success() {}, error() {} }, getApiErrorDisplayMessage: () => 'error',
      ...Object.fromEntries(['Modal', 'ModalSection', 'ModalFieldGrid', 'ModalFullWidth', 'ModalMediaSplit', 'ModalSubmitButton', 'TiptapEditor', 'ContentStatusField', 'SelectedFilesPreview', 'FilePreviewCard', 'CheckCircle2'].map((name) => [name, name])),
      ...overrides,
    };
    for (const [setter, state] of [['setFormData', 'formData'], ['setSelectedFiles', 'selectedFiles'], ['setRemovedAttachmentUrls', 'removedAttachmentUrls'], ['setRemovedFileUrls', 'removedFileUrls'], ['setIsFormOpen', 'isFormOpen'], ['setEditingTraining', 'editingTraining'], ['setEditingItem', 'editingItem'], ['setDeletingId', 'deletingId']]) {
      context[setter] = (next) => { context[state] = typeof next === 'function' ? next(context[state]) : next; };
    }
    function handler(name) {
      const node = find(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === name)[0];
      assert.ok(node, `Missing ${name}`);
      return evaluate(node.initializer.getText(sf), context);
    }
    context.getAttachmentUrl = handler('getAttachmentUrl'); context.getAttachmentName = handler('getAttachmentName');
    return { context, handler, render: () => evaluate(modal.getText(sf), context), sf, modal };
  }
  function all(tree, type) {
    const result = [];
    function visit(n) {
      if (Array.isArray(n)) return n.forEach(visit);
      if (!n?.props) return;
      if (n.type === type) result.push(n);
      visit(n.props.children); visit(n.props.footer); visit(n.props.preview);
    }
    visit(tree); return result;
  }

  for (const file of files) {
    test(`${file}: shared sections, unique footer association, compact previews and labelled native inputs`, () => {
      const m = model(file), tree = m.render();
      assert.equal(tree.props.layout, 'sectioned');
      assert.equal(all(tree, 'ModalSection').length, 3);
      assert.equal(all(tree, 'ModalMediaSplit').length, 2);
      assert.equal(all(tree, 'form').length, 1);
      const form = all(tree, 'form')[0], submit = all(tree, 'ModalSubmitButton')[0];
      assert.equal(submit.props.formId, file.includes('Trainings') ? 'training-editor-form' : 'technicopro-editor-form');
      assert.equal(submit.props.formId, form.props.id);
      assert.equal(submit.props.disabled, false);
      for (const busy of ['isCreating', 'isUpdating']) {
        m.context[busy] = true; assert.equal(all(m.render(), 'ModalSubmitButton')[0].props.disabled, true); m.context[busy] = false;
      }
      m.context.canSubmitForm = false; assert.equal(all(m.render(), 'ModalSubmitButton')[0].props.disabled, true);
      const labelled = all(tree, 'label').flatMap((n) => [...all(n, 'input'), ...all(n, 'select'), ...all(n, 'textarea')]);
      for (const field of ['input', 'select', 'textarea'].flatMap((name) => all(tree, name))) assert.ok(labelled.includes(field));
      for (const name of ['FilePreviewCard', 'SelectedFilesPreview']) for (const n of all(tree, name)) assert.equal(n.props.presentation, 'compact');
      const confirm = attrs(elements(m.sf, 'ConfirmModal')[0], m.sf);
      assert.equal(confirm.presentation, '"compact"'); assert.equal(confirm.closeOnConfirm, '{false}');
    });

    test(`${file}: native file chooser replaces selection, retains uploaded references, and previews local/persisted thumbnails`, () => {
      const m = model(file), first = new File(['one'], 'one.pdf'), second = new File(['two'], 'two.pdf');
      const existing = { url: 'https://files.example/old.pdf', original_name: 'Original name.pdf' };
      m.context.formData.attachments = [existing]; m.context.formData.file_urls = [existing];
      let tree = m.render();
      const filesInput = all(tree, 'input').find((n) => n.props.multiple);
      assert.equal(filesInput.props.type, 'file'); assert.equal(filesInput.props.accept, undefined);
      filesInput.props.onChange({ target: { files: [first] } });
      filesInput.props.onChange({ target: { files: [second] } });
      assert.equal(m.context.selectedFiles.length, 1); assert.equal(m.context.selectedFiles[0], second);
      assert.equal(m.context.formData.attachments[0], existing); assert.equal(m.context.formData.file_urls[0], existing);
      tree = m.render(); assert.equal(all(tree, 'SelectedFilesPreview')[0].props.files[0], second);
      const uploaded = all(tree, 'FilePreviewCard').find((n) => n.props.url === existing.url);
      assert.equal(uploaded.props.name, 'Original name.pdf'); assert.equal(uploaded.props.href, existing.url);
      const persisted = all(tree, 'FilePreviewCard').find((n) => n.props.url?.endsWith('cover.png'));
      assert.equal(persisted.props.onRemove, undefined); assert.equal(persisted.props.file, null);
      const image = new File(['image'], 'new-cover.png', { type: 'image/png' });
      const thumbnail = all(tree, 'input').find((n) => n.props.accept === 'image/*');
      assert.equal(thumbnail.props.required, undefined); assert.equal(thumbnail.props.multiple, undefined);
      thumbnail.props.onChange({ target: { files: [image] } });
      const preview = all(m.render(), 'FilePreviewCard').find((n) => n.props.file === image);
      assert.equal(preview.props.name, image.name); assert.equal(preview.props.onRemove, undefined);
      assert.equal(m.context.formData.thumbnail_url, 'https://files.example/cover.png');
      thumbnail.props.onChange({ target: { files: [] } });
      assert.equal(m.context.formData.thumbnail, null); assert.ok(all(m.render(), 'FilePreviewCard').some((n) => n.props.url?.endsWith('cover.png')));
      filesInput.props.onChange({ target: { files: [] } }); assert.equal(m.context.selectedFiles.length, 0);
    });

    test(`${file}: removes only targeted existing/local attachments and preserves original references`, () => {
      const m = model(file), refs = ['https://files.example/one.pdf', { url: 'https://files.example/two.pdf', file_name: 'Two.pdf' }, 'https://files.example/three.png'];
      const key = file.includes('Trainings') ? 'attachments' : 'file_urls', removed = file.includes('Trainings') ? 'removedAttachmentUrls' : 'removedFileUrls';
      m.context.formData[key] = refs;
      m.context.selectedFiles = [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')];
      const tree = m.render(), cards = all(tree, 'FilePreviewCard').filter((n) => n.props.href);
      assert.equal(cards.length, 3); cards[1].props.onRemove();
      assert.deepEqual(Array.from(m.context[removed]), [refs[1].url]);
      assert.equal(m.context.formData[key].length, 2); assert.equal(m.context.formData[key][1], refs[2]); assert.equal(refs.length, 3);
      const keep = m.context.selectedFiles[1]; all(tree, 'SelectedFilesPreview')[0].props.onRemove(0);
      assert.equal(m.context.selectedFiles.length, 1); assert.equal(m.context.selectedFiles[0], keep);
      assert.equal(m.context.formData[key].length, 2);
    });

    test(`${file}: actual submit preserves create/edit mappings, optional thumbnail and removal serialization`, async () => {
      const training = file.includes('Trainings');
      for (const editing of [false, true]) {
        const m = model(file), calls = [];
        const api = (name) => (payload) => { calls.push({ name, payload }); return { unwrap: async () => ({}) }; };
        Object.assign(m.context, { createTraining: api('create'), updateTraining: api('update'), createItem: api('create'), updateItem: api('update') });
        const files = [new File(['pdf'], 'file.pdf')]; m.context.selectedFiles = files;
        m.context.removedAttachmentUrls = ['original-a', 'original-b']; m.context.removedFileUrls = ['original-a', 'original-b'];
        m.context[training ? 'editingTraining' : 'editingItem'] = editing ? { id: 'editing' } : null;
        const references = [{ url: 'https://files.example/retained.pdf', original_name: 'Retained.pdf' }]; m.context.formData.file_urls = references;
        let prevented = 0; await m.handler('handleSubmit')({ preventDefault: () => prevented++ });
        assert.equal(prevented, 1); assert.equal(calls.length, 1); assert.equal(calls[0].name, editing ? 'update' : 'create');
        const payload = editing ? calls[0].payload.data : calls[0].payload;
        assert.equal(payload.title, 'Title'); assert.equal(payload.excerpt, 'Excerpt'); assert.equal(payload.status, 'pending'); assert.equal(payload.category_id, 'category');
        if (training) {
          assert.equal(payload.description, '<p>Description</p>');
          assert.equal(payload[editing ? 'new_attachments' : 'attachments'], files);
          if (editing) {
            assert.equal('attachments' in payload, false); assert.equal('thumbnail' in payload, false);
            assert.equal(payload.remove_attachment_urls, m.context.removedAttachmentUrls);
          } else assert.equal(payload.thumbnail, null);
        } else {
          assert.equal(payload.body, '<p>Body</p>'); assert.equal(payload.files, files); assert.equal(payload.thumbnail, null);
          assert.equal(payload.structured_fields.file_urls, references); assert.equal(payload.remove_file_urls, 'original-a,original-b');
        }
        assert.equal(m.context.isFormOpen, false); assert.equal(m.context[training ? 'editingTraining' : 'editingItem'], null);
      }
    });

    test(`${file}: create defaults, edit prepopulation, invalid submission and delete failure/success remain intact`, async () => {
      const m = model(file), training = file.includes('Trainings');
      const defaults = m.handler('defaultFormState')('category');
      assert.equal(defaults.status, 'draft'); assert.equal(defaults.thumbnail, null); assert.equal(defaults.category_id, 'category');
      const refs = [{ url: 'original-ref', original_name: 'Original.pdf' }];
      const entity = { id: 'edit', title: 'Existing', excerpt: 'Summary', body: '<p>Body</p>', description: '<p>Description</p>', status: 'archived', category: { id: 'stored-category' }, thumbnail_url: 'persisted-cover', attachments: refs, structured_fields: { file_urls: refs } };
      m.handler('openEditForm')(entity);
      assert.equal(m.context.formData.status, 'archived'); assert.equal(m.context.formData.category_id, 'stored-category');
      assert.equal(m.context.formData.thumbnail_url, 'persisted-cover'); assert.equal(m.context.formData[training ? 'attachments' : 'file_urls'], refs);
      let errors = 0, mutations = 0;
      m.context.toast.error = () => errors++;
      m.context.canSubmitForm = false;
      await m.handler('handleSubmit')({ preventDefault() {} }); assert.equal(errors, 1); assert.equal(m.context.isFormOpen, true);
      m.context.deletingId = 'target';
      const fail = () => ({ unwrap: async () => { mutations++; throw new Error('failed'); } });
      m.context[training ? 'deleteTraining' : 'deleteItem'] = fail;
      await m.handler('handleDelete')(); assert.equal(errors, 2); assert.equal(m.context.deletingId, 'target');
      m.context[training ? 'deleteTraining' : 'deleteItem'] = (id) => ({ unwrap: async () => { assert.equal(id, 'target'); mutations++; } });
      await m.handler('handleDelete')(); assert.equal(m.context.deletingId, null); assert.equal(mutations, 2);
    });
  }
}
