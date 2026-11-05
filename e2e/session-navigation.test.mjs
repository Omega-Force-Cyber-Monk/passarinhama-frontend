import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Uses the already installed Playwright browser with Node's existing test runner.
// Start Vite first, then: node --test e2e/session-navigation.test.mjs
const origin = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const en = JSON.parse(readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'));
const fr = JSON.parse(readFileSync(new URL('../src/i18n/locales/fr.json', import.meta.url), 'utf8'));
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });
const paged = (results = []) => ({ results, total: results.length, total_pages: 1, page: 1, page_size: 20 });
const user = (extra = {}) => ({ id: 'owner', email: 'member@example.test', first_name: 'Test', last_name: 'Member', role: 'membre', status: 'active', is_deleted: false, is_superuser: false,
  permissions: ['article', 'event', 'forum', 'document', 'training', 'technicopro', 'user'].map((feature) => ({ feature, can_view: true, can_create: true, can_edit: true, can_delete: true })), user_permissions: [], ...extra });
const creator = { id: 'owner', first_name: 'Test', last_name: 'Member' };
const date = new Date().toISOString().slice(0, 10);
const category = { id: 'category', name: 'Test category', color_code: '#F2C41E' };
const event = { id: 'event', title: 'Test event', event_date: date, end_date: date, event_time: '14:00', location: 'Test location', description: '<p>Event content</p>',
  event_category: category, event_category_id: category.id, max_attendees: 50, attendee_count: 0, spots_left: 50, is_public: false, status: 'published', attachments: [], created_by: creator };
const training = { id: 'training', title: 'Test training', excerpt: 'Course overview', description: '<p>Course content</p>', category, category_id: category.id, status: 'published', thumbnail_url: null, attachments: [], created_by: creator, created_at: date };
const forum = { id: 'forum', name: 'Test forum', slug: 'test-forum', description: 'Forum content', forum_type: 'general', author_name: 'Test', thumbnail_url: null, topic_count: 1, post_count: 0, can_post: true, last_activity_at: date };
const topic = { id: 'topic', title: 'Test discussion', content: '<p>Discussion content</p>', author: creator, attachment: [], is_pinned: false, is_locked: false, view_count: 0, reply_count: 0, last_activity_at: date, created_at: date };

async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ token, language }) => {
    if (token) localStorage.setItem('token', token);
    localStorage.setItem('archicopro-language', language);
    // Deliberately stale grants must never authorize before /me.
    localStorage.setItem('user', JSON.stringify({ id: 'stale', is_superuser: true }));
  }, { token: options.anonymous ? null : 'test-token', language: options.language || 'en' });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  const state = { profile: options.profile || user(), meCount: 0, meStatus: options.meStatus || 200, offline: options.offline || false,
    folder: true, deletes: 0, deleteStatus: 200, foldersRead: 0, requests: [], holdMe: options.holdMe, delayModule: options.delayModule,
    failModule: options.failModule || false, holdTraining: options.holdTraining };
  await page.route('**/*', async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (url.origin === origin) {
      if (state.failModule && path === '/src/pages/Trainings.tsx') { state.failModule = false; return route.abort('failed'); }
      if (state.delayModule && path === '/src/pages/Trainings.tsx') await state.delayModule;
      return route.continue();
    }
    if (request.resourceType() !== 'fetch') return route.abort();
    state.requests.push(`${request.method()} ${path}`);
    let data = paged(), status = 200;
    if (path === '/auth/login') data = { status: 'active', access_token: 'new-token', refresh_token: 'refresh' };
    else if (path === '/user/users/me') {
      state.meCount++; if (state.holdMe) await state.holdMe;
      if (state.offline) return route.abort('failed');
      status = state.meStatus; data = state.profile;
    } else if (path.endsWith('/online')) data = { users: [] };
    else if (path === '/user/users') data = { ...paged(), counts: { all: 0, active: 0, suspended: 0 } };
    else if (path === '/documents/documents/folders') {
      state.foldersRead++;
      data = state.folder ? [{ id: 'folder', name: 'Test folder', parent_id: null, can_upload: false, document_count: 0, children: [] }] : [];
    } else if (path === '/documents/documents/folders/folder' && request.method() === 'DELETE') {
      state.deletes++; status = state.deleteStatus;
      if (status === 200) state.folder = false;
      data = {};
    } else if (path === '/documents/documents') data = { folder: { id: 'folder', name: 'Test folder', can_upload: false }, documents: [] };
    else if (path.includes('/categories')) data = paged([category]);
    else if (path === '/events/events' || path === '/events/events/upcoming') data = [event];
    else if (path === '/events/events/event') data = event;
    else if (path.endsWith('/registrations')) data = { registrations: [] };
    else if (path === '/trainings/trainings') { if (state.holdTraining) await state.holdTraining; data = paged([training]); }
    else if (path === '/trainings/trainings/training') data = training;
    else if (path === '/forums/forums') data = paged([forum]);
    else if (path === '/forums/forums/forum') data = forum;
    else if (path.endsWith('/pinned')) data = [];
    else if (path === '/forums/forums/forum/topics') data = paged([topic]);
    else if (path === '/forums/topics/topic/posts') data = { ...paged(), topic: { ...topic, forum_id: 'forum' } };
    else if (path === '/user/roles') data = [];
    if (status >= 400) data = { detail: 'Mocked server failure' };
    await route.fulfill({ status, json: data });
  });
  return { page, state, errors, close: () => context.close() };
}
const gate = () => { let release; const promise = new Promise((resolve) => { release = resolve; }); return { promise, release }; };
async function menu(page, path, label) {
  if (['/articles', '/forums', '/trainings', '/technicopro'].includes(path)) {
    const toggle = page.locator('nav').getByRole('button', { name: label, exact: true });
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  }
  await page.locator(`nav a[href="${path}"]`).click();
  await page.waitForURL((url) => url.pathname === path);
}

