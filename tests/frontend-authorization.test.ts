import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { UserProfile } from '../src/redux/features/auth/authTypes';
import { PERMISSION_FEATURES, hasPermission, canAccessAdminPanel, canAccessModeration } from '../src/redux/features/auth/permissionUtils';
import { canModifyResource, canReplyToTopic, canCreateInResource, canDeleteFolder, ordinaryAccountPayload } from '../src/redux/features/auth/resourceAuthorization';
import { authorizeRequest } from '../src/redux/features/api/mutationAuthorization';

const user = (action?: string, extra = {}): UserProfile => ({
  id: 'owner', status: 'active', is_deleted: false, is_superuser: false,
  role: 'membre', permissions: PERMISSION_FEATURES.map((feature) => ({
    feature, can_view: action === 'view', can_create: action === 'create', can_edit: action === 'edit', can_delete: action === 'delete',
  })), user_permissions: [], ...extra,
} as UserProfile);
const resource = (feature: string, owner: string | undefined = 'owner') => ({
  id: 'record', ...(feature === 'document' ? { uploaded_by: { id: owner } }
    : ['event', 'training'].includes(feature) ? { created_by: { id: owner } } : { author: { id: owner } }),
});

test('each feature/action requires account eligibility, its independent grant, and ownership for modification', () => {
  for (const feature of PERMISSION_FEATURES) for (const action of ['view', 'create', 'edit', 'delete'] as const) {
    for (const grant of [undefined, 'view', 'create', 'edit', 'delete']) {
      const actor = user(grant), target = resource(feature);
      assert.equal(hasPermission(actor, feature, action), grant === action);
      if (action === 'edit' || action === 'delete') {
        assert.equal(canModifyResource(actor, feature, target, action), grant === action && feature !== 'user');
        assert.equal(canModifyResource(actor, feature, resource(feature, 'other'), action), false);
        assert.equal(canModifyResource(actor, feature, { id: 'record', author_name: 'owner', created_by_id: 'owner' }, action), false);
      }
    }
    for (const actor of [null, user(action, { id: '' }), user(action, { status: 'suspended' }), user(action, { is_deleted: true }), user(action, { is_deleted: undefined })]) {
      assert.equal(hasPermission(actor, feature, action), false);
      assert.equal(canModifyResource(actor, feature, resource(feature), 'edit'), false);
    }
    for (const extra of [{}, { status: 'pending' }, { is_deleted: true }]) {
      const actor = user(undefined, { is_superuser: true, ...extra }), eligible = !Object.keys(extra).length;
      assert.equal(hasPermission(actor, feature, action), eligible);
      assert.equal(canModifyResource(actor, feature, resource(feature, 'other'), 'delete'), eligible);
      assert.equal(canAccessAdminPanel(actor), eligible);
      assert.equal(canAccessModeration(actor), eligible);
    }
    assert.equal(hasPermission(user(action, { user_permissions: [{ feature, [`can_${action}`]: false }] }), feature, action), false);
  }
  assert.equal(canModifyResource(user('edit'), 'article', { ...resource('article'), can_write: false }, 'edit'), false);
  assert.equal(canModifyResource(user('edit'), 'technicopro', { ...resource('technicopro'), author_id: 'other' }, 'edit'), false);
  assert.equal(canAccessModeration(user('edit', { role: 'moderator' })), false);
  assert.equal(canAccessAdminPanel(user('edit', { role: 'admin' })), false);
});

