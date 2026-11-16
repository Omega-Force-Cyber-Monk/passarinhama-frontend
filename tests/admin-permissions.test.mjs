import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const parse = (file) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(root, predicate) {
  const result = [];
  function visit(node) { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }
  visit(root); return result;
}
function evaluate(code, context) {
  runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
}
const sf = parse('src/pages/admin/AdminPermissionsEditor.tsx');
const component = sf.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'AdminPermissionsEditor');
const permissionSource = parse('src/redux/features/auth/permissionUtils.ts');
const policyCode = permissionSource.statements.filter((n) => !ts.isImportDeclaration(n)).map((n) => n.getText(permissionSource).replace(/\bexport /g, '')).join('\n');
const en = JSON.parse(read('src/i18n/locales/en.json'));
function harness(kind, { permissions = [], allowed = true, fetching = false, failedQuery = false, targetId = 'target', mutationError, deferred, profileFetching = false, profileError = false, profileId = targetId } = {}) {
  const state = [], calls = [], notices = [], queries = [], busy = [];
  let cursor = 0;
  const query = { currentData: permissions, isFetching: fetching, isError: failedQuery, error: new Error('load failed'), refetch: () => ({ unwrap: async () => { calls.push(['refetch']); return query.currentData; } }) };
  const profileQuery = { currentData: { id: profileId, status: 'active', is_deleted: false, is_superuser: false, permissions: [{feature: 'article', can_view: true, can_create: false, can_edit: false, can_delete: false}], user_permissions: [] }, isFetching: profileFetching, isError: profileError, error: profileError ? new Error('profile failed') : undefined, refetch() {} };
  const mutation = (name) => () => [(payload) => ({ unwrap: async () => {
    calls.push([name, payload]);
    if (mutationError) throw mutationError;
    if (deferred) await deferred;
    if (name.startsWith('create')) query.currentData = [...query.currentData, { id: 'created', ...payload }];
    else query.currentData = query.currentData.map((row) => row.id === payload.id ? { ...row, ...payload } : row);
    return payload;
  } })];
  const context = {
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
    useI18n: () => ({ translate: (key, variables = {}) => {
      const value = key.split('.').reduce((object, part) => object?.[part], en);
      assert.equal(typeof value, 'string', `Missing translation ${key}`); return Object.entries(variables).reduce((text, [name, replacement]) => text.replace(`{${name}}`, replacement), value);
    } }),
    useAppToast: () => ({ success: (message) => notices.push(['success', message]), error: (message) => notices.push(['error', message]) }),
    getApiErrorDisplayMessage: (error) => error.message,
    useGetUserPermissionsQuery: (args, options) => { queries.push(['role', args, options]); return query; },
    useGetMemberPermissionsQuery: (args, options) => { queries.push(['member', args, options]); return query; },
    useGetUserByIdQuery: () => profileQuery,
    useCreateUserPermissionMutation: mutation('createRole'), useUpdateUserPermissionMutation: mutation('updateRole'),
    useCreateMemberPermissionMutation: mutation('createMember'), useUpdateMemberPermissionMutation: mutation('updateMember'),
  };
  evaluate(policyCode + '\n' + component.getText(sf).replace('export ', '') + '\nresult = AdminPermissionsEditor;', context);
  return { calls, notices, queries, busy, query, render() { cursor = 0; return context.result({ kind, targetId, canManage: allowed, onBusyChange: (value) => busy.push(value) }); } };
}
function all(tree, type) {
  const result = [];
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; if (node.type === type) result.push(node); visit(node.props.children); }
  visit(tree); return result;
}
const row = (tree) => all(tree, 'fieldset')[0];
const toggle = (tree, index, checked) => {
  const input = all(row(tree), 'input')[index];
  if (input) input.props.onChange({ target: { checked } });
  else all(row(tree), 'select')[index].props.onChange({ target: { value: String(checked) } });
};
const save = (tree) => all(row(tree), 'button')[0].props.onClick();
const flush = () => new Promise((resolve) => setImmediate(resolve));
const plain = (value) => JSON.parse(JSON.stringify(value));

