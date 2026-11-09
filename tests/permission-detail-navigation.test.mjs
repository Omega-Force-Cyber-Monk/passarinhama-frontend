import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

for (const [page, hook, param] of [
  ['ArticleDetail', 'useGetArticleByIdQuery', 'slug'],
  ['TechnicoProDetail', 'useGetTechnicoProByIdQuery', 'technicoproId'],
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
}