test('reply creation requires create permission, explicit resource posting permission and an unlocked topic', () => {
  for (const grant of [undefined, 'view', 'create', 'edit', 'delete']) for (const posting of [undefined, false, true]) for (const locked of [undefined, true, false]) {
    assert.equal(canReplyToTopic(user(grant), posting, locked), grant === 'create' && posting === true && locked === false);
  }
  assert.equal(canCreateInResource(user('create'), 'document', undefined), false);
  assert.equal(canCreateInResource(user('create'), 'document', false), false);
  assert.equal(canReplyToTopic(user(undefined, { is_superuser: true }), false, true), true);
  assert.equal(canReplyToTopic(user(undefined, { is_superuser: true, status: 'suspended' }), true, false), false);
});

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} } as unknown as Storage;
const { store } = await import('../src/redux/store');
const { setCredentials, setUser, logout, sessionResolved } = await import('../src/redux/features/auth/authSlice');
const { apiSlice } = await import('../src/redux/features/api/apiSlice');
await Promise.all([
  import('../src/redux/features/articles/articlesApi'), import('../src/redux/features/events/eventsApi'),
  import('../src/redux/features/documents/documentsApi'), import('../src/redux/features/trainings/trainingsApi'),
  import('../src/redux/features/technicopro/technicoproApi'), import('../src/redux/features/forum/forumApi'),
  import('../src/redux/features/members/membersApi'), import('../src/redux/features/admin/adminApi'), import('../src/redux/features/moderation/moderationApi'),
  import('../src/redux/features/dashboard/dashboardApi'), import('../src/redux/features/notifications/notificationsApi'),
]);

async function client(run: (h: ReturnType<typeof harness>) => Promise<void>) {
  const h = harness(), original = globalThis.fetch;
  globalThis.fetch = h.fetch;
  try { await run(h); }
  finally { globalThis.fetch = original; store.dispatch(logout()); }
}
function harness() {
  const h = {
    profile: user('edit'), owner: 'owner' as string | undefined, canPost: true, locked: false as boolean | undefined,
    replies: 0, canUpload: true, profileStatus: 200, writeStatus: 200, afterRead: undefined as (() => void) | undefined,
    writes: [] as Request[], requests: [] as string[],
    signIn(actor: UserProfile = h.profile) { store.dispatch(setCredentials({ access_token: 'token', user: actor })); store.dispatch(sessionResolved({ user: actor, sessionVersion: store.getState().auth.sessionVersion })); },
    async call(name: string, args: any) {
      h.writes.length = 0; h.requests.length = 0;
      const endpoint = (apiSlice.endpoints as any)[name];
      assert.ok(endpoint, name);
      const result = await store.dispatch(endpoint.initiate(args));
      return result;
    },
    async fetch(input: RequestInfo | URL) {
      const request = input as Request, url = new URL(request.url), path = url.pathname;
      h.requests.push(`${request.method} ${path}`);
      let data: any = {}, status = 200;
      if (path === '/auth/refresh') { data = { access_token: 'refreshed-token', refresh_token: 'refreshed-refresh' }; h.profileStatus = 200; }
      else if (path === '/user/users/me' && request.method === 'GET') { data = h.profile; status = h.profileStatus; }
      else if (path.endsWith('/dashboard/upcoming-events')) data = [];
      else if (request.method !== 'GET') { h.writes.push(request.clone()); status = h.writeStatus; data = { id: 'record', results: [], backups: [] }; }
      else if (path === '/forums/forums') data = { total: 1, total_pages: 1, results: [{ id: 'forum', can_post: h.canPost }] };
      else if (path === '/forums/forums/forum/topics') data = { total: 1, total_pages: 1, results: [{ id: 'record', author: { id: h.owner }, is_locked: h.locked, reply_count: h.replies }] };
      else if (path === '/forums/topics/record/posts') data = { total: 1, total_pages: 1, results: [{ id: 'post', author: { id: h.owner } }] };
      else if (path === '/documents/documents') data = { folder: { id: 'folder', can_upload: h.canUpload }, documents: [{ ...(h.owner === undefined ? { id: 'record' } : resource('document', h.owner)), folder_id: 'folder' }] };
      else {
        const feature = ({ articles: 'article', events: 'event', trainings: 'training', technicopro: 'technicopro' } as any)[path.split('/')[1]];
        data = feature ? (h.owner === undefined ? { id: 'record' } : resource(feature, h.owner)) : {};
      }
      if (request.method === 'GET' && path !== '/user/users/me') h.afterRead?.();
      return new Response(JSON.stringify(status === 403 ? { detail: 'Forbidden' } : data), { status, headers: { 'Content-Type': 'application/json' } });
    },
  };
  return h;
}
const ownedWrites = [
  ['updateArticle', { id: 'record', data: { title: 'Changed' } }, 'article', 'edit'],
  ['deleteArticle', 'record', 'article', 'delete'],
  ['publishArticle', 'record', 'article', 'edit'],
  ['updateEvent', { id: 'record', data: { title: 'Changed' } }, 'event', 'edit'],
  ['deleteEvent', 'record', 'event', 'delete'],
  ['updateTraining', { id: 'record', data: { title: 'Changed' } }, 'training', 'edit'],
  ['deleteTraining', 'record', 'training', 'delete'],
  ['updateTechnicoPro', { id: 'record', data: { title: 'Changed' } }, 'technicopro', 'edit'],
  ['deleteTechnicoPro', 'record', 'technicopro', 'delete'],
  ['publishTechnicoPro', 'record', 'technicopro', 'edit'],
  ['renameDocument', { id: 'record', folderId: 'folder', body: { original_name: 'Changed' } }, 'document', 'edit'],
  ['deleteDocument', { id: 'record', folderId: 'folder' }, 'document', 'delete'],
  ['updateTopic', { topic_id: 'record', forum_id: 'forum', title: 'Changed' }, 'forum', 'edit'],
  ['deleteTopic', { topic_id: 'record', forum_id: 'forum' }, 'forum', 'delete'],
  ['updatePost', { post_id: 'post', topic_id: 'record', forum_id: 'forum', content: 'Changed' }, 'forum', 'edit'],
  ['deletePost', { post_id: 'post', topic_id: 'record', forum_id: 'forum' }, 'forum', 'delete'],
] as const;

