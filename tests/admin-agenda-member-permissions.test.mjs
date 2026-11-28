import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { readAdminCount } from '../src/pages/admin/adminCounts.ts';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { store } = await import('../src/redux/store.ts');
const auth = await import('../src/redux/features/auth/authSlice.ts');
const { eventsApi } = await import('../src/redux/features/events/eventsApi.ts');
const { membersApi } = await import('../src/redux/features/members/membersApi.ts');

const actor = { id: 'test-admin', status: 'active', is_deleted: false, is_superuser: true,
  role: 'ordinary-role-name', permissions: [], user_permissions: [] };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const selectStats = () => eventsApi.endpoints.getCalendarStats.select()(store.getState());
const count = () => { const query = selectStats(); return readAdminCount({ ...query, isFetching: query.status === 'pending' }, false, 'events_this_year'); };
async function fixture(fetch, run) {
  const original = globalThis.fetch;
  store.dispatch(auth.logout());
  store.dispatch(auth.setCredentials({ access_token: 'test-token' }));
  store.dispatch(auth.sessionResolved({ user: actor, sessionVersion: store.getState().auth.sessionVersion }));
  globalThis.fetch = fetch;
  try { await run(); } finally { store.dispatch(auth.logout()); globalThis.fetch = original; }
}
function until(predicate) {
  return new Promise(resolve => {
    const unsubscribe = store.subscribe(() => { if (predicate()) { unsubscribe(); resolve(); } });
    if (predicate()) { unsubscribe(); resolve(); }
  });
}

test('annual count validates its existing field, zero, missing metadata and cached error separately', () => {
  const query = { data: { events_this_year: 31, total: 999 }, isError: false, isFetching: false };
  assert.deepEqual(readAdminCount(query, false, 'events_this_year'), { value: 31, status: 'ready' });
  assert.deepEqual(readAdminCount({ ...query, data: { events_this_year: 0 } }, false, 'events_this_year'), { value: 0, status: 'ready' });
  assert.deepEqual(readAdminCount({ ...query, isError: true }, false, 'events_this_year'), { value: 31, status: 'stale' });
  for (const data of [{ total: 999 }, { events_this_year: -1 }, { events_this_year: '31' }, []]) {
    assert.equal(readAdminCount({ ...query, data }, false, 'events_this_year').status, 'unavailable');
  }
});

test('annual count subscribers share one request; failure retains the last valid value', { timeout: 5000 }, async () => {
  const gate = deferred(); let reads = 0, fail = false;
  await fixture(async request => {
    assert.equal(new URL(request.url).pathname, '/events/events/calendar-stats');
    reads++; if (reads === 1) await gate.promise;
    return fail ? json({ detail: 'Stats unavailable' }, 500) : json({ events_this_year: 0 });
  }, async () => {
    const first = store.dispatch(eventsApi.endpoints.getCalendarStats.initiate());
    const second = store.dispatch(eventsApi.endpoints.getCalendarStats.initiate());
    try {
      assert.equal(count().status, 'loading');
      gate.resolve(); await Promise.all([first, second]);
      assert.equal(reads, 1); assert.equal(count().value, 0);
      fail = true; await first.refetch();
      assert.deepEqual(count(), { value: 0, status: 'stale' });
    } finally { gate.resolve(); first.unsubscribe(); second.unsubscribe(); }
  });
});

test('event create, delete and date update each refresh the subscribed annual count once', { timeout: 5000 }, async () => {
  let annual = 10, reads = 0; const writes = [];
  await fixture(async request => {
    const path = new URL(request.url).pathname;
    if (path === '/user/users/me') return json(actor);
    if (path === '/events/events/calendar-stats') { reads++; return json({ events_this_year: annual }); }
    writes.push(request.method);
    if (request.method === 'POST') annual++;
    if (request.method === 'DELETE') annual--;
    if (request.method === 'PATCH') { assert.equal((await request.formData()).get('event_date'), '2027-01-02'); annual--; }
    return json({ id: 'test-event' });
  }, async () => {
    const subscription = store.dispatch(eventsApi.endpoints.getCalendarStats.initiate());
    try {
      await subscription;
      await store.dispatch(eventsApi.endpoints.createEvent.initiate({ title: 'Test', event_date: '2026-11-28', end_date: '2026-11-28' })).unwrap();
      await until(() => selectStats().status === 'fulfilled' && count().value === 11);
      await store.dispatch(eventsApi.endpoints.deleteEvent.initiate('test-event')).unwrap();
      await until(() => selectStats().status === 'fulfilled' && count().value === 10);
      await store.dispatch(eventsApi.endpoints.updateEvent.initiate({ id: 'test-event', data: { event_date: '2027-01-02' } })).unwrap();
      await until(() => selectStats().status === 'fulfilled' && count().value === 9);
      assert.equal(reads, 4); assert.deepEqual(writes, ['POST', 'DELETE', 'PATCH']);
    } finally { subscription.unsubscribe(); }
  });
});

