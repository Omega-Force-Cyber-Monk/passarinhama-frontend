import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('src/pages/AdminPanel.tsx');
const ast = ts.createSourceFile('AdminPanel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const admin = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'AdminPanel');
const declarations = [...ast.statements, ...admin.body.statements];
const initializer = (name, statements = declarations) => {
  for (const statement of statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find((item) => item.name.getText() === name);
    if (declaration) return declaration.initializer.getText();
  }
  throw new Error(`Missing declaration: ${name}`);
};
function evaluate(code, context = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(code, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require, URLSearchParams, ...context });
  return module.exports;
}
const { AdminPasswordField } = evaluate(read('src/pages/admin/AdminPasswordField.tsx'));
const { buildAdminForumCreatePayload, isUndisplayedAdminStatus } = evaluate(read('src/pages/admin/adminPresentation.ts'));
const passwordProps = { value: 'example-password', onChange() {}, onToggle() {}, visible: false,
  label: 'Password', showLabel: 'Show password', hideLabel: 'Hide password' };
const passwordParts = (element) => element.props.children[1].props.children;

test('password control preserves validation and toggles accessibly without submitting', () => {
  let visible = false;
  let value = passwordProps.value;
  const render = () => AdminPasswordField({ ...passwordProps, value, visible,
    onChange: (next) => { value = next; }, onToggle: () => { visible = !visible; } });
  let [input, button] = passwordParts(render());
  assert.equal(input.props.type, 'password');
  assert.equal(input.props.required, true);
  assert.equal(input.props.minLength, 8);
  assert.equal(input.props.autoComplete, 'new-password');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-label'], 'Show password');
  assert.equal(button.props['aria-controls'], input.props.id);
  button.props.onClick();
  [input, button] = passwordParts(render());
  assert.equal(input.props.type, 'text');
  assert.equal(button.props['aria-label'], 'Hide password');
  assert.equal(button.props['aria-pressed'], true);
  assert.equal(input.props.value, passwordProps.value);
  input.props.onChange({ target: { value: 'updated-password' } });
  assert.equal(value, 'updated-password');
  button.props.onClick();
  assert.equal(passwordParts(render())[0].props.type, 'password');
  const markup = renderToStaticMarkup(React.createElement(AdminPasswordField, passwordProps));
  assert.match(markup, /type="password"/);
  assert.match(markup, /aria-label="Show password"/);
  assert.match(markup, /for="admin-member-password"/);
});

function modalHarness(activeTab = 'members', allowed = true) {
  const state = { visible: true, open: false, form: null };
  const context = { activeTab, canAccessAdminPanel: allowed, canModify: () => allowed,
    editorDraft: {current:null}, setHasDraftConflict() {},
    ROLE_SLUGS: { MEMBER: 'member' }, userRolesData: [{ slug: 'member', id: 'role' }],
    technicoproCategories: [], trainingCategories: [], eventCategories: [],
    setSelectedFiles() {}, setRemovedFileUrls() {}, setViewingId() {}, setEditingItem() {},
    setFormData: (data) => { state.form = data; },
    setShowMemberPassword: (value) => { state.visible = value; },
    setIsModalOpen: (value) => { state.open = value; } };
  for (const entity of ['Members', 'Forums', 'Articles', 'TechnicoPro', 'Events', 'Trainings']) {
    context[`canCreate${entity}`] = allowed;
    context[`canEdit${entity}`] = allowed;
  }
  return { state, open: evaluate(`module.exports = ${initializer('handleOpenModal')}`, context) };
}
test('actual modal opener hides passwords every time, resets values, and respects permission gates', () => {
  const { state, open } = modalHarness();
  open();
  assert.equal(state.open, true);
  assert.equal(state.visible, false);
  assert.equal(state.form.password, '');
  assert.equal(state.form.status, 'pending'); // Preserve the original creation default.
  state.visible = true;
  state.form.password = 'previous-password';
  open();
  assert.equal(state.visible, false);
  assert.equal(state.form.password, '');
  const denied = modalHarness('members', false);
  denied.open();
  assert.equal(denied.state.open, false);
});