test('delayed /me shows one full-screen spinner, never denial or protected content', async () => {
  const pending = gate(), f = await fixture({ holdMe: pending.promise });
  try {
    await f.page.goto(`${origin}/trainings`);
    await f.page.getByRole('status').waitFor();
    assert.equal(await f.page.getByText(en.common.accessRestrictedTitle, { exact: true }).count(), 0);
    assert.equal(await f.page.locator('nav').count(), 0);
    pending.release(); await f.page.getByRole('heading', { name: 'Training', exact: true }).waitFor();
    assert.equal(f.state.meCount, 1);
    assert.deepEqual(f.errors, []);
  } finally { pending.release(); await f.close(); }
});

test('confirmed denial stays at destination; anonymous login restores destination', async () => {
  let f = await fixture({ profile: user({ permissions: [], user_permissions: [] }) });
  try {
    await f.page.goto(`${origin}/trainings`);
    await f.page.getByRole('heading', { name: en.common.accessRestrictedTitle }).waitFor();
    assert.equal(new URL(f.page.url()).pathname, '/trainings');
    assert.equal(f.state.requests.some((r) => r.includes('/trainings/trainings')), false);
  } finally { await f.close(); }
  f = await fixture({ anonymous: true });
  try {
    await f.page.goto(`${origin}/trainings?status=draft`);
    await f.page.waitForURL('**/login');
    await f.page.locator('form button[type="submit"]').click();
    await f.page.waitForURL('**/trainings?status=draft');
    await f.page.getByRole('heading', { name: 'Training', exact: true }).waitFor();
    assert.equal(f.state.meCount, 1);
  } finally { await f.close(); }
});

test('profile network and 403 failures show retry instead of denial/login; retry recovers', async () => {
  for (const options of [{ offline: true }, { meStatus: 403 }]) {
    const f = await fixture(options);
    try {
      await f.page.goto(`${origin}/agenda`);
      await f.page.getByRole('heading', { name: en.sessionError.title }).waitFor();
      assert.equal(new URL(f.page.url()).pathname, '/agenda');
      assert.equal(await f.page.getByText(en.common.accessRestrictedTitle, { exact: true }).count(), 0);
      f.state.offline = false; f.state.meStatus = 200;
      await f.page.getByRole('button', { name: en.routeError.tryAgain }).click();
      await f.page.getByRole('heading', { name: en.agendaPage.title }).waitFor();
      assert.equal(f.state.meCount, 2);
    } finally { await f.close(); }
  }
});