test('annual counting period is explained in English and French', () => {
  for (const locale of ['en', 'fr']) {
    const messages = JSON.parse(readFileSync(new URL(`../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'));
    assert.match(messages.adminPanelPage.counts.eventsThisYear, locale === 'en' ? /current calendar year/ : /année civile en cours/);
  }
  const source = readFileSync(new URL('../src/pages/AdminPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-describedby=\{tab\.id === "events"/);
});

test('successful member permission PATCH publishes the returned row before delayed GET finishes', { timeout: 5000 }, async () => {
  const gate = deferred(); let reads = 0;
  const original = { id: 'override-a', user_id: 'member-a', feature: 'article', can_view: false, can_create: false, can_edit: false, can_delete: false };
  const updated = { ...original, can_view: true };
  await fixture(async request => {
    const path = new URL(request.url).pathname;
    if (path === '/user/users/me') return json(actor);
    if (request.method === 'PATCH') return json(updated);
    assert.equal(new URL(request.url).searchParams.get('user_id'), 'member-a');
    reads++; if (reads > 1) await gate.promise;
    return json([reads > 1 ? updated : original]);
  }, async () => {
    const args = { user_id: 'member-a' };
    const subscription = store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(args));
    try {
      await subscription;
      await store.dispatch(membersApi.endpoints.updateMemberPermission.initiate({ id: original.id, user_id: original.user_id, can_view: true })).unwrap();
      assert.equal(membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).data[0].can_view, true);
      gate.resolve();
      await until(() => membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).status === 'fulfilled');
      assert.equal(reads, 2);
    } finally { gate.resolve(); subscription.unsubscribe(); }
  });
});

test('slow Member A read and a Member B update remain separated by stable query IDs', { timeout: 5000 }, async () => {
  const gate = deferred(); const reads = [];
  const row = user_id => ({ id: `override-${user_id}`, user_id, feature: 'article', can_view: false, can_create: false, can_edit: false, can_delete: false });
  let memberB = row('member-b');
  await fixture(async request => {
    const url = new URL(request.url);
    if (url.pathname === '/user/users/me') return json(actor);
    if (request.method === 'PATCH') {
      assert.equal(url.pathname, '/user/user-permissions/override-member-b');
      assert.deepEqual(await request.json(), { can_view: true });
      memberB = { ...memberB, can_view: true }; return json(memberB);
    }
    const id = url.searchParams.get('user_id'); reads.push(id);
    if (id === 'member-a') await gate.promise;
    return json([id === 'member-b' ? memberB : row(id)]);
  }, async () => {
    const argsA = { user_id: 'member-a' }, argsB = { user_id: 'member-b' };
    const a = store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(argsA));
    const b = store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(argsB));
    try {
      await b;
      assert.equal(membersApi.endpoints.getMemberPermissions.select(argsA)(store.getState()).data, undefined);
      await store.dispatch(membersApi.endpoints.updateMemberPermission.initiate({ id: memberB.id, user_id: 'member-b', can_view: true })).unwrap();
      await until(() => membersApi.endpoints.getMemberPermissions.select(argsB)(store.getState()).status === 'fulfilled');
      gate.resolve(); await a;
      assert.equal(membersApi.endpoints.getMemberPermissions.select(argsB)(store.getState()).data[0].can_view, true);
      assert.equal(membersApi.endpoints.getMemberPermissions.select(argsA)(store.getState()).data[0].user_id, 'member-a');
      const before = reads.filter(id => id === 'member-a').length;
      // Mirrors the editor hook's refetchOnMountOrArgChange: true on reopening A.
      const revisit = store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(argsA, { forceRefetch: true }));
      await revisit; revisit.unsubscribe(); assert.equal(reads.filter(id => id === 'member-a').length, before + 1);
    } finally { gate.resolve(); a.unsubscribe(); b.unsubscribe(); }
  });
});

test('rejected PATCH and mismatched response identities cannot change another cached permission row', { timeout: 5000 }, async () => {
  for (const mode of ['rejected', 'wrong-user', 'wrong-id', 'malformed-action']) {
    const gate = deferred(); let reads = 0;
    const row = { id: 'override-a', user_id: 'member-a', feature: 'article', can_view: false, can_create: false, can_edit: false, can_delete: false };
    await fixture(async request => {
      if (new URL(request.url).pathname === '/user/users/me') return json(actor);
      if (request.method === 'PATCH') {
        if (mode === 'rejected') return json({ detail: 'Denied' }, 403);
        return json({ ...row, can_view: true, ...(mode === 'wrong-user' ? { user_id: 'other' } : mode === 'wrong-id' ? { id: 'other' } : { can_create: 'true' }) });
      }
      reads++; if (reads > 1) await gate.promise;
      return json([row]);
    }, async () => {
      const args = { user_id: 'member-a' };
      const subscription = store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(args));
      try {
        await subscription;
        const result = await store.dispatch(membersApi.endpoints.updateMemberPermission.initiate({ id: row.id, user_id: row.user_id, can_view: true }));
        if (mode === 'rejected') assert.equal(result.error.status, 403);
        assert.equal(membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).data[0].can_view, false);
      } finally { gate.resolve(); subscription.unsubscribe(); }
    });
  }
});

test('first override POST uses four explicit booleans and publishes only the server-created row', { timeout: 5000 }, async () => {
  const gate=deferred();let reads=0;const writes=[];
  const fields={user_id:'member-a',feature:'article',can_view:true,can_create:false,can_edit:false,can_delete:false};
  const created={id:'server-generated-override',...fields};
  await fixture(async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/user/users/me')return json(actor);
    if(request.method==='POST'){writes.push(await request.json());assert.equal(path,'/user/user-permissions');return json(created);}
    reads++;if(reads>1)await gate.promise;return json(reads>1?[created]:[]);
  },async()=>{
    const args={user_id:'member-a'};const subscription=store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(args));
    try{
      await subscription;assert.equal(writes.length,0);assert.deepEqual(membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).data,[]);
      await store.dispatch(membersApi.endpoints.createMemberPermission.initiate(fields)).unwrap();
      assert.deepEqual(writes,[fields]);assert.deepEqual(membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).data,[created]);
      gate.resolve();await until(()=>membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).status==='fulfilled');assert.equal(reads,2);
    }finally{gate.resolve();subscription.unsubscribe();}
  });
});

test('rejected first override creation leaves the inherited feature without fabricated records', { timeout: 5000 }, async () => {
  await fixture(async request=>new URL(request.url).pathname==='/user/users/me'?json(actor):request.method==='POST'?json({detail:'Rejected'},400):json([]),async()=>{
    const args={user_id:'member-a'},subscription=store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(args));
    try{
      await subscription;const result=await store.dispatch(membersApi.endpoints.createMemberPermission.initiate({user_id:'member-a',feature:'article',can_view:false,can_create:false,can_edit:false,can_delete:false}));
      assert.equal(result.error.status,400);assert.deepEqual(membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).data,[]);
    }finally{subscription.unsubscribe();}
  });
});

test('POST replaces an inherited null-ID placeholder with the server row before refetch, then PATCH and reopen persist false', { timeout: 5000 }, async () => {
  const gate=deferred();let reads=0;const writes=[];
  const placeholder={id:null,user_id:'member-a',feature:'article',can_view:null,can_create:null,can_edit:null,can_delete:null};
  let saved;
  const fields={user_id:'member-a',feature:'article',can_view:true,can_create:true,can_edit:true,can_delete:false};
  await fixture(async request=>{
    const path=new URL(request.url).pathname;
    if(path==='/user/users/me')return json(actor);
    if(request.method==='POST'){
      const body=await request.json();writes.push(['POST',path,body]);saved={id:'server-id',...body};return json(saved);
    }
    if(request.method==='PATCH'){
      const body=await request.json();writes.push(['PATCH',path,body]);saved={...saved,...body};return json(saved);
    }
    reads++;if(reads>1)await gate.promise;return json([saved??placeholder]);
  },async()=>{
    const args={user_id:'member-a'};const subscription=store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(args));
    try{
      await subscription;assert.deepEqual(membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).data,[placeholder]);
      await store.dispatch(membersApi.endpoints.createMemberPermission.initiate(fields)).unwrap();
      const rows=membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).data;
      assert.equal(rows.length,1);assert.equal(rows[0].id,'server-id');assert.equal(rows[0].can_edit,true);
      await store.dispatch(membersApi.endpoints.updateMemberPermission.initiate({id:rows[0].id,user_id:'member-a',can_view:false})).unwrap();
      assert.deepEqual(writes,[['POST','/user/user-permissions',fields],['PATCH','/user/user-permissions/server-id',{can_view:false}]]);
      gate.resolve();await until(()=>membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).status==='fulfilled');
      subscription.unsubscribe();
      const reopened=store.dispatch(membersApi.endpoints.getMemberPermissions.initiate(args,{forceRefetch:true}));
      try{await reopened;assert.deepEqual(membersApi.endpoints.getMemberPermissions.select(args)(store.getState()).data,[{id:'server-id',...fields,can_view:false}]);}finally{reopened.unsubscribe();}
    }finally{gate.resolve();subscription.unsubscribe();}
  });
});