test('real RTK mutation entry points deny missing/revoked grants, other/missing owners and inactive superusers without writing', async () => client(async (h) => {
  for (const [name, args, feature, action] of ownedWrites) {
    for (const actor of [user(), user('view'), user('create'), user(action === 'edit' ? 'delete' : 'edit'),
      user(action, { user_permissions: [{ feature, [`can_${action}`]: false }] }),
      user(action, { status: 'suspended' }), user(action, { is_deleted: true }),
      user(action, { is_superuser: true, status: 'pending' }), user(action, { is_superuser: true, is_deleted: true })]) {
      h.profile = actor; h.signIn(user(action)); // stale client grant must not win
      const result = await h.call(name, args);
      assert.equal(result.error?.status, 403, name); assert.equal(h.writes.length, 0, name);
    }
    for (const owner of ['other', undefined]) {
      h.owner = owner; h.profile = user(action); h.signIn();
      assert.equal((await h.call(name, args)).error?.status, 403, name); assert.equal(h.writes.length, 0, name);
    }
    h.owner = 'owner'; h.profile = user(action); h.signIn();
    assert.ok('data' in await h.call(name, args), name); assert.equal(h.writes.length, 1, name);
    h.owner = 'other'; h.profile = user(undefined, { is_superuser: true }); h.signIn();
    assert.ok('data' in await h.call(name, args), name); assert.equal(h.writes.length, 1, name);
    h.owner = 'owner';
  }
}));

test('anonymous, stale identities, failed profile reads, changed sessions and server 403 fail closed', async () => client(async (h) => {
  store.dispatch(logout());
  assert.equal((await h.call('deleteArticle', 'record')).error?.status, 403); assert.equal(h.requests.length, 0);
  h.profile = user('delete', { id: 'different-session' }); h.signIn(user('delete'));
  assert.equal((await h.call('deleteArticle', 'record')).error?.status, 403); assert.equal(h.writes.length, 0);
  h.profile = user('delete'); h.signIn(); h.profileStatus = 403;
  assert.equal((await h.call('deleteArticle', 'record')).error?.status, 403); assert.equal(h.writes.length, 0);
  h.profileStatus = 200; h.afterRead = () => store.dispatch(setUser(user('delete', { id: 'switched' })));
  assert.equal((await h.call('deleteArticle', 'record')).error?.status, 403); assert.equal(h.writes.length, 0);
  h.afterRead = undefined; h.signIn(); h.writeStatus = 403;
  assert.equal((await h.call('deleteArticle', 'record')).error?.status, 403); assert.equal(h.writes.length, 1);
  h.signIn(); h.profileStatus = 401;
  const expired = await h.call('deleteArticle', 'record');
  // Existing logout listener resets RTK state, aborting the expired request.
  assert.equal(expired.error?.name, 'AbortError'); assert.equal(h.writes.length, 0);
  assert.equal(store.getState().auth.isAuthenticated, false);
}));

