import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

for (const [page, hook, param] of [
  ['ArticleDetail', 'useGetArticleByIdQuery', 'slug'],
  ['TechnicoProDetail', 'useGetTechnicoProByIdQuery', 'technicoproId'],
  ['TrainingDetail', 'useGetTrainingByIdQuery', 'trainingId'],
]) {
  const source = readFileSync(new URL(`../src/pages/${page}.tsx`, import.meta.url), 'utf8');
  const parsed = ts.createSourceFile(page, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const code = parsed.statements.filter((node) => !ts.isImportDeclaration(node)).map((node) => node.getText(parsed)).join('\n')
    .replace('export default function', 'function');
  const render = (query) => {
    const context = {
      React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
      useParams: () => ({ [param]: 'restricted-next-record' }), useNavigate: () => () => {},
      useI18n: () => ({ localeCode: 'en', translate: (key) => key }),
      [hook]: () => query, useGetArticlesQuery: () => ({}), AccessRestrictedNotice: 'restricted',
      FileIcon: 'file', normalizeAttachments: () => [], formatDetailDate: () => '',
      ...Object.fromEntries(['ContentDetailLayout', 'DetailHeader', 'DetailMetadataItem', 'RichContentRenderer', 'DetailAttachments', 'DetailUpdated', 'DetailSection'].map(name => [name, name])),
    };
    runInNewContext(ts.transpileModule(`${code}\nresult = ${page}();`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText, context);
    return context.result;
  };

  test(`${page}: navigating to an unresolved ID hides the previous response and shows loading`, () => {
    const tree = render({ data: { id: 'previous', title: 'Previous private record' }, currentData: undefined, isLoading: false, isFetching: true });
    assert.match(JSON.stringify(tree), /animate-spin/);
    assert.doesNotMatch(JSON.stringify(tree), /Previous private record/);
  });

  test(`${page}: a denied new ID shows restricted access without the previous record`, () => {
    const tree = render({ data: { id: 'previous', title: 'Previous private record' }, currentData: undefined, isLoading: false, isFetching: false, isError: true, error: { status: 403 } });
    assert.match(JSON.stringify(tree), /restricted/);
    assert.doesNotMatch(JSON.stringify(tree), /Previous private record/);
  });

  for (const status of [404, 'FETCH_ERROR']) {
    test(`${page}: ${status} preserves error state without stale content`, () => {
      const tree = render({data: {id: 'previous', title: 'Previous private record'}, currentData: undefined, isLoading: false, isFetching: false, isError: true, error: {status}});
      assert.match(JSON.stringify(tree), /notFound|NotFound/);
      assert.doesNotMatch(JSON.stringify(tree), /Previous private record/);
    });
  }
  test(`${page}: a resolved current response renders the requested record`, () => {
    const tree = render({data: {id: 'previous', title: 'Previous private record'}, currentData: {id: 'restricted-next-record', title: 'Allowed current record', status: 'published', created_at: '2026-01-01'}, isLoading: false, isFetching: false, isError: false});
    assert.match(JSON.stringify(tree), /Allowed current record/);
    assert.doesNotMatch(JSON.stringify(tree), /Previous private record/);
  });
}