for (const kind of ['role', 'member']) {
  test(`${kind}: loads only its target endpoint; renders all seven features and four labelled actions`, () => {
    const h = harness(kind), tree = h.render();
    assert.equal(all(tree, 'fieldset').length, 7); assert.equal(all(tree, kind === 'role' ? 'input' : 'select').length, 28);
    assert.equal(all(tree, 'label').length, 28); assert.ok(all(tree, 'input').every((n) => n.props.type === 'checkbox' && !n.props.checked));
    if (kind === 'member') assert.ok(all(tree, 'select').every((n) => n.props.value === 'inherit'));
    assert.equal(h.queries.find(([name]) => name === kind)[2].skip, false);
    assert.equal(h.queries.find(([name]) => name !== kind)[2].skip, true);
    assert.ok(all(tree, 'button').every((button) => button.props.type === 'button' && button.props.disabled));
  });

  test(`${kind}: missing row ${kind === 'role' ? 'creates the correct target permission' : 'preserves inheritance and blocks unsafe creation'}`, async () => {
    const h = harness(kind); let tree = h.render(); toggle(tree, 0, true); tree = h.render();
    if (kind === 'member') {
      assert.equal(all(row(tree), 'button')[0].props.disabled, true); save(tree); await flush();
      assert.equal(h.calls.length, 0); assert.match(JSON.stringify(tree), /Inherited: Allow/);
      assert.match(JSON.stringify(tree), /cannot be saved safely/); return;
    }
    assert.equal(all(row(tree), 'button')[0].props.disabled, false); save(tree); await flush();
    const owner = kind === 'role' ? { role_id: 'target' } : { user_id: 'target' };
    assert.deepEqual(plain(h.calls), [[kind === 'role' ? 'createRole' : 'createMember', { ...owner, feature: 'article', can_view: true, can_create: false, can_edit: false, can_delete: false }]]);
    assert.deepEqual(h.busy, [true, false]); assert.equal(h.notices[0][0], 'success');
    assert.equal(all(row(h.render()), 'input')[0].props.checked, true);
    assert.equal(all(row(h.render()), 'button')[0].props.disabled, true);
  });

  test(`${kind}: existing row PATCH sends only changed capabilities and the target ID`, async () => {
    const permissions = [{ id: 'permission', feature: 'article', can_view: true, can_create: true, can_edit: false, can_delete: true }];
    const h = harness(kind, { permissions }); let tree = h.render(); toggle(tree, 2, true); tree = h.render(); save(tree); await flush();
    assert.deepEqual(plain(h.calls[0]), [kind === 'role' ? 'updateRole' : 'updateMember', { id: 'permission', [kind === 'role' ? 'role_id' : 'user_id']: 'target', can_edit: true }]);
    assert.equal(permissions[0].can_edit, false);
  });

  test(`${kind}: editing one action preserves null inheritance and omitted actions`, async () => {
    const h = harness(kind, { permissions: [{ id: 'permission', feature: 'article', can_view: null, can_create: true, can_delete: false }] });
    let tree = h.render(); toggle(tree, 3, true); tree = h.render(); save(tree); await flush();
    assert.deepEqual(plain(h.calls[0][1]), { id: 'permission', [kind === 'role' ? 'role_id' : 'user_id']: 'target', can_delete: true });
    assert.equal(h.query.currentData[0].can_view, null);
    assert.equal(h.query.currentData[0].can_edit, undefined);
    assert.equal(h.query.currentData[0].can_create, true);
  });

  test(`${kind}: reverting all edits makes even a direct save handler a no-op`, async () => {
    const h = harness(kind, { permissions: [{ id: 'permission', feature: 'article', can_view: true }] });
    let tree = h.render(); toggle(tree, 0, false); tree = h.render(); toggle(tree, 0, true); tree = h.render();
    assert.equal(all(row(tree), 'button')[0].props.disabled, true);
    save(tree); await flush(); assert.equal(h.calls.length, 0);
  });
}

