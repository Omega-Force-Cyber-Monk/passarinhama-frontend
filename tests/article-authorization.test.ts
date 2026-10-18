import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canModifyArticle } from '../src/redux/features/articles/articleAuthorization';
import type { UserProfile } from '../src/redux/features/auth/authTypes';

const user = (edit = false, remove = false, extra = {}): UserProfile => ({
  id: 'owner', status: 'active', is_superuser: false, role: 'member',
  permissions: [{ feature: 'article', can_edit: edit, can_delete: remove }],
  user_permissions: [], ...extra,
} as UserProfile);
const own = { id: 'article', author: { id: 'owner', name: 'Owner', email: '' } };
const other = { ...own, author: { ...own.author, id: 'other' } };

test('ownership and separate edit/delete permissions', () => {
  for (const [edit, remove] of [[true, true], [true, false], [false, true], [false, false]]) {
    assert.equal(canModifyArticle(user(edit, remove), own, 'edit'), edit);
    assert.equal(canModifyArticle(user(edit, remove), own, 'delete'), remove);
    assert.equal(canModifyArticle(user(edit, remove), other, 'edit'), false);
    assert.equal(canModifyArticle(user(edit, remove), other, 'delete'), false);
  }
});
test('superuser bypass is explicit; role names grant no access', () => {
  for (const action of ['edit', 'delete'] as const) {
    assert.equal(canModifyArticle(user(false, false, { is_superuser: true }), other, action), true);
    assert.equal(canModifyArticle(user(true, true, { role: 'Administrator', role_details: { slug: 'admin' } }), other, action), false);
  }
});
test('missing data and inactive users fail closed; existing overrides are respected', () => {
  assert.equal(canModifyArticle(null, own, 'edit'), false);
  assert.equal(canModifyArticle(user(true), undefined, 'edit'), false);
  assert.equal(canModifyArticle(user(true), { id: 'article' }, 'edit'), false);
  assert.equal(canModifyArticle(user(true, true, { id: '' }), { id: 'article' }, 'edit'), false);
  assert.equal(canModifyArticle(user(true, true, { status: 'pending' }), own, 'edit'), false);
  assert.equal(canModifyArticle(user(true, true, { is_deleted: true }), own, 'delete'), false);
  assert.equal(canModifyArticle(user(true, true, { user_permissions: [{ feature: 'article', can_edit: false }] }), own, 'edit'), false);
});

test('RTK mutations revalidate server ownership/permissions and propagate 403 without writing', async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage;
  const { store } = await import('../src/redux/store');
  const { articlesApi } = await import('../src/redux/features/articles/articlesApi');
  const { setUser } = await import('../src/redux/features/auth/authSlice');
  const originalFetch = globalThis.fetch;
  let freshUser = user(true, true);
  let freshArticle = own;
  let readStatus = 200;
  let writeStatus = 200;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const request = input as Request;
    requests.push(request.method + ' ' + new URL(request.url).pathname);
    const isRead = request.method === 'GET';
    const data = isRead ? (request.url.endsWith('/me') ? freshUser : freshArticle) : own;
    const status = isRead ? readStatus : writeStatus;
    return new Response(JSON.stringify(status === 403 ? { detail: 'Forbidden' } : data), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  };
  const mutate = async (action: 'edit' | 'delete') => {
    requests.length = 0;
    const operation = action === 'edit'
      ? articlesApi.endpoints.updateArticle.initiate({ id: own.id, data: { title: 'Changed' } })
      : articlesApi.endpoints.deleteArticle.initiate(own.id);
    return await store.dispatch(operation);
  };
  try {
    // Redux still contains grants when the backend has revoked them.
    store.dispatch(setUser(user(true, true)));
    for (const action of ['edit', 'delete'] as const) {
      freshUser = user(true, true);
      freshArticle = other;
      assert.equal((await mutate(action)).error?.['status'], 403);
      assert.ok(requests.every((r) => r.startsWith('GET ')));
      freshArticle = own;
      freshUser = user();
      assert.equal((await mutate(action)).error?.['status'], 403);
      assert.ok(requests.every((r) => r.startsWith('GET ')));
      freshUser = user(true, true);
      assert.ok('data' in await mutate(action));
      assert.equal(requests.at(-1), (action === 'edit' ? 'PATCH ' : 'DELETE ') + '/articles/articles/article');
      freshUser = user(false, false, { is_superuser: true });
      freshArticle = other;
      assert.ok('data' in await mutate(action));
      readStatus = 403;
      assert.equal((await mutate(action)).error?.['status'], 403);
      assert.ok(requests.every((r) => r.startsWith('GET ')));
      readStatus = 200;
      writeStatus = 403;
      assert.equal((await mutate(action)).error?.['status'], 403);
      writeStatus = 200;
    }
  } finally {
    globalThis.fetch = originalFetch;
    store.dispatch(articlesApi.util.resetApiState());
  }
});
