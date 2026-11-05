import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const parse = (path) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(root, predicate) { const result = []; const visit = (node) => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }; visit(root); return result; }
const value = (dict, key) => key.split('.').reduce((v, part) => v?.[part], dict);
const dictionaries = Object.fromEntries(['en', 'fr'].map((language) => [language, JSON.parse(read(`src/i18n/locales/${language}.json`))]));
function evaluate(expression, context) {
  runInNewContext(ts.transpileModule(`result = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
  return context.result;
}

test('Agenda, Trainings, editor, confirmation, uploads and detail labels have real English/French keys', () => {
  for (const path of ['src/pages/Agenda/Agenda.tsx', 'src/pages/Trainings.tsx', 'src/pages/TrainingDetail.tsx',
    'src/components/ui/TiptapEditor.tsx', 'src/components/ui/Modal.tsx', 'src/components/ui/ConfirmModal.tsx',
    'src/components/ui/FileUploadPreview.tsx', 'src/components/ui/ContentListing.tsx', 'src/components/ui/ContentDetail.tsx']) {
    const sf = parse(path);
    for (const call of find(sf, (n) => ts.isCallExpression(n) && n.expression.getText(sf) === 'translate')) {
      const key = call.arguments[0];
      if (!ts.isStringLiteral(key)) continue;
      for (const language of ['en', 'fr']) assert.equal(typeof value(dictionaries[language], key.text), 'string', `${language}: ${path}: ${key.text}`);
    }
  }
});

test('the actual i18n provider switches languages on rerender, interpolates and falls back to English', () => {
  const sf = parse('src/i18n/index.tsx');
  let language = 'en';
  const messages = structuredClone(dictionaries);
  const context = { messages, getInitialLanguage: () => 'en', I18nContext: { Provider: 'provider' },
    enUS: {}, fr: {}, useState: () => [language, (next) => { language = next; }], useEffect() {},
    useMemo: (fn) => fn(), useCallback: (fn) => fn, React: { createElement: (type, props) => ({ type, props }) } };
  for (const name of ['getMessageValue', 'interpolate']) {
    const declaration = find(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === name)[0];
    context[name] = evaluate(declaration.initializer.getText(sf), context);
  }
  const node = find(sf, (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'I18nProvider')[0];
  const provider = evaluate(node.getText(sf).replace('export ', ''), context);
  let i18n = provider({ children: null }).props.value;
  assert.equal(i18n.translate('agendaPage.editEvent'), 'Edit Event');
  i18n.setLanguage('fr'); i18n = provider({ children: null }).props.value;
  assert.equal(i18n.translate('agendaPage.editEvent'), 'Modifier l’événement');
  assert.equal(i18n.translate('trainingsPage.saveTraining'), dictionaries.fr.trainingsPage.saveTraining);
  assert.equal(i18n.translate('common.requiredField', { field: 'Titre' }), dictionaries.fr.common.requiredField.replace('{field}', 'Titre'));
  delete messages.fr.agendaPage.editEvent;
  assert.equal(i18n.translate('agendaPage.editEvent'), 'Edit Event');
  assert.equal(i18n.translate('missing.unknown'), 'missing.unknown');
});

test('editor placeholder decorations follow changed language without discarding content', () => {
  const sf = parse('src/components/ui/TiptapEditor.tsx');
  const effects = []; let options; let placeholderRef;
  const extension = { configure: (config) => ({ config }) };
  const editor = { getHTML: () => '<p>Unsaved</p>', commands: { setContent() { throw new Error('Language change reset editor content'); } },
    state: { tr: {} }, view: { dispatch() { editor.refreshed = true; } } };
  const context = { useI18n: () => ({ translate: (key) => value(dictionaries[language], key) }),
    useRef: (initial) => placeholderRef ??= { current: initial }, useEffect: (fn) => effects.push(fn),
    useEditor: (next) => { options = next; return editor; }, cn: () => '',
    React: { createElement: () => null }, Toolbar: 'toolbar', EditorContent: 'editor' };
  for (const name of ['StarterKit', 'Underline', 'Link', 'Image', 'Table', 'TableRow', 'TableHeader', 'TableCell', 'Placeholder', 'YouTubeEmbed']) context[name] = extension;
  const declaration = find(sf, (n) => ts.isVariableDeclaration(n) && n.name.getText(sf) === 'TiptapEditor')[0];
  const component = evaluate(declaration.initializer.getText(sf), context);
  let language = 'en';
  component({ content: '<p>Unsaved</p>', onChange() {} });
  const placeholder = options.extensions.find((e) => e.config?.emptyEditorClass).config.placeholder;
  assert.equal(placeholder(), 'Write something...');
  language = 'fr'; component({ content: '<p>Unsaved</p>', onChange() {} });
  effects.forEach((fn) => fn());
  assert.equal(placeholder(), 'Écrivez votre texte...');
  assert.equal(editor.refreshed, true);
});

test('discussion rows retain keyboard navigation with no right-arrow wrapper', () => {
  const source = read('src/pages/Forums.tsx');
  assert.doesNotMatch(source, /<ArrowRight/);
  assert.match(source, /onClick=\{\(\) => handleNavigateToTopic\(topic.id\)\}/);
  assert.match(source, /event.key === "Enter"[\s\S]*handleNavigateToTopic\(topic.id\)/);
});

test('a stalled lazy import reaches a recoverable error, clears its timer and can be retried', async () => {
  const sf = parse('src/utils/lazyPage.tsx');
  let timeout, attempts = 0, cleared = 0;
  const context = { lazy: (load) => ({ load }), setTimeout: (fn) => { timeout = fn; return 1; }, clearTimeout: () => { cleared++; },
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) }, Suspense: 'suspense', LoadingIndicator: 'loading' };
  const declaration = find(sf, (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'lazyPage')[0];
  const makePage = evaluate(declaration.getText(sf).replace('export ', ''), context);
  const module = { default: () => null };
  const page = makePage(() => ++attempts === 1 ? new Promise(() => {}) : Promise.resolve(module));
  const pending = page().props.children[0].type.load();
  timeout();
  await assert.rejects(pending, { name: 'PageLoadTimeout' });
  assert.equal(await page().props.children[0].type.load(), module);
  assert.equal(attempts, 2); assert.equal(cleared, 2);
});