test('confirmed 401 reaches login, and active superusers retain Administration and folder delete actions', async () => {
  let f = await fixture({ meStatus: 401 });
  try {
    await f.page.goto(`${origin}/documents`);
    await f.page.waitForURL('**/login');
    assert.equal(await f.page.getByText(en.common.accessRestrictedTitle, { exact: true }).count(), 0);
  } finally { await f.close(); }
  f = await fixture({ profile: user({ is_superuser: true, permissions: [] }) });
  try {
    await f.page.goto(`${origin}/documents`);
    await f.page.locator('.documents-folder-card').getByRole('button', { name: en.documentLibraryPage.delete, exact: true }).waitFor();
    await menu(f.page, '/admin', en.common.administration);
    await f.page.locator('.admin-page').waitFor();
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});

test('all ordinary sidebar destinations render, preserve cache, and support rapid/back/forward navigation', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/agenda`);
    await f.page.getByRole('heading', { name: en.agendaPage.title }).waitFor();
    for (const [path, label, selector] of [
      ['/articles', 'Articles', '.content-page-title'], ['/forums', 'Forums', '.forums-page'],
      ['/trainings', 'Training', '.content-page-title'], ['/technicopro', 'TechnicoPro', '.content-page-title'],
      ['/documents', 'Documents', '.documents-page'], ['/directory', 'Members', '.member-directory-page'],
      ['/', 'Home', '.home-page'], ['/agenda', 'Agenda', '.agenda-page'],
    ]) {
      await menu(f.page, path, label);
      await f.page.locator(selector).first().waitFor();
      assert.equal(await f.page.getByRole('heading', { name: en.routeError.title }).count(), 0, path);
    }
    await menu(f.page, '/documents', 'Documents');
    await menu(f.page, '/agenda', 'Agenda');
    await f.page.goBack(); await f.page.locator('.documents-page').waitFor();
    await f.page.goForward(); await f.page.locator('.agenda-page').waitFor();
    await f.page.locator('nav').evaluate((nav) => {
      nav.querySelector('a[href="/documents"]').click(); nav.querySelector('a[href="/agenda"]').click(); nav.querySelector('a[href="/documents"]').click();
    });
    await f.page.waitForURL('**/documents'); await f.page.locator('.documents-page').waitFor();
    assert.equal(f.state.meCount, 1);
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});

test('delayed lazy destination shows route spinner and navigation can leave it', async () => {
  const pending = gate(), f = await fixture({ delayModule: pending.promise });
  try {
    await f.page.goto(`${origin}/agenda`); await f.page.getByRole('heading', { name: en.agendaPage.title }).waitFor();
    await menu(f.page, '/trainings', 'Training');
    await f.page.getByRole('status').waitFor();
    assert.equal(await f.page.getByRole('heading', { name: en.agendaPage.title }).count(), 0);
    await menu(f.page, '/documents', 'Documents'); await f.page.locator('.documents-page').waitFor();
    pending.release();
    await menu(f.page, '/trainings', 'Training'); await f.page.getByRole('heading', { name: 'Training', exact: true }).waitFor();
  } finally { pending.release(); await f.close(); }
});

test('delayed page API does not block another navigation or allow late data to replace the destination', async () => {
  const pending = gate(), f = await fixture({ holdTraining: pending.promise });
  try {
    await f.page.goto(`${origin}/trainings`);
    await f.page.getByRole('heading', { name: 'Training', exact: true }).waitFor();
    await menu(f.page, '/documents', 'Documents'); await f.page.locator('.documents-page').waitFor();
    pending.release();
    await f.page.locator('.documents-folder-card').waitFor();
    assert.equal(new URL(f.page.url()).pathname, '/documents');
    assert.equal(await f.page.getByRole('heading', { name: 'Training', exact: true }).count(), 0);
  } finally { pending.release(); await f.close(); }
});

test('a failed lazy import renders an error and allows navigation to a working destination', async () => {
  const f = await fixture({ failModule: true });
  try {
    await f.page.goto(`${origin}/agenda`); await f.page.getByRole('heading', { name: en.agendaPage.title }).waitFor();
    await menu(f.page, '/trainings', 'Training');
    await f.page.getByRole('heading', { name: en.routeError.title }).waitFor();
    await menu(f.page, '/documents', 'Documents'); await f.page.locator('.documents-page').waitFor();
  } finally { await f.close(); }
});

test('folder delete grants, overrides, confirmation cancellation, failure and success refresh work', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/documents`);
    const action = f.page.locator('.documents-folder-card').getByRole('button', { name: en.documentLibraryPage.delete, exact: true });
    await action.click();
    await f.page.getByRole('alertdialog').getByRole('button', { name: en.common.cancel, exact: true }).click();
    assert.equal(f.state.deletes, 0);
    f.state.deleteStatus = 403;
    await action.click(); await f.page.getByRole('alertdialog').getByRole('button', { name: en.common.confirm, exact: true }).click();
    await f.page.getByText('Mocked server failure', { exact: true }).waitFor();
    assert.equal(await f.page.locator('.documents-folder-card').count(), 1);
    f.state.deleteStatus = 200;
    await action.click(); await f.page.getByRole('alertdialog').getByRole('button', { name: en.common.confirm, exact: true }).click();
    await f.page.locator('.documents-folder-card').waitFor({ state: 'detached' });
    assert.equal(f.state.deletes, 2); assert.ok(f.state.foldersRead >= 3);
  } finally { await f.close(); }
  const denied = await fixture({ profile: user({ user_permissions: [{ feature: 'document', can_delete: false }] }) });
  try {
    await denied.page.goto(`${origin}/documents`); await denied.page.locator('.documents-folder-card').waitFor();
    assert.equal(await denied.page.locator('.documents-folder-card').getByRole('button', { name: en.documentLibraryPage.delete, exact: true }).count(), 0);
  } finally { await denied.close(); }
});

