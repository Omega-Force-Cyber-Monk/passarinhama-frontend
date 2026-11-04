import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const files = ['src/pages/MemberDirectory.tsx', 'src/pages/AdminPanel.tsx'];
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const printer = ts.createPrinter({ removeComments: true });
const print = (n, sf) => printer.printNode(ts.EmitHint.Unspecified, n, sf).replace(/\s+/g, ' ').trim();
function find(root, predicate) { const result = []; function visit(n) { if (predicate(n)) result.push(n); ts.forEachChild(n, visit); } visit(root); return result; }
const opening = (n) => ts.isJsxElement(n) ? n.openingElement : n;
const elements = (root, name) => find(root, (n) => (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && opening(n).tagName.getText() === name);
const attrs = (n, sf, skip = []) => Object.fromEntries(opening(n).attributes.properties.filter((p) => ts.isJsxAttribute(p) && !skip.includes(p.name.text)).map((p) => [p.name.text, p.initializer ? print(p.initializer, sf) : true]));
function inspect(file) { const source = read(file), sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); return { source, sf, modals: elements(sf, 'Modal') }; }

{
  function evaluate(expression, context) {
    runInNewContext(ts.transpileModule(`result = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
    return context.result;
  }
  const plain = (value) => JSON.parse(JSON.stringify(value));
  function model(file) {
    const { sf, modals } = inspect(file), admin = file.includes('AdminPanel');
    const c = {
      React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment' }, File,
      isSuperuser: true, canAccessAdminPanel: true, adminFieldId: ':admin-model:', translate: (key) => key, useI18n: () => ({ translate: (key) => key }), calls: [], notices: [], activeTab: 'members',
      getTabLabel: (tab) => tab, getRoleDisplayName: (role) => role.name, canModify: () => true, canCreateArticles: true,
      isModalOpen: true, isRoleModalOpen: true, isSaving: false, editingMember: null, editingItem: null, editingRole: null, showPassword: false, showMemberPassword: false,
      avatarPreviewUrl: 'https://files.example/avatar.png', userRoles: [{ id: 'role', name: 'Role' }], userRolesData: [{ id: 'role', name: 'Role', slug: 'member' }],
      articleCategories: [{ id: 'article-cat', name: 'Article category' }], technicoproCategories: [{ id: 'tech-cat', name: 'Technical category' }], trainingCategories: [{ id: 'training-cat', name: 'Training category' }], eventCategories: [{ id: 'event-cat', name: 'Event category' }],
      formData: { first_name: 'First', last_name: 'Last', email: 'member@example.test', password: 'password8', role_id: 'role', status: 'pending', phone: '', mobile: '', city: '', society: '', department: '', address: '', is_payment_validated: true, is_superuser: false, avatar: null, avatar_url: 'https://files.example/avatar.png', title: 'Title', name: 'Forum', excerpt: 'Excerpt', body: '<p>Body</p>', description: '<p>Description</p>', category_id: 'category', thumbnail: null, thumbnail_url: 'https://files.example/cover.png', structured_fields: { file_urls: [] }, attachments: [], event_date: '2026-10-18', end_date: '2026-10-19', event_time: '14:00', event_category_id: 'event-cat', max_attendees: 5, location: 'Location', is_public: false },
      selectedFiles: [], removedFileUrls: [], newRoleData: { name: ' Role ', description: ' Description ' },
      handleImageUpload() {}, handleRetryDetails() {}, defaultMemberRoleId: 'role', canCreateUser: true, canEditUser: true,
      MEMBER_STATUSES: ['active', 'pending', 'suspended'], ROLE_SLUGS: { MEMBER: 'member' },
      getLastPathSegment: (url) => url.split('/').pop(),
      notify: (...args) => c.notices.push(args), notifySuccess: () => c.notices.push('success'), notifyError: (...args) => c.notices.push(args), notifyRequiredField: (...args) => c.notices.push(args),
      getApiErrorDisplayMessage: () => 'error', hasRichTextValue: (value) => !!value?.replace(/<[^>]*>/g, '').trim(),
      isDetailsOpen: true, isDetailsLoading: false, isDetailsError: false, viewingItem: null, detailsItem: null,
      getRoleLabel: (role) => role, getMemberStatusLabel: (status) => status, formatLocalizedDate: (value) => value || '-', formatLocalizedDateTime: (value) => value || '-',
      isUndisplayedAdminStatus: (status) => status === 'pending', isImageUrl: (url) => /\.png$/.test(url),
    };
    for (const name of ['Member', 'Forum', 'Article', 'TechnicoPro', 'Event', 'Training', 'UserRole']) for (const operation of ['Creating', 'Updating', 'Deleting']) c[`is${operation}${name}`] = false;
    for (const name of ['isErrorArticle', 'isFetchingArticle', 'isArchivingUser', 'isRestoringUser', 'isDeletingBackup', 'isModerating']) c[name] = false;
    for (const entity of ['Members', 'Forums', 'Articles', 'TechnicoPro', 'Events', 'Trainings']) for (const permission of ['Create', 'Edit']) c[`can${permission}${entity}`] = true;
    for (const n of find(sf, (n) => ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))) { const name = n.tagName.getText(sf); if (/^[A-Z]\w*$/.test(name)) c[name] = name; }
    for (const state of ['formData', 'isModalOpen', 'showPassword', 'showMemberPassword', 'editingMember', 'editingItem', 'selectedFiles', 'removedFileUrls', 'newRoleData', 'editingRole', 'isRoleModalOpen', 'selectedRoleId', 'memberActionTarget', 'isConfirmOpen', 'deletingId', 'memberDeleteMode', 'backupToDelete', 'isModConfirmOpen', 'pendingModAction', 'isDetailsOpen', 'viewingId']) {
      c[`set${state[0].toUpperCase()}${state.slice(1)}`] = (value) => { c[state] = typeof value === 'function' ? value(c[state]) : value; };
    }
    function handler(name) { const n = find(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === name)[0]; assert.ok(n, name); return evaluate(n.initializer.getText(sf), c); }
    if (!admin) { c.emptyMemberForm = handler('emptyMemberForm'); c.isMemberStatus = handler('isMemberStatus'); c.trimOrUndefined = handler('trimOrUndefined'); c.buildFormData = handler('buildFormData'); c.handleCloseModal = handler('handleCloseModal'); }
    c.handleSubmit = handler('handleSubmit'); c.handleSaveRole = admin ? handler('handleSaveRole') : undefined;
    return { c, sf, modals, handler, render: (index) => evaluate(modals[index].getText(sf), c) };
  }
  function all(tree, type) {
    const result = []; function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (!n?.props) return; if (n.type === type) result.push(n); visit(n.props.children); visit(n.props.footer); visit(n.props.preview); visit(n.props.value); } visit(tree); return result;
  }

  test('Directory password visibility, edit-only email disablement, tel inputs, statuses and footer association remain distinct', () => {
    const m = model(files[0]), c = m.c; let tree = m.render(0);
    assert.equal(tree.props.layout, 'compact'); assert.equal(all(tree, 'ModalSection').length, 4);
    assert.equal(all(tree, 'form')[0].props.id, all(tree, 'ModalSubmitButton')[0].props.formId);
    const byId = (id) => all(m.render(0), 'input').find((n) => n.props.id === id);
    assert.equal(byId('member-password').props.type, 'password'); assert.equal(byId('member-password').props.minLength, 8); assert.equal(byId('member-password').props.autoComplete, 'new-password');
    all(tree, 'button').find((n) => n.props['aria-controls'] === 'member-password').props.onClick(); assert.equal(byId('member-password').props.type, 'text');
    assert.equal(byId('member-phone').props.type, 'tel'); assert.equal(byId('member-mobile').props.type, 'tel');
    c.editingMember = { id: 'member', avatar_url: 'persisted.png' }; assert.equal(byId('member-password'), undefined); assert.equal(byId('member-email').props.disabled, true);
    const statuses = all(m.render(0), 'select').find((n) => n.props.id === 'member-status'); assert.deepEqual(all(statuses, 'option').map((n) => n.props.value), ['active', 'pending', 'suspended']);
    c.showPassword = true; c.formData.password = 'old-password'; c.handleCloseModal(); assert.equal(c.showPassword, false); assert.equal(c.formData.password, '');
    m.handler('handleOpenModal')(); assert.equal(c.showPassword, false); assert.equal(c.formData.role_id, 'role');
  });

  test('all six Admin branches retain independent fields, options, types, media and appropriate shared layout', () => {
    const m = model(files[1]), c = m.c;
    for (const tab of ['members', 'forums', 'articles', 'technicopro', 'events', 'trainings']) {
      c.activeTab = tab; const tree = m.render(1), textFields = all(tree, 'FormField'), selects = all(tree, 'SelectField');
      assert.equal(tree.props.layout, ['articles', 'technicopro', 'trainings'].includes(tab) ? 'sectioned' : 'compact');
      assert.equal(all(tree, 'form')[0].props.id, all(tree, 'ModalSubmitButton')[0].props.formId);
      if (tab === 'members') {
        assert.equal(all(tree, 'AdminPasswordField').length, 1); assert.equal(textFields.find((n) => n.props.label.endsWith('phoneOptional')).props.type, undefined);
        assert.deepEqual(plain(selects.find((n) => n.props.label.endsWith('.status')).props.options).map((o) => o.value), ['active', 'suspended']);
        c.editingItem = { id: 'editing' }; assert.equal(all(m.render(1), 'AdminPasswordField').length, 0); c.editingItem = null;
      }
      if (tab === 'forums') { assert.equal(textFields.length, 2); assert.equal(selects.length, 0); }
      if (tab === 'articles' || tab === 'technicopro') {
        assert.equal(selects.length, 1); assert.equal(textFields.find((n) => n.props.label.endsWith('.excerpt')).props.type, undefined);
        assert.equal(selects[0].props.options[0].value, tab === 'articles' ? 'article-cat' : 'tech-cat');
      }
      if (tab === 'events') {
        const dates = all(tree, 'BeautifulDateTimePicker'); dates[0].props.onChange('2026-11-01'); assert.equal(c.formData.end_date, '2026-10-19');
        assert.equal(dates[1].props.minDate, undefined); assert.equal(textFields.find((n) => n.props.label.endsWith('.maxAttendees')).props.type, 'number');
      }
      if (tab === 'trainings') {
        assert.deepEqual(plain(selects.find((n) => n.props.label.endsWith('.statusOptional')).props.options).map((o) => o.value), ['draft', 'published']);
        assert.equal(textFields.find((n) => n.props.label.endsWith('.excerpt')).props.required, false);
      }
      for (const n of [...all(tree, 'FilePreviewCard'), ...all(tree, 'FileUploadDropzone')]) assert.equal(n.props.presentation, 'compact');
    }
  });

  test('avatars and thumbnails retain original Files, existing URLs, acceptance and conditional local removal', () => {
    for (const file of files) {
      const m = model(file), c = m.c, admin = file.includes('AdminPanel');
      for (const tab of admin ? ['members', 'forums', 'articles', 'technicopro', 'trainings'] : ['members']) {
        c.activeTab = tab; let tree = m.render(admin ? 1 : 0); const drop = all(tree, 'FileUploadDropzone')[0];
        assert.equal(drop.props.accept, 'image/*'); assert.equal(drop.props.multiple, false);
        const existing = all(tree, 'FilePreviewCard')[0]; assert.equal(existing.props.onRemove, undefined);
        const image = new File(['image'], 'new.png', { type: 'image/png' }); drop.props.onFilesSelected([image]);
        tree = m.render(admin ? 1 : 0); const local = all(tree, 'FilePreviewCard')[0]; assert.equal(local.props.file, image); assert.equal(local.props.name, image.name);
        local.props.onRemove(); assert.equal(c.formData[tab === 'members' ? 'avatar' : 'thumbnail'], null);
        assert.equal(c.formData.thumbnail_url, 'https://files.example/cover.png'); assert.equal(c.formData.avatar_url, 'https://files.example/avatar.png');
      }
    }
  });

  test('Admin existing-file removal/restoration and local helper append/index-removal preserve references', () => {
    const m = model(files[1]), c = m.c;
    for (const tab of ['articles', 'technicopro', 'events', 'trainings']) {
      c.activeTab = tab; c.editingItem = { id: 'editing' }; c.articleDetail = c.editingItem; c.formData.structured_fields.file_urls = ['one.pdf', 'two.png']; c.formData.attachments = ['one.pdf', 'two.png']; c.removedFileUrls = [];
      let tree = m.render(1); const cards = all(tree, 'FilePreviewCard').filter((n) => n.props.href); assert.equal(cards.length, 2); assert.equal(cards[1].props.url, 'two.png');
      all(tree, 'button').find((n) => n.props.onClick?.toString().includes('setRemovedFileUrls')).props.onClick(); assert.deepEqual(plain(c.removedFileUrls), ['one.pdf']);
      tree = m.render(1); all(tree, 'button').find((n) => n.props.onClick?.toString().includes('setRemovedFileUrls')).props.onClick(); assert.equal(c.removedFileUrls.length, 0);
      assert.equal(c.formData.structured_fields.file_urls.length, 2); assert.equal(c.formData.attachments.length, 2);
    }
    const helper = m.handler('FileDropzone'), a = new File(['a'], 'a.pdf'), b = new File(['b'], 'b.pdf'); let selected = [a];
    const render = () => helper({ files: selected, onFilesChange: (next) => { selected = next; } });
    all(render(), 'FileUploadDropzone')[0].props.onFilesSelected([b]); assert.equal(selected[0], a); assert.equal(selected[1], b);
    const list = all(render(), 'SelectedFilesPreview')[0]; assert.equal(list.props.presentation, 'compact'); list.props.onRemove(0); assert.equal(selected.length, 1); assert.equal(selected[0], b);
  });

  test('Directory create/edit payloads preserve password/email policy, payment mappings and avatar identity', async () => {
    for (const editing of [false, true]) {
      const m = model(files[0]), c = m.c, calls = [], avatar = new File(['avatar'], 'avatar.png');
      c.editingMember = editing ? { id: 'editing' } : null; c.formData.avatar = avatar;
      c.createUser = (payload) => ({ unwrap: async () => calls.push(['create', payload]) }); c.updateUser = (payload) => ({ unwrap: async () => calls.push(['edit', payload]) });
      await c.handleSubmit({ preventDefault() {} }); assert.equal(calls.length, 1);
      const payload = editing ? calls[0][1].body : calls[0][1]; assert.equal(payload.avatar, avatar); assert.equal(payload.payment_validated, true); assert.equal(payload.status, 'pending');
      if (editing) { assert.equal('email' in payload, false); assert.equal('password' in payload, false); assert.equal(payload.is_payment_validated, true); }
      else assert.equal(payload.password, 'password8');
      assert.equal(c.showPassword, false); assert.equal(c.formData.password, '');
    }
  });

  test('Admin submits all six entities through their original request mappings and guards', async () => {
    for (const tab of ['members', 'forums', 'articles', 'technicopro', 'events', 'trainings']) for (const editing of [false, true]) {
      const m = model(files[1]), c = m.c, calls = [], selected = new File(['file'], 'file.pdf');
      c.activeTab = tab; c.selectedFiles = [selected]; c.removedFileUrls = ['old.pdf']; c.formData.structured_fields.file_urls = ['old.pdf', 'retained.pdf'];
      c.editingItem = editing ? { id: 'editing', first_name: 'Old', forum_type: 'professionnel' } : null; c.articleDetail = c.editingItem;
      for (const name of ['createUser', 'updateUser', 'createForum', 'updateForum', 'createArticle', 'updateArticle', 'createTechnicoPro', 'updateTechnicoPro', 'createEvent', 'updateEvent', 'createTraining', 'updateTraining']) c[name] = (payload) => ({ unwrap: async () => calls.push([name, payload]) });
      c.buildAdminForumCreatePayload = (fields) => ({ ...fields, forum_type: 'general' });
      c.buildTrainingFormData = (body) => ({ originalTrainingRequest: body });
      await c.handleSubmit({ preventDefault() {} }); assert.equal(calls.length, 1, `${tab}/${editing}`);
      const name = { members: 'User', forums: 'Forum', articles: 'Article', technicopro: 'TechnicoPro', events: 'Event', trainings: 'Training' }[tab];
      assert.equal(calls[0][0], `${editing ? 'update' : 'create'}${name}`);
      const raw = calls[0][1], payload = editing && ['articles', 'technicopro', 'events'].includes(tab) ? raw.data : raw;
      if (tab === 'forums') assert.equal(editing ? 'forum_type' in payload : payload.forum_type === 'general', editing ? false : true);
      if (tab === 'articles' || tab === 'technicopro') { assert.equal(payload.files[0], selected); if (editing) { assert.deepEqual(plain(payload.structured_fields.file_urls), ['retained.pdf']); assert.equal(payload.remove_file_urls, 'old.pdf'); } }
      if (tab === 'events') { assert.equal(payload[editing ? 'new_attachments' : 'attachments'][0], selected); if (editing) assert.deepEqual(plain(payload.remove_attachment_urls), ['old.pdf']); }
      if (tab === 'trainings') { const request = (editing ? raw.formData : raw).originalTrainingRequest; assert.equal(request[editing ? 'new_attachments' : 'attachments'][0], selected); assert.equal(request.status, 'pending'); }
      assert.equal(c.showMemberPassword, false); assert.equal(c.isModalOpen, false);
    }
    const m = model(files[1]); m.c.activeTab = 'articles'; m.c.canCreateArticles = false; await m.c.handleSubmit({ preventDefault() {} }); assert.equal(m.c.isModalOpen, true);
  });

  test('Admin role CRUD, Directory restore/delete and Admin archive/restore/hard-delete keep their distinct actions', async () => {
    const admin = model(files[1]), c = admin.c, calls = [];
    c.createUserRole = (payload) => ({ unwrap: async () => { calls.push(plain(payload)); return { id: 'new-role' }; } });
    await c.handleSaveRole({ preventDefault() {} }); assert.deepEqual(calls[0], { name: 'Role', description: 'Description' }); assert.equal(c.selectedRoleId, 'new-role');
    for (const mode of ['archive', 'restore', 'hard']) {
      c.activeTab = 'members'; c.deletingId = 'member'; c.memberDeleteMode = mode;
      for (const name of ['softDeleteUser', 'restoreUser', 'deleteUser']) c[name] = (id) => ({ unwrap: async () => calls.push([name, id]) });
      await admin.handler('handleDelete')(); assert.deepEqual(calls.at(-1), [{ archive: 'softDeleteUser', restore: 'restoreUser', hard: 'deleteUser' }[mode], 'member']);
    }
    const directory = model(files[0]); for (const status of ['active', 'suspended']) {
      directory.c.memberActionTarget = { id: 'member', status };
      directory.c.deleteUser = (id) => ({ unwrap: async () => calls.push(['delete', id]) }); directory.c.restoreUser = (id) => ({ unwrap: async () => calls.push(['restore', id]) });
      await directory.handler('handleMemberAction')(); assert.deepEqual(calls.at(-1), [status === 'suspended' ? 'restore' : 'delete', 'member']);
    }
  });

  test('Admin details drawer preserves all member information, generic resources and conditional error/retry actions', () => {
    const m = model(files[1]), c = m.c;
    c.viewingItem = c.detailsItem = { first_name: 'Name', last_name: 'Member', email: 'member@example.test', status: 'pending', role: 'member', membership_category: { name: 'Category' }, phone: 'PHONE', mobile: 'MOBILE', society: 'SOCIETY', department: 'DEPARTMENT', company_name: 'COMPANY', company_role: 'COMPANY_ROLE', company_website: 'https://company.example', company_siret: 'SIRET', country: 'COUNTRY', postal_code: 'POSTCODE' };
    let tree = m.render(2); assert.equal(tree.props.layout, 'drawer'); const serialized = JSON.stringify(tree);
    for (const value of ['PHONE', 'MOBILE', 'SOCIETY', 'DEPARTMENT', 'COMPANY_ROLE', 'SIRET', 'COUNTRY', 'POSTCODE']) assert.ok(serialized.includes(value));
    assert.ok(all(tree, 'DetailField').length >= 20); assert.ok(all(tree, 'a').some((n) => n.props.href === 'https://company.example'));
    c.activeTab = 'articles'; c.viewingItem = c.detailsItem = { title: 'Title', body: '<p>Body</p>', structured_fields: { file_urls: ['https://files.example/reference.pdf'] } };
    tree = m.render(2); assert.ok(all(tree, 'a').some((n) => n.props.href === 'https://files.example/reference.pdf'));
    c.isDetailsError = true; tree = m.render(2); assert.equal(all(tree.props.footer, 'button').length, 2); assert.equal(all(tree, 'DetailField').length, 0);
    c.isDetailsLoading = true; assert.equal(m.render(2).props.footer, undefined);
    for (const file of files) { const { sf } = inspect(file); for (const n of elements(sf, 'ConfirmModal')) assert.equal(attrs(n, sf).presentation, '"compact"'); }
  });
}