test('expired tokens refresh before fresh authorization and the write uses the new token', async () => client(async (h) => {
  h.profile = user('delete'); h.profileStatus = 401;
  store.dispatch(setCredentials({ access_token: 'expired', refresh_token: 'refresh', user: h.profile }));
  store.dispatch(sessionResolved({ user: h.profile, sessionVersion: store.getState().auth.sessionVersion }));
  assert.ok('data' in await h.call('deleteArticle', 'record'));
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].headers.get('Authorization'), 'Bearer refreshed-token');
  assert.ok(h.requests.includes('POST /auth/refresh'));
}));

test('direct create and reply calls preserve independent create, can_post, locking, and cascade restrictions', async () => client(async (h) => {
  const reply = { topic_id: 'record', forum_id: 'forum', content: 'Reply' };
  for (const [grant, canPost, locked, allowed] of [
    ['view', true, false, false], ['edit', true, false, false], ['create', false, false, false],
    ['create', true, true, false], ['create', true, undefined, false], ['create', true, false, true],
  ] as const) {
    h.profile = user(grant); h.canPost = canPost; h.locked = locked; h.signIn();
    const result = await h.call('createTopicPost', reply);
    assert.equal('data' in result, allowed); assert.equal(h.writes.length, allowed ? 1 : 0);
  }
  h.profile = user('create'); h.canPost = false; h.signIn();
  assert.equal((await h.call('createForumTopic', { forum_id: 'forum', title: 'Topic', content: 'Body' })).error?.status, 403);
  assert.equal(h.writes.length, 0);
  assert.equal((await h.call('createTopicPost', { ...reply, forum_id: 'wrong-forum' })).error?.status, 403);
  assert.equal(h.writes.length, 0);
  h.profile = user('delete'); h.replies = 1; h.signIn();
  assert.equal((await h.call('deleteTopic', { topic_id: 'record', forum_id: 'forum' })).error?.status, 403); assert.equal(h.writes.length, 0);
  for (const [name, args] of [
    ['createArticle', { title: 'Title' }], ['createEvent', { title: 'Title' }],
    ['createTraining', { title: 'Title' }], ['createTechnicoPro', { title: 'Title' }], ['createFolder', { name: 'Folder' }],
  ] as const) for (const grant of ['view', 'edit', 'delete', 'create']) {
    h.profile = user(grant); h.signIn();
    assert.equal('data' in await h.call(name, args), grant === 'create', name);
    assert.equal(h.writes.length, grant === 'create' ? 1 : 0, name);
  }
}));

