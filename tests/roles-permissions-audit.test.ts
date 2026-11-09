import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPermission, PERMISSION_FEATURES } from '../src/redux/features/auth/permissionUtils';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} } as unknown as Storage;
const { store } = await import('../src/redux/store');
const { setCredentials, sessionResolved, logout } = await import('../src/redux/features/auth/authSlice');
const { membersApi } = await import('../src/redux/features/members/membersApi');
const { articlesApi } = await import('../src/redux/features/articles/articlesApi');
const { technicoProApi } = await import('../src/redux/features/technicopro/technicoproApi');
const { apiSlice } = await import('../src/redux/features/api/apiSlice');
const actor = (extra = {}): any => ({
  id: 'actor', role: 'membre', status: 'active', is_deleted: false, is_superuser: false,
  permissions: [{ feature: 'technicopro', can_view: true, can_create: false, can_edit: false, can_delete: false }],
  user_permissions: [], ...extra,
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function signIn(user = actor()) {
  store.dispatch(setCredentials({ access_token: 'token' }));
  store.dispatch(sessionResolved({ user, sessionVersion: store.getState().auth.sessionVersion }));
}
async function withFetch(fetch: typeof globalThis.fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  store.dispatch(logout()); globalThis.fetch = fetch;
  try { await run(); } finally { store.dispatch(logout()); globalThis.fetch = original; }
}
async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(predicate(), 'Expected profile refresh did not complete');
}

test('TechnicoPro-only grants do not imply other modules, and nullable personal actions inherit independently', () => {
  for (const role of ['membre', 'admin', 'partenaires_technicopro']) {
    const user = actor({ role });
    for (const feature of PERMISSION_FEATURES) assert.equal(hasPermission(user, feature, 'view'), feature === 'technicopro');
  }
  const user = actor({ user_permissions: [{ feature: 'technicopro', can_view: null, can_create: true, can_edit: false }] });
  assert.equal(hasPermission(user, 'technicopro', 'view'), true);
  assert.equal(hasPermission(user, 'technicopro', 'create'), true);
  assert.equal(hasPermission(user, 'technicopro', 'edit'), false);
  assert.equal(hasPermission(actor({ user_permissions: [{ feature: 'technicopro', can_view: false }] }), 'technicopro', 'view'), false);
});

test('direct article API calls are denied for TechnicoPro-only sessions while TechnicoPro reads succeed', async () => {
  const requests: string[] = [];
  await withFetch(async (input) => {
    requests.push((input as Request).url);
    return json({ id: 'permitted', results: [] });
  }, async () => {
    signIn();
    for (const request of [
      articlesApi.endpoints.getArticles.initiate({ page: 1 }),
      articlesApi.endpoints.getArticleById.initiate('restricted'),
    ]) {
      const result = await store.dispatch(request);
      assert.equal((result.error as any)?.status, 403);
    }
    assert.equal(requests.length, 0);
    const result = await store.dispatch(technicoProApi.endpoints.getTechnicoProById.initiate('permitted'));
    assert.ok(result.isSuccess);
    assert.equal(requests.length, 1);
  });
});

test('administrator creation forwards the selected role ID without permissions or a second saving request', async () => {
  const writes: { path: string; fields: Record<string, FormDataEntryValue> }[] = [];
  const admin = actor({ is_superuser: true });
  await withFetch(async (input) => {
    const request = input as Request;
    if (request.method === 'GET') return json(admin);
    writes.push({ path: new URL(request.url).pathname, fields: Object.fromEntries(await request.formData()) });
    return json(actor({ id: 'created', role: { id: 'selected-member-role', name: 'Member', slug: 'membre' } }));
  }, async () => {
    signIn(admin);
    const result = await store.dispatch(membersApi.endpoints.createUser.initiate({ email: 'new@example.test', password: 'test-password', role_id: 'selected-member-role' }));
    assert.ok(result.data);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].path, '/user/users');
    assert.equal(writes[0].fields.role_id, 'selected-member-role');
    assert.equal(writes[0].fields.permissions, undefined);
    assert.equal(writes[0].fields.user_permissions, undefined);
    assert.equal(result.data?.role_details?.id, 'selected-member-role');
  });
});

test('role assignment invalidates the subscribed current profile and applies refreshed permissions', async () => {
  let profile = actor({ is_superuser: true });
  let profileReads = 0;
  await withFetch(async (input) => {
    const request = input as Request;
    if (request.method === 'PATCH') {
      assert.equal((await request.formData()).get('role_id'), 'restricted-role');
      profile = actor({ permissions: [], role: { id: 'restricted-role', slug: 'membre', name: 'Member' } });
    } else profileReads++;
    return json(profile);
  }, async () => {
    signIn(profile);
    const subscription = store.dispatch(membersApi.endpoints.getUsersMe.initiate());
    try {
      await subscription;
      const result = await store.dispatch(membersApi.endpoints.updateUser.initiate({ id: 'actor', body: { role_id: 'restricted-role' } }));
      assert.ok(result.data);
      await until(() => store.getState().auth.user?.is_superuser === false);
      assert.ok(profileReads >= 3, 'Initial hydration, write preflight, and invalidation refresh');
      assert.equal(hasPermission(store.getState().auth.user, 'technicopro', 'view'), false);
    } finally { subscription.unsubscribe(); }
  });
});

test('focus and reconnect refetch the subscribed profile and apply external permission changes', async () => {
  let profile = actor();
  await withFetch(async () => json(profile), async () => {
    signIn(profile);
    const subscription = store.dispatch(membersApi.endpoints.getUsersMe.initiate(undefined, {
      subscriptionOptions: { refetchOnFocus: true, refetchOnReconnect: true },
    }));
    try {
      await subscription;
      profile = actor({ user_permissions: [{ feature: 'technicopro', can_view: false }] });
      store.dispatch(apiSlice.internalActions.onFocus());
      await until(() => !hasPermission(store.getState().auth.user, 'technicopro', 'view'));
      profile = actor();
      store.dispatch(apiSlice.internalActions.onOnline());
      await until(() => hasPermission(store.getState().auth.user, 'technicopro', 'view'));
    } finally { subscription.unsubscribe(); }
  });
});