test('failed saves preserve drafts and expose the original error without a success notification', async () => {
  const h = harness('member', { permissions: [{id: 'row', feature: 'article', can_delete: false}], mutationError: new Error('Forbidden') }); let tree = h.render(); toggle(tree, 3, true); tree = h.render(); save(tree); await flush();
  assert.equal(all(row(h.render()), 'select')[3].props.value, 'true');
  assert.deepEqual(h.notices, [['error', 'Forbidden']]); assert.deepEqual(h.busy, [true, false]); assert.equal(h.calls.length, 1);
});

test('saving synchronously blocks duplicate submissions and disables toggles until completion', async () => {
  let resolve; const deferred = new Promise((done) => { resolve = done; });
  const h = harness('role', { deferred }); let tree = h.render(); toggle(tree, 0, true); tree = h.render(); save(tree); save(tree);
  assert.equal(h.calls.length, 1); assert.ok(all(h.render(), 'fieldset').every((n) => n.props.disabled));
  resolve(); await flush(); assert.deepEqual(h.busy, [true, false]);
});

test('loading, errors, background fetching and lost authorization never permit writes', () => {
  for (const options of [{ allowed: false }, { targetId: '' }, { permissions: undefined }, { failedQuery: true }, { fetching: true }]) {
    const h = harness('member', options);
    if (Object.hasOwn(options, 'permissions')) h.query.currentData = undefined;
    const tree = h.render();
    if (options.allowed === false || options.targetId === '') assert.equal(tree, null);
    else if (options.failedQuery) { assert.equal(tree.props.role, 'alert'); assert.equal(all(tree, 'input').length, 0); }
    else if (Object.hasOwn(options, 'permissions')) assert.equal(tree.props.role, 'status');
    else assert.ok(all(tree, 'fieldset').every((n) => n.props.disabled));
    assert.equal(h.calls.length, 0);
  }
});

test('independent target instances do not share drafts, and null overrides can be explicitly denied', () => {
  const first = harness('member', { targetId: 'first', permissions: [{ id: 'row', feature: 'article', can_view: null }] });
  const second = harness('member', { targetId: 'second' });
  let tree = first.render(); toggle(tree, 0, false); tree = first.render();
  assert.equal(all(row(tree), 'button')[0].props.disabled, false);
  assert.equal(all(row(second.render()), 'button')[0].props.disabled, true);
  const admin = read('src/pages/AdminPanel.tsx');
  assert.match(admin, /AdminPermissionsEditor key=\{selectedRoleId\}/);
  assert.match(admin, /AdminPermissionsEditor key=\{permissionMember.id\}/);
});

test('actual existing endpoints retain POST/PATCH payloads and invalidate permissions plus current profile', () => {
  const api = parse('src/redux/features/members/membersApi.ts');
  for (const [endpoint, kind, method, url] of [
    ['createUserPermission', 'role', 'POST', '/user/permissions'],
    ['updateUserPermission', 'role', 'PATCH', '/user/permissions/permission'],
    ['createMemberPermission', 'member', 'POST', '/user/user-permissions'],
    ['updateMemberPermission', 'member', 'PATCH', '/user/user-permissions/permission'],
  ]) {
    const declaration = find(api, (n) => ts.isPropertyAssignment(n) && n.name.getText(api) === endpoint)[0];
    const context = { builder: { mutation: (options) => options }, mutationChanged: error => !error, projectionTags: [] };
    evaluate(`result = ${declaration.initializer.getText(api)};`, context);
    const args = { id: 'permission', [kind === 'role' ? 'role_id' : 'user_id']: 'target', can_view: true };
    const request = context.result.query(args); assert.equal(request.url, url); assert.equal(request.method, method); assert.equal(request.body.can_view, true);
    if (method === 'PATCH') { assert.equal(request.body.id, undefined); assert.equal(request.body.role_id, undefined); assert.equal(request.body.user_id, undefined); }
    const tags = plain(context.result.invalidatesTags(null, null, args));
    assert.ok(tags.some((tag) => kind === 'role' ? tag.type === 'RoleMembers' && tag.id === 'target' : tag.type === 'User' && tag.id === 'target'));
    assert.ok(tags.some((tag) => tag.id === `${kind === 'role' ? 'PERMISSIONS' : 'USER-PERMISSIONS'}-target`));
  }
});