test('new forum payload and existing API serializer always use forum_type general', () => {
  const thumbnail = { name: 'cover.png' };
  const fields = { name: 'Forum', author_name: 'Author', description: 'Description', thumbnail, forum_type: 'commission' };
  const payload = buildAdminForumCreatePayload(fields);
  assert.equal(payload.forum_type, 'general');
  assert.equal(payload.name, fields.name);
  assert.equal(payload.author_name, fields.author_name);
  assert.equal(payload.description, fields.description);
  assert.equal(payload.thumbnail, thumbnail);
  assert.equal(fields.forum_type, 'commission');
  const apiSource = read('src/redux/features/forum/forumApi.ts');
  const apiAst = ts.createSourceFile('forumApi.ts', apiSource, ts.ScriptTarget.Latest, true);
  const serializer = evaluate(['trimOrUndefined', 'appendForumField', 'buildForumSearchParams']
    .map((name) => `const ${name} = ${initializer(name, apiAst.statements)};`).join('\n') + '\nmodule.exports = buildForumSearchParams;');
  assert.equal(serializer(payload).get('forum_type'), 'general');
  assert.match(initializer('handleSubmit'), /createForum\(buildAdminForumCreatePayload\(/);
  assert.doesNotMatch(source, /label=\{translate\("adminPanelPage\.form\.forumType"\)\}/);
  assert.doesNotMatch(initializer('handleSubmit'), /"forum_type"/); // Edits retain stored types.
});

test('pending status presentation is neutral and never changes stored values', () => {
  const record = { status: 'pending' };
  for (const name of ['getMemberStatusLabel', 'getArticleStatusLabel', 'getTrainingStatusLabel', 'getModerationStatusLabel']) {
    const label = evaluate(`module.exports = ${initializer(name)}`, {
      translate: (key) => key === 'adminUi.neutralStatus' ? '\u2014' : key, isUndisplayedAdminStatus,
    });
    assert.equal(label(record.status), '\u2014');
    assert.equal(label('PENDING'), '\u2014');
    assert.notEqual(label('active'), '\u2014');
  }
  assert.equal(record.status, 'pending');
  assert.doesNotMatch(source, /<option value="pending"|\.pendingCount|Statuses\.pending|\.approveMember/);
  const select = evaluate(`module.exports = ${initializer('SelectField')}`, {
    React,
    useI18n: () => ({ translate: (key) => key === 'adminUi.neutralStatus' ? '\u2014' : key }),
  });
  let changed = false;
  const props = { label: 'Status', value: record.status, options: ['active', 'suspended'], onChange: () => { changed = true; } };
  const html = renderToStaticMarkup(React.createElement(select, props));
  assert.match(html, /<option value="pending" disabled="" selected="">\u2014<\/option>/);
  assert.equal(changed, false);
});

test('member and role permission editors are restored while unrelated permission editors remain absent', () => {
  assert.match(source, /<AdminPermissionsEditor[^>]*kind="role"[^>]*canManage=\{canManageRolesPermissions\}/);
  assert.match(source, /<AdminPermissionsEditor[^>]*kind="member"[^>]*canManage=\{canEditMembers\}/);
  assert.match(source, /canEditMembers && <button[^\n]*setPermissionMember\(member\)/);
  assert.doesNotMatch(source, /handleSetForumPermission|handleSetTrainingPermission|setIsPermissionModalOpen/);
  for (const name of ['handleSaveRole', 'handleEditRole', 'handleDeleteRole']) assert.ok(initializer(name));
  assert.match(source, /if \(!canAccessAdminPanel\)/);
  assert.match(source, /hasPermission\("user", "edit"\)/);
  assert.match(source, /canModify\(article, "edit"\)/);
});

test('member/forum required-field checks remain before API calls', () => {
  const submit = initializer('handleSubmit');
  for (const field of ['first_name', 'last_name', 'email', 'password', 'role_id', 'name']) {
    assert.match(submit, new RegExp(`if \\([^)]*formData\\.${field}`));
  }
  assert.match(submit, /password: formData\.password/);
  assert.match(submit, /notifyRequiredField/);
  assert.ok(submit.indexOf('formData.name?.trim()') < submit.indexOf('createForum('));
});

test('layout has container queries and local table/log overflow boundaries', () => {
  const css = read('src/pages/AdminPanel.css');
  assert.match(css, /@container admin-content/);
  assert.match(css, /@container admin-dialog/);
  assert.match(css, /\.admin-log-output\s*\{[^}]*overflow-x: auto/);
  assert.match(css, /\.admin-log-line\s*\{[^}]*white-space: pre/);
  assert.match(source, /admin-table-scroll[^\n]+overflow-x-auto/);
  assert.match(source, /admin-pagination/);
  assert.doesNotMatch(source, /opacity-20 transition-opacity group-hover:opacity-100/);
});