test('categories, shared containers, moderation, permission changes and administrative writes require active superuser', async () => client(async (h) => {
  const actions = [
    ...['Article', 'Event', 'Training', 'TechnicoPro'].flatMap((entity) => [
      [`create${entity}Category`, { name: 'Category' }], [`update${entity}Category`, { id: 'record', name: 'Category' }], [`delete${entity}Category`, 'record'],
    ]),
    ['createForum', { name: 'Forum' }], ['updateForum', { forum_id: 'forum' }], ['deleteForum', 'forum'],
    ['updateFolder', { id: 'folder', body: { name: 'Folder' } }],
    ['updateUser', { id: 'owner', body: { first_name: 'Changed', is_superuser: true } }], ['deleteUser', 'owner'],
    ['softDeleteUser', 'owner'], ['restoreUser', 'owner'], ['validateUser', 'owner'],
    ['createUserRole', { name: 'Role' }], ['updateUserRole', { id: 'role', name: 'Role' }], ['deleteUserRole', { id: 'role' }],
    ['createUserPermission', { role_id: 'role', feature: 'article' }], ['updateUserPermission', { id: 'permission', role_id: 'role', can_edit: true }],
    ['updateMemberPermission', { id: 'permission', user_id: 'owner', can_delete: true }],
    ['setArticlePermission', { article_id: ['record'], role_id: ['role'], can_write: true }],
    ['setTrainingPermission', { training_id: ['record'], role_id: ['role'], can_write: true }],
    ['setTechnicoProPermission', { technicopro_id: ['record'], role_id: ['role'], can_write: true }],
    ['setForumPermission', { forum_id: ['forum'], role_id: ['role'], can_post: true }],
    ['updateFolderPermissionsBulk', { folder_id: ['folder'], role_id: ['role'], can_upload: true }],
    ['pinTopic', { topic_id: 'record', pinned: true }], ['moderatePost', { postId: 'post', body: { action: 'approve' } }],
    ['deleteFile', 'https://files.example/other.pdf'], ['clearAdminSystemLogs', undefined], ['deleteAdminBackup', 'backup'],
  ] as const;
  for (const [name, args] of actions) {
    for (const actor of [user('create'), user('edit'), user('delete'), user('edit', { role: 'moderator' }), user(undefined, { is_superuser: true, is_deleted: true })]) {
      h.profile = actor; h.signIn();
      assert.equal((await h.call(name, args)).error?.status, 403, name); assert.equal(h.writes.length, 0, name);
    }
    h.profile = user(undefined, { is_superuser: true }); h.signIn();
    assert.ok('data' in await h.call(name, args), name); assert.equal(h.writes.length, 1, name);
  }
}));

test('delegated account creation strips direct and indirect privilege assignments; self-profile and photo targets stay scoped', async () => client(async (h) => {
  const malicious = { email: 'member@example.test', password: 'password8', first_name: 'Member', role_id: 'admin-role',
    is_superuser: true, status: 'active', payment_validated: true, is_payment_validated: true, permissions: [{ can_edit: true }], user_permissions: [], role: 'admin' };
  assert.deepEqual(Object.keys(ordinaryAccountPayload(malicious)).sort(), ['email', 'first_name', 'password']);
  h.profile = user('create'); h.signIn();
  assert.ok('data' in await h.call('createUser', malicious));
  assert.deepEqual([...await h.writes[0].formData()].map(([key]) => key).sort(), ['email', 'first_name', 'password']);
  h.profile = user(); h.signIn();
  assert.ok('data' in await h.call('updateUsersMe', { first_name: 'Own profile', is_superuser: true, role_id: 'admin-role', status: 'active' }));
  assert.deepEqual([...await h.writes[0].formData()].map(([key]) => key), ['first_name']);
  const photo = new File(['image'], 'photo.png');
  assert.equal((await h.call('uploadUserPhoto', { userId: 'other', photo })).error?.status, 403); assert.equal(h.writes.length, 0);
  assert.ok('data' in await h.call('uploadUserPhoto', { userId: 'owner', photo }));
}));

test('document uploads honor folder capability and shared file uploads revalidate editor action and ownership', async () => client(async (h) => {
  h.profile = user('create'); h.signIn(); h.canUpload = false;
  assert.equal((await h.call('uploadDocument', { folder_id: 'folder', file: new File(['x'], 'doc.pdf') })).error?.status, 403); assert.equal(h.writes.length, 0);
  assert.equal((await h.call('createFolder', { name: 'Child', parent_id: 'folder' })).error?.status, 403); assert.equal(h.writes.length, 0);
  h.canUpload = true;
  assert.ok('data' in await h.call('uploadDocument', { folder_id: 'folder', file: new File(['x'], 'doc.pdf') }));
  const form = new FormData(); form.append('file', new File(['x'], 'image.png'));
  assert.equal((await h.call('uploadFile', form)).error?.status, 403); assert.equal(h.writes.length, 0);
  h.profile = user('edit'); h.signIn(); h.owner = 'other';
  const input = { formData: form, authorization: { feature: 'article', resourceId: 'record' } };
  assert.equal((await h.call('uploadFile', input)).error?.status, 403); assert.equal(h.writes.length, 0);
  h.owner = 'owner'; assert.ok('data' in await h.call('uploadFile', input));
  assert.equal((await h.call('uploadFile', { formData: form, authorization: { feature: 'article' } })).error?.status, 403); assert.equal(h.writes.length, 0);
  h.profile = user(undefined, { is_superuser: true }); h.signIn();
  assert.ok('data' in await h.call('uploadFile', form));
}));

