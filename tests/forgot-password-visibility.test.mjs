import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const source = read('src/pages/ForgotPassword.tsx');
const sf = ts.createSourceFile('ForgotPassword.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = sf.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'ForgotPassword');
const code = ts.transpileModule(component.getText(sf).replace('export default ', ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;

function harness({ reset = true, loading = false } = {}) {
  const state = [], errors = [], requests = [], navigations = [], timers = [];
  let cursor = 0;
  const en = JSON.parse(read('src/i18n/locales/en.json'));
  const translate = (key) => {
    const value = key.split('.').reduce((entry, part) => entry?.[part], en);
    assert.equal(typeof value, 'string', `Missing existing translation: ${key}`);
    return value;
  };
  const context = {
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment' },
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useId: () => ':password:', useEffect() {},
    useLocation: () => ({ state: reset ? { email: 'member@example.test', sessionKey: 'session' } : {} }),
    useNavigate: () => (...args) => navigations.push(args), useI18n: () => ({ translate }),
    useAppToast: () => ({ error: (error) => errors.push(error) }),
    useSendOtpMutation: () => [() => { throw new Error('Unexpected OTP request'); }, { isLoading: false }],
    useForgotPasswordMutation: () => [(payload) => ({ unwrap: async () => { requests.push(payload); return { message: 'Done' }; } }), { isLoading: loading }],
    motion: { div: 'motion.div' }, setTimeout: (callback, delay) => timers.push({ callback, delay }),
  };
  for (const name of ['Link', 'LanguageSwitcher', 'Mail', 'Lock', 'Eye', 'EyeOff', 'Send', 'CheckCircle2', 'ArrowLeft']) context[name] = name;
  runInNewContext(`${code}; result = ForgotPassword;`, context);
  return { errors, requests, navigations, timers, render() { cursor = 0; return context.result(); } };
}
function all(tree, type) {
  const result = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node?.props) return;
    if (node.type === type) result.push(node);
    visit(node.props.children);
  }
  visit(tree); return result;
}
const fields = (tree) => all(tree, 'input').filter((node) => node.props.type !== 'email');
const toggles = (tree) => all(tree, 'button').filter((node) => node.props.type === 'button');

test('password toggles are independent, reversible and preserve typed values and input bindings', () => {
  const h = harness(); let tree = h.render();
  assert.deepEqual(fields(tree).map((node) => node.props.type), ['password', 'password']);
  fields(tree)[0].props.onChange({ target: { value: 'New password 123!' } });
  fields(tree)[1].props.onChange({ target: { value: 'Confirmation 456!' } });
  tree = h.render(); const originalIds = fields(tree).map((node) => node.props.id);
  for (const [index, expected] of [[0, ['text', 'password']], [1, ['text', 'text']], [0, ['password', 'text']], [1, ['password', 'password']]]) {
    toggles(tree)[index].props.onClick(); tree = h.render();
    assert.deepEqual(fields(tree).map((node) => node.props.type), expected);
    assert.deepEqual(fields(tree).map((node) => node.props.value), ['New password 123!', 'Confirmation 456!']);
    assert.deepEqual(fields(tree).map((node) => node.props.id), originalIds);
    for (const input of fields(tree)) { assert.equal(input.props.required, true); assert.equal(input.props.autoComplete, undefined); }
  }
  assert.equal(h.requests.length, 0); assert.equal(h.errors.length, 0);
});

test('toggle buttons have translated field-specific names, icon state, focus styling and pointer focus preservation', () => {
  const h = harness(); let tree = h.render();
  const names = toggles(tree).map((node) => node.props['aria-label']);
  assert.equal(new Set(names).size, 2); assert.ok(names.every((name) => name.startsWith('Show password:')));
  for (const [index, button] of toggles(tree).entries()) {
    assert.equal(button.props['aria-controls'], fields(tree)[index].props.id);
    assert.equal(button.props['aria-pressed'], false);
    assert.equal(all(button, 'Eye').length, 1); assert.equal(all(button, 'Eye')[0].props['aria-hidden'], 'true');
    assert.match(button.props.className, /focus-visible:ring-2/);
    assert.match(fields(tree)[index].props.className, /pr-12/);
    let prevented = false; button.props.onMouseDown({ preventDefault: () => { prevented = true; } }); assert.equal(prevented, true);
    button.props.onClick();
  }
  tree = h.render();
  for (const button of toggles(tree)) { assert.equal(button.props['aria-pressed'], true); assert.match(button.props['aria-label'], /^Hide password:/); assert.equal(all(button, 'EyeOff').length, 1); }
  assert.equal(toggles(harness({ reset: false }).render()).length, 0);
});

test('visibility changes preserve password matching, reset payload, loading gate and success navigation', async () => {
  const h = harness({ loading: true }); let tree = h.render();
  assert.equal(all(tree, 'button').find((node) => node.props.type === 'submit').props.disabled, true);
  fields(tree)[0].props.onChange({ target: { value: 'Original password 123!' } });
  fields(tree)[1].props.onChange({ target: { value: 'Mismatch' } });
  toggles(tree)[0].props.onClick(); tree = h.render();
  const event = { preventDefault() {} };
  await all(tree, 'form')[0].props.onSubmit(event);
  assert.equal(h.requests.length, 0); assert.equal(h.errors.length, 1);
  fields(tree)[1].props.onChange({ target: { value: 'Original password 123!' } });
  toggles(tree)[1].props.onClick(); tree = h.render();
  await all(tree, 'form')[0].props.onSubmit(event);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests[0])), { email: 'member@example.test', new_password: 'Original password 123!', session_key: 'session' });
  assert.equal(h.timers[0].delay, 1800); h.timers[0].callback(); assert.deepEqual(h.navigations, [['/login']]);
});
