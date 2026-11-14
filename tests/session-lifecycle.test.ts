import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = { getItem: (key: string) => key === 'user' ? '{invalid cached JSON' : null, setItem() {}, removeItem() {} } as unknown as Storage;
const { store } = await import('../src/redux/store');
const { setCredentials, sessionResolved, sessionFailed, tokenRefreshed, logout, retrySession } = await import('../src/redux/features/auth/authSlice');
const { membersApi } = await import('../src/redux/features/members/membersApi');
const { authApi } = await import('../src/redux/features/auth/authApi');
const { documentsApi } = await import('../src/redux/features/documents/documentsApi');
const { canDeleteFolder } = await import('../src/redux/features/auth/resourceAuthorization');
const { authorizeRequest } = await import('../src/redux/features/api/mutationAuthorization');
const { authDestination } = await import('../src/utils/authDestination');
const { getApiErrorDisplayMessage } = await import('../src/utils/apiErrorMessages');
const actor = (extra = {}): any => ({ id: 'owner', email: 'member@example.test', role: 'membre', status: 'active', is_deleted: false, is_superuser: false,
  permissions: [{ feature: 'document', can_view: true, can_delete: true }], user_permissions: [], ...extra });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve!: (value?: any) => void; const promise = new Promise<any>((r) => { resolve = r; }); return { promise, resolve }; };
async function mock(fetch: typeof globalThis.fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  store.dispatch(logout()); globalThis.fetch = fetch;
  try { await run(); } finally { store.dispatch(logout()); globalThis.fetch = original; }
}
function signIn(user = actor()) {
  store.dispatch(setCredentials({ access_token: 'token', user }));
  store.dispatch(sessionResolved({ user, sessionVersion: store.getState().auth.sessionVersion }));
}

test('delayed profile deduplicates subscribers and resolves identity/permissions together', async () => {
  const gate = deferred(); let requests = 0;
  await mock(async () => { requests++; await gate.promise; return response(actor()); }, async () => {
    store.dispatch(setCredentials({ access_token: 'token', role: 'admin' }));
    assert.equal(store.getState().auth.status, 'initializing');
    assert.equal(store.getState().auth.isAuthenticated, false);
    assert.equal(store.getState().auth.user, null);
    const first = store.dispatch(membersApi.endpoints.getUsersMe.initiate());
    const second = store.dispatch(membersApi.endpoints.getUsersMe.initiate());
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(requests, 1);
    assert.equal(store.getState().auth.permissionsStatus, 'loading');
    gate.resolve(); await Promise.all([first, second]);
    assert.equal(store.getState().auth.status, 'authenticated');
    assert.equal(store.getState().auth.permissionsStatus, 'ready');
    assert.equal(store.getState().auth.user?.id, 'owner');
    first.unsubscribe(); second.unsubscribe();
  });
});

test('profile network/403/5xx errors keep session and allow an explicit retry; 401 logs out', async () => {
  for (const status of ['network', 403, 500, 401] as const) {
    let fail = true;
    await mock(async () => { if (fail && status === 'network') throw new TypeError('Offline'); return response(actor(), fail ? status as number : 200); }, async () => {
      store.dispatch(setCredentials({ access_token: 'token' }));
      await store.dispatch(membersApi.endpoints.getUsersMe.initiate(undefined, { subscribe: false }));
      assert.equal(store.getState().auth.status, status === 401 ? 'unauthenticated' : 'error');
      if (status === 401) return;
      assert.equal(store.getState().auth.token, 'token');
      fail = false; store.dispatch(retrySession());
      await store.dispatch(membersApi.endpoints.getUsersMe.initiate(undefined, { subscribe: false, forceRefetch: true }));
      assert.equal(store.getState().auth.status, 'authenticated');
    });
  }
});

