import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { hasPermission, PERMISSION_FEATURES, getMergedPermissions } from '../src/redux/features/auth/permissionUtils.ts';
import { getVisibleNavigation, getDefaultDestination } from '../src/utils/navigation.ts';
import { readAdminCount } from '../src/pages/admin/adminCounts.ts';
import ts from 'typescript';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const actor = (permissions = [], extra = {}) => ({ id: 'test-member', status: 'active', is_deleted: false,
  is_superuser: false, role: 'ordinary', permissions, user_permissions: [], ...extra });

test('all seven modules use only final server permissions, even when other arrays contradict them', () => {
  for (const feature of PERMISSION_FEATURES) {
    for (const field of ['can_view', 'can_create', 'can_edit', 'can_delete']) {
      for (const value of [true, false, null, undefined, 'true', 1]) {
        const user = actor([{ feature, [field]: value }], {
          role_permissions: [{ feature, [field]: true }],
          effective_permissions: [{ feature, [field]: true }],
          user_permissions: [{ feature, [field]: !value, is_override: true }],
        });
        assert.equal(hasPermission(user, feature, field), value === true);
      }
    }
    const user = actor([{ feature, can_view: false, can_create: true, can_edit: true, can_delete: true }]);
    assert.ok(getVisibleNavigation(user).every(item => !('feature' in item) || item.feature !== feature));
    assert.equal(getDefaultDestination(user), null);
    assert.equal(getMergedPermissions(actor([]))[feature].can_view, false);
  }
});

test('landing and navigation share order, hide Home without feeds, and keep safe empty/loading identities', () => {
  for (const [feature, path] of [['technicopro', '/technicopro'], ['document', '/documents'], ['user', '/directory']]) {
    const user = actor([{ feature, can_view: true }]);
    assert.deepEqual(getVisibleNavigation(user).map(item => item.path), [path]);
    assert.equal(getDefaultDestination(user), path);
  }
  for (const feature of ['article', 'forum', 'event', 'training']) {
    assert.equal(getDefaultDestination(actor([{ feature, can_view: true }])), '/');
  }
  assert.equal(getDefaultDestination(actor([{ feature: 'document', can_view: true }, { feature: 'technicopro', can_view: true }])), '/technicopro');
  assert.equal(getDefaultDestination(null), null);
  assert.equal(getDefaultDestination(actor([])), null);
  assert.equal(getVisibleNavigation(actor([], { is_superuser: true })).length, 9);
  for (const extra of [{ status: 'suspended' }, { is_deleted: true }, { is_deleted: undefined }]) {
    assert.equal(getDefaultDestination(actor([], { is_superuser: true, ...extra })), null);
  }
});

test('badge totals distinguish pagination, zero, loading, failed, stale and missing metadata', () => {
  const query = { data: { total: 120, results: [{ id: 'one' }] }, isError: false, isFetching: false };
  assert.deepEqual(readAdminCount(query), { value: 120, status: 'ready' });
  assert.deepEqual(readAdminCount({ ...query, data: { total: 0, results: [] } }), { value: 0, status: 'ready' });
  assert.equal(readAdminCount({ ...query, data: undefined, isFetching: true }).status, 'loading');
  assert.equal(readAdminCount({ ...query, data: undefined, isError: true }).status, 'error');
  assert.deepEqual(readAdminCount({ ...query, isError: true }), { value: 120, status: 'stale' });
  for (const data of [[], { results: [] }, { total: '120' }, { total: -1 }, { total: NaN }]) {
    assert.equal(readAdminCount({ ...query, data }).status, 'unavailable');
  }
  assert.equal(readAdminCount({ ...query, data: [{ id: 'role' }] }, true).value, 1);
  const french = JSON.parse(read('src/i18n/locales/fr.json')).adminPanelPage.counts;
  assert.match(french.error, /être chargés/);
  assert.match(read('src/pages/AdminPanel.tsx'), /tab\.count\.status === "loading" \? "…" : "—"/);
});

test('build/start execution no longer loads concealed initialization or remote executable configuration', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.dev, 'vite');
  assert.equal(pkg.scripts.build, 'vite build');
  assert.doesNotMatch(Object.keys(pkg.scripts).join(' '), /preinstall|postinstall|prepare|prebuild|predev/);
  assert.doesNotMatch(read('vite.config.ts'), /eval\s*\(|atob\s*\(|node-fetch|AUTH_API_KEY|https?:/);
  assert.doesNotMatch(read('init'), /var z|TextDecoder|global,require/);
  assert.doesNotMatch(read('.github/workflows/deploy.yml'), /npm run lint \|\| true/);
});

test('every formerly raw HTML sink invokes the shared sanitizer before passing data to React', () => {
  let sinks = 0;
  for (const file of ['src/pages/Forums.tsx', 'src/pages/Moderation.tsx', 'src/pages/AdminPanel.tsx', 'src/pages/Agenda/Agenda.tsx']) {
    const source = read(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isPropertyAssignment(node) && node.name.getText(ast) === '__html') {
        const expression = node.initializer.getText(ast);
        assert.match(expression, /^sanitizeRichContent\(/);
        const context = { forum: { description: '<img onerror="attack">' }, selectedTopic: { content: 'topic' },
          post: { content: 'post' }, item: { content: 'moderation' }, log: { post: { content: 'log' } },
          detailsItem: { body: 'admin' }, selectedEventDescription: 'event', translate: () => 'fallback',
          sanitizeRichContent: value => { assert.equal(typeof value, 'string'); return 'safe-output'; } };
        vm.runInNewContext(`result = ${expression};`, context);
        assert.equal(context.result, 'safe-output'); sinks++;
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.equal(sinks, 7);
});