const source = (path: string) => ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function initializer(sf: ts.SourceFile, name: string): string {
  let result: ts.Node | undefined;
  const visit = (n: ts.Node) => { if (ts.isVariableDeclaration(n) && n.name.getText(sf) === name) result = n.initializer; ts.forEachChild(n, visit); };
  visit(sf); assert.ok(result, name); return result.getText(sf);
}
function evaluate(expression: string, context: Record<string, any>) {
  runInNewContext(ts.transpileModule(`result = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.result;
}
test('real final confirmation/submit handlers do not invoke mutations after authorization changes', async () => {
  for (const [path, handler, extra] of [
    ['src/pages/Trainings.tsx', 'handleDelete', { trainings: [{ id: 'record' }] }],
    ['src/pages/TechnicoPro.tsx', 'handleDelete', { items: [{ id: 'record' }] }],
    ['src/pages/Agenda/Agenda.tsx', 'handleDeleteEvent', { apiEvents: [{ id: 'record' }] }],
    ['src/pages/DocumentLibrary.tsx', 'handleDelete', { deletingInfo: { id: 'record', type: 'file' } }],
    ['src/pages/Forums.tsx', 'handleDeleteItem', { deleteTarget: { id: 'record', kind: 'topic' }, topics: [{ id: 'record' }] }],
    ['src/pages/MemberDirectory.tsx', 'handleMemberAction', { memberActionTarget: { id: 'record', status: 'active' }, isSuperuser: false }],
    ['src/pages/AdminPanel.tsx', 'handleDelete', { canAccessAdminPanel: false }],
  ] as const) {
    const writes: string[] = [], mutate = () => { writes.push('write'); return { unwrap: async () => ({}) }; };
    const context = { deletingId: 'record', selectedEvent: undefined, canModify: () => false, canChangeTarget: () => false,
      canDeleteTopic: () => false, canDeleteTarget: () => false, deleteTraining: mutate, deleteItem: mutate, deleteEvent: mutate,
      deleteDocumentMutation: mutate, deleteFolderMutation: mutate, deleteTopic: mutate, deleteUser: mutate, ...extra };
    await evaluate(initializer(source(path), handler), context)(); assert.equal(writes.length, 0, path);
  }
  for (const [path, handler, context] of [
    ['src/pages/Trainings.tsx', 'handleSubmit', { editingTraining: { id: 'record' }, trainings: [{ id: 'record' }] }],
    ['src/pages/TechnicoPro.tsx', 'handleSubmit', { editingItem: { id: 'record' }, items: [{ id: 'record' }] }],
    ['src/pages/Agenda/Agenda.tsx', 'handleAddEvent', { isEditMode: true, editingEventId: 'record', apiEvents: [{ id: 'record' }] }],
    ['src/pages/MemberDirectory.tsx', 'handleSubmit', { editingMember: { id: 'record' }, canEditUser: false, notify() {}, translate: (key: string) => key }],
    ['src/pages/AdminPanel.tsx', 'handleSubmit', { canAccessAdminPanel: false }],
  ] as const) {
    const mutate = () => { throw new Error('Denied handler invoked a mutation'); };
    const scope = { canModify: () => false, selectedEvent: undefined, canCreateEvent: false, createTraining: mutate,
      updateTraining: mutate, createItem: mutate, updateItem: mutate, createUser: mutate, updateUser: mutate,
      createEvent: mutate, updateEvent: mutate, ...context };
    await evaluate(initializer(source(path), handler), scope)({ preventDefault() {} });
  }
});

test('authorization hook uses only a resolved session and does not initialize profile requests', () => {
  const sf = source('src/hooks/usePermissions.ts');
  const expression = initializer(sf, 'usePermissions');
  for (const [status, permissionsStatus, allowed] of [
    ['initializing', 'loading', false], ['error', 'error', false],
    ['unauthenticated', 'unknown', false], ['authenticated', 'ready', true],
  ] as const) {
    const auth = { status, permissionsStatus, isAuthenticated: allowed, token: 'token', user: user('edit') };
    const context = { useSelector: (select: any) => select({ auth }),
      getMergedPermissions: () => ({}), hasPermission, canAccessAdminPanel, canAccessModeration, canModifyResource,
      canCreateInResource, canReplyToTopic };
    const hook = evaluate(expression, context)();
    assert.equal(hook.hasPermission('article', 'edit'), allowed);
    assert.equal(hook.canAccessAdminPanel, false);
    assert.equal(hook.isLoading, status === 'initializing');
  }
});

test('folder DELETE denies ordinary grants and forged superuser state, preserving file ownership rules', async () => client(async (h) => {
  for (const count of [0, 3]) {
    const folder = { id: 'folder', document_count: count, can_upload: true };
    for (const actor of [user('delete'), user('delete', { role: 'admin' }), user(undefined, { user_permissions: [{ feature: 'document', can_delete: true }] }), user('delete', { is_superuser: true, status: 'suspended' })]) {
      h.profile = actor; h.signIn();
      assert.equal(canDeleteFolder(actor, folder), false);
      assert.equal((await h.call('deleteFolder', folder.id)).error?.status, 403);
      assert.equal(h.writes.length, 0);
      assert.deepEqual(h.requests, ['GET /user/users/me']);
    }
    h.profile = user(undefined, { is_superuser: true }); h.signIn();
    assert.equal(canDeleteFolder(h.profile, folder), true);
    assert.ok('data' in await h.call('deleteFolder', folder.id)); assert.equal(h.writes.length, 1);
  }
  h.profile = user('delete'); h.signIn(user('delete', { is_superuser: true }));
  assert.equal((await h.call('deleteFolder', 'folder')).error?.status, 403); assert.equal(h.writes.length, 0);
  h.signIn(); h.owner = 'owner';
  assert.ok('data' in await h.call('deleteDocument', { id: 'record', folderId: 'folder' }));
  h.signIn(); h.owner = 'other';
  assert.equal((await h.call('deleteDocument', { id: 'record', folderId: 'folder' })).error?.status, 403);
}));

test('document folder controls and target handler use the same superuser-only rule', () => {
  const page = source('src/pages/DocumentLibrary.tsx');
  const folders = [{id: 'folder', can_upload: true, document_count: 3}];
  for (const actor of [user('delete'), user('delete', {role: 'admin'}), user(undefined, {is_superuser: true}), user('delete', {is_superuser: true, is_deleted: true})]) {
    const expected = canAccessAdminPanel(actor);
    const context = {user: actor, isSuperuser: expected, allFolders: folders, findFolderInTree: (rows: any[], id: string) => rows.find(row => row.id === id),
      canDeleteFolder, files: [{id: 'record', uploaded_by: {id: 'owner'}}], canModify: (feature: any, target: any, action: any) => canModifyResource(actor, feature, target, action)};
    assert.equal(evaluate(initializer(page, 'canDeleteFolders'), context), expected);
    const canChange = evaluate(initializer(page, 'canChangeTarget'), context);
    assert.equal(canChange({id: 'folder', type: 'folder'}, 'delete'), expected);
    assert.equal(canChange({id: 'missing', type: 'folder'}, 'delete'), false);
    assert.equal(canChange({id: 'record', type: 'file'}, 'delete'), hasPermission(actor, 'document', 'delete'));
  }
});

test('all dashboard RTK reads require eligible superuser, independent of encoded or decoded paths', async () => client(async (h) => {
  for (const name of ['getDashboardStats', 'getDashboardActivity', 'getDashboardUpcomingEvents']) {
    for (const actor of [user('view'), user('view', {role: 'admin'}), user('view', {role: 'moderator'}), user('view', {is_superuser: true, status: 'pending'}), user('view', {is_superuser: true, is_deleted: true})]) {
      h.profile = actor; h.signIn();
      assert.equal((await h.call(name, undefined)).error?.status, 403);
      assert.equal(h.requests.length, 0, 'denied read must not reach fetch');
    }
    h.profile = user(undefined, {is_superuser: true}); h.signIn();
    assert.ok('data' in await h.call(name, undefined)); assert.equal(h.requests.length, 1);
    for (const path of ['/admin%26modarator/dashboard/stats', '/admin&modarator/dashboard/stats']) {
      assert.equal((await authorizeRequest(name, {url: path}, user('view'), async () => ({}))).error?.status, 403);
    }
  }
}));

test('unknown protected reads deny even superusers while explicit shared and feature reads still work', async () => client(async (h) => {
  apiSlice.injectEndpoints({ endpoints: (builder) => ({
    auditUnknownRead: builder.query<unknown, string>({query: (url) => url}),
  }) });
  for (const actor of [user('view'), user(undefined, {is_superuser: true})]) {
    h.profile = actor;
    for (const path of ['/unmapped/private', '/auth/unmapped', '/settings/admin/unmapped', '/admin%26modarator/unmapped']) {
      h.signIn(); assert.equal((await h.call('auditUnknownRead', path)).error?.status, 403); assert.equal(h.requests.length, 0);
    }
  }
  for (const [name, args] of [['getUsersOnline', undefined], ['getNotificationPreferences', undefined], ['getDashboardSearch', {q: 'example'}], ['getArticleById', 'record']] as const) {
    h.profile = user('view'); h.signIn(); assert.ok('data' in await h.call(name, args), name);
  }
}));

test('personal override creation and undocumented null resets deny at final RTK boundary', async () => client(async (h) => {
  for (const actor of [user('edit'), user(undefined, {is_superuser: true})]) {
    h.profile = actor; h.signIn();
    assert.equal((await h.call('createMemberPermission', {user_id: 'owner', feature: 'article', can_view: true, can_create: true, can_edit: false, can_delete: false})).error?.status, 403);
    assert.equal(h.writes.length, 0);
    assert.equal((await h.call('updateMemberPermission', {id: 'permission', user_id: 'owner', can_view: null})).error?.status, 403);
    assert.equal(h.writes.length, 0);
  }
  h.profile = user(undefined, {is_superuser: true}); h.signIn();
  assert.ok('data' in await h.call('updateMemberPermission', {id: 'permission', user_id: 'owner', can_edit: true}));
  assert.deepEqual(await h.writes[0].json(), {can_edit: true});
}));

test('Draft and Published creation use Create independently of View; existing transitions use Edit and owner', async () => client(async (h) => {
  for (const [create, update, publish] of [['createArticle', 'updateArticle', 'publishArticle'], ['createTraining', 'updateTraining', undefined], ['createTechnicoPro', 'updateTechnicoPro', 'publishTechnicoPro']] as const) {
    for (const status of ['draft', 'published']) {
      h.profile = user('create'); h.signIn();
      assert.ok('data' in await h.call(create, {title: 'New', status}));
      assert.equal((await h.writes[0].formData()).get('status'), status);
      assert.equal((await h.call(update, {id: 'record', data: {status}})).error?.status, 403); assert.equal(h.writes.length, 0);
      h.profile = user('edit'); h.signIn(); h.owner = 'other';
      assert.equal((await h.call(update, {id: 'record', data: {status}})).error?.status, 403); assert.equal(h.writes.length, 0);
      h.signIn(); h.owner = 'owner';
      assert.ok('data' in await h.call(update, {id: 'record', data: {status}}));
    }
    if (publish) {
      h.profile = user('create'); h.signIn(); assert.equal((await h.call(publish, 'record')).error?.status, 403);
      h.profile = user('edit'); h.signIn(); h.owner = 'owner'; assert.ok('data' in await h.call(publish, 'record'));
    }
    h.profile = user(undefined, {is_superuser: true}); h.signIn(); h.owner = 'other';
    assert.ok('data' in await h.call(create, {title: 'New', status: 'published'}));
    assert.ok('data' in await h.call(update, {id: 'record', data: {status: 'published'}}));
  }
}));