test('a profile or refresh from an old session cannot hydrate/logout a newer login', async () => {
  const gate = deferred(), started = deferred();
  await mock(async () => { started.resolve(); await gate.promise; return response(actor()); }, async () => {
    store.dispatch(setCredentials({ access_token: 'old' }));
    const version = store.getState().auth.sessionVersion;
    const pending = store.dispatch(membersApi.endpoints.getUsersMe.initiate());
    await started.promise;
    store.dispatch(logout());
    signIn(actor({ id: 'new-user' }));
    gate.resolve(); await pending;
    store.dispatch(sessionResolved({ user: actor(), sessionVersion: version }));
    store.dispatch(sessionFailed({ error: 401, sessionVersion: version }));
    store.dispatch(tokenRefreshed({ access_token: 'stale', sessionVersion: version }));
    assert.equal(store.getState().auth.user?.id, 'new-user');
    assert.equal(store.getState().auth.token, 'token');
    assert.equal(store.getState().auth.status, 'authenticated');
  });
});

test('background profile refresh keeps access ready and then applies permission revocation', async () => {
  const gate = deferred();
  await mock(async () => { await gate.promise; return response(actor({ user_permissions: [{ feature: 'document', can_delete: false }] })); }, async () => {
    signIn();
    const request = store.dispatch(membersApi.endpoints.getUsersMe.initiate(undefined, { subscribe: false, forceRefetch: true }));
    assert.equal(store.getState().auth.status, 'authenticated');
    assert.equal(store.getState().auth.permissionsStatus, 'ready');
    gate.resolve(); await request;
    assert.equal(canDeleteFolder(store.getState().auth.user, { id: 'folder' }), false);
  });
});

test('a late refresh response from an old login cannot replace new credentials', async () => {
  const gate = deferred(), started = deferred();
  await mock(async (input) => {
    if ((input as Request).url.endsWith('/auth/refresh')) { started.resolve(); await gate.promise; return response({ access_token: 'stale-refreshed-token' }); }
    return response({}, 401);
  }, async () => {
    store.dispatch(setCredentials({ access_token: 'old', refresh_token: 'old-refresh' }));
    const request = store.dispatch(membersApi.endpoints.getUsersMe.initiate(undefined, { subscribe: false }));
    await started.promise;
    store.dispatch(logout()); signIn(actor({ id: 'new-user' }));
    gate.resolve(); await request;
    assert.equal(store.getState().auth.token, 'token');
    assert.equal(store.getState().auth.user?.id, 'new-user');
    assert.equal(store.getState().auth.status, 'authenticated');
  });
});

test('a stalled /me times out into a recoverable session error', async () => {
  const requests: Request[] = [];
  await mock(async (input) => {
    const request = input as Request;
    // A real fetch retains its Request while pending; the mock must do the same.
    requests.push(request);
    return await new Promise<Response>((_, reject) => {
      request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
    });
  }, async () => {
    store.dispatch(setCredentials({ access_token: 'token' }));
    await store.dispatch(membersApi.endpoints.getUsersMe.initiate(undefined, { subscribe: false }));
    assert.equal(store.getState().auth.status, 'error');
    assert.equal(store.getState().auth.error, 'TIMEOUT_ERROR');
    assert.equal(store.getState().auth.token, 'token');
    assert.equal(requests[0].signal.aborted, true);
  });
});

test('late login response cannot sign in again after logout', async () => {
  const gate = deferred(), started = deferred();
  await mock(async () => { started.resolve(); await gate.promise; return response({ access_token: 'stale', status: 'active' }); }, async () => {
    const request = store.dispatch(authApi.endpoints.login.initiate({ email: 'member@example.test', password: 'secret' }));
    await started.promise; store.dispatch(logout()); gate.resolve();
    const result = await request;
    assert.ok(result.error);
    assert.equal(store.getState().auth.status, 'unauthenticated');
  });
});

test('concurrent expired reads share recovery and keep resolved permissions during recovery', async () => {
  let refreshes = 0, profiles = 0;
  await mock(async (input) => {
    const request = input as Request;
    if (request.url.endsWith('/auth/refresh')) { refreshes++; await new Promise((r) => setTimeout(r, 20)); return response({ access_token: 'renewed' }); }
    if (request.url.endsWith('/me')) profiles++;
    return response({}, request.headers.get('Authorization') === 'Bearer renewed' ? 200 : 401);
  }, async () => {
    store.dispatch(setCredentials({ access_token: 'old', refresh_token: 'refresh' }));
    store.dispatch(sessionResolved({ user: actor(), sessionVersion: store.getState().auth.sessionVersion }));
    const results = await Promise.all(['a', 'b'].map((id) => store.dispatch(documentsApi.endpoints.downloadDocument.initiate(id, { subscribe: false }))));
    assert.ok(results.every((result) => result.isSuccess));
    assert.equal(refreshes, 1); assert.equal(profiles, 0);
    assert.equal(store.getState().auth.permissionsStatus, 'ready');
  });
});

