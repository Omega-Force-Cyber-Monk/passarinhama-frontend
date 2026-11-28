import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const parse = path => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const policy = parse('src/redux/features/auth/permissionUtils.ts');
const home = parse('src/pages/Home.tsx');
const navigation = parse('src/utils/navigation.ts');
const code = file => file.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(file).replace(/\bexport default /g, '').replace(/\bexport /g, '')).join('\n');
const messages = JSON.parse(read('src/i18n/locales/en.json'));
const translate = key => {
  const value = key.split('.').reduce((object, part) => object?.[part], messages);
  assert.equal(typeof value, 'string', key); return value;
};
const elements = (tree, type) => {
  const result = [];
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; if (node.type === type) result.push(node); visit(node.props.children); }
  visit(tree); return result;
};
function render(features, extra = {}, failedFeature) {
  const queries = [], navigations = [];
  const actor = {id: 'member', status: 'active', is_deleted: false, is_superuser: false, permissions: features.map(feature => ({feature, can_view: true})), user_permissions: [], ...extra};
  const query = (name, data) => (args, options) => {queries.push({name, skip: options?.skip}); return {data, isError: failedFeature === name, error: failedFeature === name ? {status: 500, data: {detail: "Feed failed"}} : undefined};};
  const context = {
    actor, React: {Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props: {...props, children}})},
    useState: initial => [initial, () => {}], useLocation: () => ({}), useNavigate: () => path => navigations.push(path),
    useI18n: () => ({translate, localeCode: 'en'}), AccessRestrictedNotice: 'restricted', Navigate: 'redirect', LoadingIndicator: 'loading',
    useGetForumsQuery: query('forum', {results: []}), useGetArticlesQuery: query('article', {results: []}),
    useGetUpcomingEventsQuery: query('event', []), useGetTrainingsPaginatedQuery: query('training', {results: []}),
    ...Object.fromEntries(['BookOpen', 'Calendar', 'FileText', 'MapPin', 'MessageSquare'].map(name => [name, name])),
  };
  const source = `${code(policy)}\n${code(navigation)}\nfunction usePermissions() { return {user: actor, hasPermission: (feature, action) => hasPermission(actor, feature, action)}; }\n${code(home)}\nresult = Home();`;
  runInNewContext(ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React}}).outputText, context);
  return {tree: context.result, queries, navigations};
}
for (const [feature, path] of [['technicopro', '/technicopro'], ['user', '/directory'], ['document', '/documents']]) {
  test(`${feature}-only Home redirects to the authorized module and skips all feed queries`, () => {
    const h = render([feature]);
    assert.equal(elements(h.tree, 'restricted').length, 0);
    assert.equal(elements(h.tree, 'redirect')[0].props.to, path);
    assert.equal(elements(h.tree, 'button').length, 0);
    assert.ok(h.queries.every(query => query.skip));
  });
}
test('no-view and inactive/deleted accounts remain restricted without module links or feed requests', () => {
  for (const [features, extra] of [[[], {}], [['technicopro'], {status: 'suspended'}], [[], {is_superuser: true, is_deleted: true}]]) {
    const h = render(features, extra);
    assert.equal(elements(h.tree, 'restricted').length, 1);
    assert.equal(elements(h.tree, 'button').length, 0); assert.ok(h.queries.every(query => query.skip));
  }
});
test('active superusers and feed-authorized members retain their existing Home feeds', () => {
  const admin = render([], {is_superuser: true});
  assert.equal(elements(admin.tree, 'restricted').length, 0); assert.ok(admin.queries.every(query => !query.skip));
  const member = render(['article']);
  assert.equal(elements(member.tree, 'restricted').length, 0);
  assert.deepEqual(member.queries.filter(query => !query.skip).map(query => query.name), ['article']);
});
test('authorized Home feed failures retain the real error instead of displaying an empty-feed state', () => {
  for (const feature of ['article', 'forum', 'event', 'training']) {
    const h = render([feature], {}, feature);
    assert.match(JSON.stringify(h.tree), /Feed failed/);
    assert.equal(elements(h.tree, 'restricted').length, 0);
  }
});
test('search rows and count exclude denied and unknown result types, regardless of raw totals', () => {
  const sf = parse('src/layouts/DashboardLayout.tsx');
  const declarations = new Map();
  function visit(node) { if (ts.isVariableDeclaration(node)) declarations.set(node.name.getText(sf), node.initializer?.getText(sf)); ts.forEachChild(node, visit); }
  visit(sf);
  for (const isAuthenticated of [true, false]) {
    const context = {isAuthenticated, debouncedSearchTerm: 'term', normalizedSearchTerm: 'term', useMemo: fn => fn(), SEARCH_PERMISSION_FEATURES: {articles: 'article', documents: 'document'},
      hasPermission: feature => feature === 'article', searchResults: {results: [{type: 'articles', id: 'allowed'}, {type: 'documents', id: 'forbidden', snippet: 'private'}, {type: 'unknown', id: 'unknown'}], meta: {total_results: 999}}};
    runInNewContext(`const visibleSearchResults = ${declarations.get('visibleSearchResults')}; result = {rows: visibleSearchResults, count: ${declarations.get('searchResultCount')}};`, context);
    assert.equal(context.result.count, isAuthenticated ? 1 : 0);
    assert.doesNotMatch(JSON.stringify(context.result), /private|forbidden|unknown|999/);
  }
});
test('new landing, publication and permission labels exist in both languages', () => {
  for (const locale of ['en', 'fr']) {
    const dictionary = JSON.parse(read(`src/i18n/locales/${locale}.json`));
    for (const key of ['homePage.moduleLandingTitle', 'homePage.moduleLandingDescription', 'contentListing.creationPublicationPolicy', 'contentListing.existingPublicationPolicy', 'adminPanelPage.memberPermissions.savePermissions', 'adminPanelPage.memberPermissions.finalPermissionsUnavailable', 'adminPanelPage.memberPermissions.missingRecordId', 'adminPanelPage.memberPermissions.refreshing']) {
      assert.equal(typeof key.split('.').reduce((value, part) => value?.[part], dictionary), 'string', `${locale}: ${key}`);
    }
  }
});

test('status field explains initial creation versus existing publication without removing valid choices', () => {
  const sf = parse('src/components/ui/ContentListing.tsx');
  const node = sf.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ContentStatusField');
  for (const existing of [false, true]) {
    let ids = 0;
    const changes = [];
    const context = {React: {createElement: (type, props, ...children) => ({type, props: {...props, children}})}, useId: () => `id-${ids++}`, useI18n: () => ({translate}), existing, onChange: value => changes.push(value)};
    runInNewContext(ts.transpileModule(`${node.getText(sf).replace('export ', '')}\nresult = ContentStatusField({value: 'draft', existing, onChange});`, {compilerOptions: {target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React}}).outputText, context);
    assert.match(JSON.stringify(context.result), existing ? /requires Edit permission and ownership/ : /new Draft or Published/);
    assert.deepEqual(elements(context.result, 'option').map(option => option.props.value), ['published', 'draft']);
    elements(context.result, 'select')[0].props.onChange({target: {value: 'published'}});
    assert.deepEqual(changes, ['published']);
  }
});