test('profile permission refresh may revoke Admin access without changing hook order', () => {
  const admin = parse('src/pages/AdminPanel.tsx');
  const fn = admin.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'AdminPanel');
  const guard = fn.body.statements.find((n) => ts.isIfStatement(n) && n.expression.getText(admin) === '!canAccessAdminPanel');
  assert.ok(guard);
  const hooks = find(fn, (n) => ts.isCallExpression(n) && /^(React\.)?use[A-Z]/.test(n.expression.getText(admin)));
  assert.ok(hooks.length > 0); assert.ok(hooks.every((hook) => hook.getStart(admin) < guard.getStart(admin)));
  const selectors = find(fn, (n) => ts.isJsxOpeningElement(n) && n.tagName.getText(admin) === 'button' && n.getText(admin).includes('setSelectedRoleId(role.id)'));
  assert.equal(selectors.length, 1); assert.match(selectors[0].getText(admin), /type="button"/);
});

test('member editor shows inheritance and effective denial/allowance without changing untouched actions', async () => {
  const h = harness('member', {permissions: [{id: 'row', feature: 'article', can_view: null, can_create: null, can_edit: false, can_delete: false}]});
  let tree = h.render();
  assert.equal(all(row(tree), 'select')[0].props.value, 'inherit');
  assert.match(JSON.stringify(all(row(tree), 'label')[0]), /Inherited: Allow.*Effective: Allow/);
  toggle(tree, 0, false); tree = h.render();
  assert.match(JSON.stringify(all(row(tree), 'label')[0]), /Inherited: Allow.*Effective: Deny/);
  toggle(tree, 1, true); tree = h.render();
  assert.match(JSON.stringify(all(row(tree), 'label')[1]), /Inherited: Deny.*Effective: Allow/);
  save(tree); await flush();
  assert.deepEqual(plain(h.calls[0][1]), {id: 'row', user_id: 'target', can_view: false, can_create: true});
  assert.equal(h.query.currentData[0].can_edit, false);
});

test('unsupported persisted reset is disabled; reverting an unsaved inherited action sends no mutation', async () => {
  const h = harness('member', {permissions: [{id: 'row', feature: 'article', can_view: true, can_create: null}]});
  let tree = h.render();
  const select = all(row(tree), 'select')[0];
  assert.equal(all(select, 'option').find(option => option.props.value === 'inherit').props.disabled, true);
  select.props.onChange({target: {value: 'inherit'}}); save(h.render()); await flush();
  assert.equal(h.calls.length, 0);
  toggle(tree, 1, true); tree = h.render();
  all(row(tree), 'select')[1].props.onChange({target: {value: 'inherit'}});
  tree = h.render(); assert.equal(all(row(tree), 'button')[0].props.disabled, true);
  save(tree); await flush(); assert.equal(h.calls.length, 0);
});

test('member profile loading, mismatch, refresh and error fail closed for override saves', async () => {
  for (const extra of [{profileId: null}, {profileId: 'different'}, {profileFetching: true}, {profileError: true}]) {
    const h = harness('member', {permissions: [{id: 'row', feature: 'article', can_view: true}], ...extra});
    const tree = h.render();
    if (extra.profileError) assert.equal(tree.props.role, 'alert');
    else if (extra.profileId === null || extra.profileId === 'different') assert.equal(tree.props.role, 'status');
    else if (extra.profileFetching) {
      assert.ok(all(tree, 'fieldset').every(field => field.props.disabled));
      toggle(tree, 0, false); save(h.render()); await flush();
    }
    assert.equal(h.calls.length, 0);
  }
});