test('failed recovery preserves non-401 errors; repeated 401 settles without a loop', async () => {
  for (const failure of [403, 500, 'network', 'retry401'] as const) {
    let calls = 0;
    await mock(async (input) => {
      calls++;
      if ((input as Request).url.endsWith('/auth/refresh')) {
        if (failure === 'network') throw new TypeError('Offline');
        return failure === 'retry401' ? response({ access_token: 'renewed' }) : response({}, failure);
      }
      return response({}, 401);
    }, async () => {
      store.dispatch(setCredentials({ access_token: 'old', refresh_token: 'refresh' }));
      await store.dispatch(membersApi.endpoints.getUsersMe.initiate(undefined, { subscribe: false }));
      assert.equal(store.getState().auth.status, failure === 'retry401' ? 'unauthenticated' : 'error');
      assert.ok(calls <= 3);
    });
  }
});

test('shared folder deletion is superuser-only regardless of upload capability, contents or personal delete grant', async () => {
  const folder = { id: 'child', parent_id: 'parent', can_upload: false, document_count: 3 };
  for (const user of [actor({ is_superuser: true }), actor({ is_superuser: true, permissions: [], user_permissions: [{ feature: 'document', can_delete: false }] })]) {
    assert.equal(canDeleteFolder(user, folder), true);
    const result = await authorizeRequest('deleteFolder', { url: '/documents/documents/folders/child', method: 'DELETE' }, user,
      async () => ({ data: [{ id: 'parent', children: [folder] }] }));
    assert.ok(result.request);
  }
  for (const user of [null, actor(), actor({ permissions: [], user_permissions: [{ feature: 'document', can_delete: true }] }), actor({ permissions: [{ feature: 'document', can_view: true, can_create: true, can_edit: true }] }),
    actor({ user_permissions: [{ feature: 'document', can_delete: false }] }), actor({ status: 'suspended' }), actor({ is_superuser: true, is_deleted: true })]) {
    assert.equal(canDeleteFolder(user, folder), false);
  }
  const missing = await authorizeRequest('deleteFolder', { url: '/documents/documents/folders/hidden', method: 'DELETE' }, actor(), async () => ({ data: [folder] }));
  assert.equal(missing.error?.status, 403);
  const failed = await authorizeRequest('deleteFolder', { url: '/documents/documents/folders/child', method: 'DELETE' }, actor(), async () => ({ error: { status: 500, data: {} } }));
  assert.equal(failed.error?.status, 403);
});

test('reauthentication destinations preserve path, query and fragment and reject external/auth loops', () => {
  assert.equal(authDestination({ pathname: '/trainings/category/a', search: '?page=2', hash: '#content' }), '/trainings/category/a?page=2#content');
  for (const from of [undefined, 'https://example.com', { pathname: '//example.com' }, { pathname: '/login' }]) assert.equal(authDestination(from), '/');
});

test('modal transport and fallback errors use translations while server validation details are preserved', () => {
  const translate = (key: string) => `translated:${key}`;
  for (const [status, key] of [['FETCH_ERROR', 'network'], ['TIMEOUT_ERROR', 'timeout'], ['PARSING_ERROR', 'parsing']]) {
    assert.equal(getApiErrorDisplayMessage({ status, error: 'English transport detail' }, translate), `translated:apiErrors.${key}`);
  }
  assert.equal(getApiErrorDisplayMessage({}, translate), 'translated:apiErrors.default');
  assert.equal(getApiErrorDisplayMessage({}, translate, 'trainingsPage.trainingSaveError'), 'translated:trainingsPage.trainingSaveError');
  assert.equal(getApiErrorDisplayMessage({ status: 422, data: { detail: 'Server validation detail' } }, translate), 'Server validation detail');
});