for (const [language, dictionary] of [['en', en], ['fr', fr]]) {
  test(`${language}: Agenda create/edit and Trainings create/edit/details use localized labels`, async () => {
    const f = await fixture({ language });
    try {
      await f.page.goto(`${origin}/agenda`);
      await f.page.getByRole('button', { name: dictionary.agendaPage.newEvent, exact: true }).click();
      let dialog = f.page.getByRole('dialog');
      await dialog.getByRole('heading', { name: dictionary.agendaPage.createNewEvent }).waitFor();
      await dialog.getByRole('button', { name: dictionary.editor.bold, exact: true }).waitFor();
      await f.page.keyboard.press('Escape');
      await f.page.getByRole('button').filter({ hasText: 'Test event' }).first().click();
      await f.page.getByRole('dialog').waitFor();
      await f.page.getByRole('dialog').getByRole('button', { name: /Edit|Modifier/ }).first().click();
      dialog = f.page.getByRole('dialog');
      await dialog.getByRole('heading', { name: dictionary.agendaPage.editEvent }).waitFor();
      await dialog.getByRole('button', { name: dictionary.agendaPage.saveEvent, exact: true }).waitFor();
      await f.page.keyboard.press('Escape');
      await menu(f.page, '/trainings', dictionary.common.training);
      await f.page.getByRole('button', { name: dictionary.trainingsPage.createTraining, exact: true }).click();
      dialog = f.page.getByRole('dialog');
      await dialog.getByRole('heading', { name: dictionary.trainingsPage.createTraining }).waitFor();
      assert.equal(await dialog.getByRole('button', { name: dictionary.trainingsPage.trainingProposed }).count(), 0);
      await dialog.locator('[data-placeholder]').waitFor();
      assert.equal(await dialog.locator('[data-placeholder]').getAttribute('data-placeholder'), dictionary.trainingsPage.descriptionPlaceholder);
      await f.page.keyboard.press('Escape');
      await f.page.getByRole('button', { name: dictionary.trainingsPage.editTraining, exact: true }).click();
      await f.page.getByRole('dialog').getByRole('button', { name: dictionary.trainingsPage.saveTraining, exact: true }).waitFor();
      await f.page.keyboard.press('Escape');
      await f.page.getByRole('button', { name: /Test training/ }).first().click();
      await f.page.waitForURL('**/trainings/training');
      await f.page.getByRole('heading', { name: 'Test training', exact: true }).waitFor();
      assert.deepEqual(f.errors, []);
    } finally { await f.close(); }
  });
}

test('open modal labels and placeholders react to language changes while unsaved inputs survive', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/trainings`);
    await f.page.getByRole('button', { name: en.trainingsPage.createTraining, exact: true }).click();
    await f.page.getByRole('dialog').getByLabel(en.trainingsPage.trainingTitle, { exact: true }).fill('Unsaved course');
    // Trigger the real provider through its switcher while the modal owns focus.
    await f.page.locator('button').filter({ hasText: /^FR$/ }).evaluate((button) => button.click());
    await f.page.getByRole('dialog').getByRole('heading', { name: fr.trainingsPage.createTraining }).waitFor();
    assert.equal(await f.page.getByRole('dialog').getByLabel(fr.trainingsPage.trainingTitle, { exact: true }).inputValue(), 'Unsaved course');
    assert.equal(await f.page.getByRole('dialog').locator('[data-placeholder]').getAttribute('data-placeholder'), fr.trainingsPage.descriptionPlaceholder);
    await f.page.keyboard.press('Escape');
    await menu(f.page, '/agenda', fr.common.agenda);
    await f.page.getByRole('button', { name: fr.agendaPage.newEvent, exact: true }).click();
    await f.page.getByRole('dialog').getByLabel(fr.agendaPage.eventTitle, { exact: true }).fill('Unsaved event');
    await f.page.locator('button').filter({ hasText: /^EN$/ }).evaluate((button) => button.click());
    await f.page.getByRole('dialog').getByRole('heading', { name: en.agendaPage.createNewEvent }).waitFor();
    assert.equal(await f.page.getByRole('dialog').getByLabel(en.agendaPage.eventTitle, { exact: true }).inputValue(), 'Unsaved event');
    await f.page.getByRole('dialog').getByRole('button', { name: en.editor.bold, exact: true }).waitFor();
  } finally { await f.close(); }
});

test('discussion cards keep mouse and keyboard navigation after removing arrows', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${origin}/forums`);
    await f.page.locator('.forum-list-card').filter({ hasText: 'Test forum' }).click();
    await f.page.waitForURL('**/forums/forum');
    const row = f.page.locator('.forum-topic-card').filter({ hasText: 'Test discussion' });
    await row.waitFor(); assert.equal(await row.locator('svg.lucide-arrow-right').count(), 0);
    await row.focus(); await f.page.keyboard.press('Enter');
    await f.page.waitForURL('**/forums/forum/topics/topic');
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});
