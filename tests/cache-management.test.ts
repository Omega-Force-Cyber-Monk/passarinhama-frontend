import assert from 'node:assert/strict';
import test from 'node:test';
import { configureStore } from '@reduxjs/toolkit';

const storage = new Map<string, string>();
globalThis.localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } as unknown as Storage;
const { store } = await import('../src/redux/store');
const { apiSlice: api } = await import('../src/redux/features/api/apiSlice');
const auth = await import('../src/redux/features/auth/authSlice');
const { synchronizeSession, listenForSessionChanges } = await import('../src/redux/features/auth/sessionSync');
const { SESSION_STORAGE_KEY, readStoredSession } = await import('../src/redux/features/auth/sessionStorage');
const { hasPermission } = await import('../src/redux/features/auth/permissionUtils');
await import('../src/redux/features/members/membersApi');
await import('../src/redux/features/articles/articlesApi');
await import('../src/redux/features/trainings/trainingsApi');
await import('../src/redux/features/technicopro/technicoproApi');
await import('../src/redux/features/events/eventsApi');
await import('../src/redux/features/forum/forumApi');
await import('../src/redux/features/documents/documentsApi');
await import('../src/redux/features/dashboard/dashboardApi');
await import('../src/redux/features/notifications/notificationsApi');
await import('../src/redux/features/admin/adminApi');
await import('../src/redux/features/moderation/moderationApi');
const actor = (extra = {}): any => ({ id: 'actor', email: 'actor@example.test', first_name: 'Test', last_name: 'Actor', role: 'member', status: 'active', is_deleted: false, is_superuser: true, permissions: [], user_permissions: [], ...extra });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const gate = () => { let resolve!: (value?: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setTimeout(r, 15));
const endpoint = (name: string) => (api.endpoints as any)[name];
const request = (name: string, arg?: any, options?: any): any => store.dispatch(endpoint(name).initiate(arg, options));
const select = (name: string, arg?: any) => endpoint(name).select(arg)(store.getState());
const seed = (name: string, arg: any, data: any) => store.dispatch(api.util.upsertQueryEntries([{ endpointName: name, arg, value: data } as any]));
function signIn(user = actor()) { store.dispatch(auth.setCredentials({ access_token: 'token', refresh_token: 'refresh' })); store.dispatch(auth.sessionResolved({ user, sessionVersion: store.getState().auth.sessionVersion })); }
async function fixture(fetch: typeof globalThis.fetch, run: () => Promise<void>) {
  const original = globalThis.fetch; store.dispatch(auth.logout()); signIn(); globalThis.fetch = fetch;
  try { await run(); } finally { delete (globalThis as any).window; store.dispatch(auth.logout()); globalThis.fetch = original; }
}

test('fresh denied write publishes revocation to auth and the ME cache without another GET', async () => {
  const user = actor({ is_superuser: false, permissions: [{ feature: 'article', can_view: true, can_edit: true }] });
  let calls = 0;
  await fixture(async () => { calls++; return json({ ...user, permissions: [] }); }, async () => {
    signIn(user);
    const result = await request('updateArticle', { id: 'record', data: { title: 'Changed' } });
    assert.equal(result.error.status, 403); assert.equal(calls, 1);
    assert.equal(hasPermission(store.getState().auth.user, 'article', 'view'), false);
    assert.equal(hasPermission(select('getUsersMe').data, 'article', 'view'), false);
  });
});

test('older profile completion cannot restore grants after a newer preflight response', async () => {
  const delayed = gate(), started = gate(); let calls = 0;
  const user = actor({ is_superuser: false, permissions: [{ feature: 'article', can_view: true, can_edit: true }] });
  await fixture(async () => { calls++; if (calls === 1) { started.resolve(); await delayed.promise; return json(user); } return json({ ...user, permissions: [] }); }, async () => {
    signIn(user);
    const old = request('getUsersMe', undefined, { forceRefetch: true }); await started.promise;
    await request('updateArticle', { id: 'record', data: { title: 'Changed' } });
    delayed.resolve(); await old;
    assert.equal(hasPermission(store.getState().auth.user, 'article', 'view'), false);
    assert.equal(hasPermission(select('getUsersMe').data, 'article', 'view'), false); old.unsubscribe();
  });
});

test('successful inactive/deleted preflight restricts visible grants; transport errors preserve resolved identity', async () => {
  for (const change of [{ status: 'inactive' }, { is_deleted: true }]) {
    await fixture(async () => json(actor(change)), async () => {
      const result = await request('createArticle', { title: 'Blocked' });
      assert.equal(result.error.status, 403); assert.equal(hasPermission(store.getState().auth.user, 'article', 'view'), false);
    });
  }
  await fixture(async () => json({}, 500), async () => {
    await request('createArticle', { title: 'Unavailable' });
    assert.equal(store.getState().auth.user?.id, 'actor'); assert.equal(store.getState().auth.status, 'authenticated');
  });
});

test('full profile persistence is removed and atomic credential restoration excludes grants', async () => {
  await fixture(async () => json(actor()), async () => {
    storage.set('user', JSON.stringify(actor())); signIn();
    assert.equal(storage.has('user'), false);
    await request('getUsersMe', undefined, { subscribe: false });
    assert.equal(storage.has('user'), false);
    assert.equal(readStoredSession()?.token, 'token');
    assert.equal(JSON.stringify(readStoredSession()).includes('permissions'), false);
  });
});

test('two tabs synchronize token rotation without cache reset and replacement/logout with reset', async () => {
  await fixture(async () => json(actor()), async () => {
    const other = configureStore({ reducer: { auth: auth.default } });
    const events = new EventTarget(); (globalThis as any).window = events;
    const stop = listenForSessionChanges(store);
    const current = readStoredSession()!; synchronizeSession(other);
    seed('getArticleById', 'record', { id: 'record' });
    const version = store.getState().auth.sessionVersion;
    storage.set(SESSION_STORAGE_KEY, JSON.stringify({ ...current, token: 'rotated' }));
    synchronizeSession(store);
    assert.equal(store.getState().auth.token, 'rotated'); assert.equal(store.getState().auth.sessionVersion, version);
    assert.equal(select('getArticleById', 'record').status, 'fulfilled');
    other.dispatch(auth.setCredentials({ access_token: 'account-B' }));
    const event = new Event('storage'); Object.assign(event, { key: SESSION_STORAGE_KEY }); events.dispatchEvent(event);
    assert.equal(store.getState().auth.token, 'account-B'); assert.equal(store.getState().auth.user, null);
    assert.equal(select('getArticleById', 'record').status, 'uninitialized');
    other.dispatch(auth.logout()); synchronizeSession(store); assert.equal(store.getState().auth.status, 'unauthenticated'); stop();
  });
});

test('an obsolete tab cannot overwrite replacement credentials with a late refresh or logout', async () => {
  await fixture(async () => json(actor()), async () => {
    (globalThis as any).window = new EventTarget();
    const version = store.getState().auth.sessionVersion;
    const replacement = { id: 'new-login', token: 'B', refreshToken: 'B-refresh' };
    storage.set(SESSION_STORAGE_KEY, JSON.stringify(replacement));
    store.dispatch(auth.tokenRefreshed({ access_token: 'late-A', sessionVersion: version }));
    assert.equal(readStoredSession()?.token, 'B');
    store.dispatch(auth.logout()); assert.equal(readStoredSession()?.token, 'B');
    synchronizeSession(store); assert.equal(store.getState().auth.token, 'B');
  });
});

for (const [detail, mutation, permission] of [['getArticleById','deleteArticle','getArticlePermissions'],['getTrainingById','deleteTraining','getTrainingPermissions'],['getTechnicoProById','deleteTechnicoPro','getTechnicoProPermissions'],['getUserById','deleteUser',null]]) {
  test(`${mutation}: read, delete, revisit performs a server-backed detail read`, async () => {
    let reads = 0;
    await fixture(async input => { const r = input as Request; if (r.url.endsWith('/me')) return json(actor()); if (r.method === 'DELETE') return json({}); reads++; return json({},404); }, async () => {
      seed(detail!, 'record', { id: 'record' }); if (permission) seed(permission, 'record', []);
      await request(mutation!, 'record'); await tick();
      assert.equal(select(detail!, 'record').status, 'uninitialized');
      if (permission) assert.equal(select(permission, 'record').status, 'uninitialized');
      assert.equal((await request(detail!, 'record', {subscribe:false})).error.status,404); assert.equal(reads,1);
    });
  });
}

test('supported self deletion logs out and clears identity-bound caches', async () => {
  await fixture(async input => json((input as Request).url.endsWith('/me') ? actor() : {}), async () => {
    seed('getArticleById','record',{id:'record'}); await request('deleteUser','actor'); await tick();
    assert.equal(store.getState().auth.status,'unauthenticated'); assert.equal(select('getArticleById','record').status,'uninitialized');
  });
});

test('document upload refreshes its contents and folder counts without invalidating another folder', async () => {
  await fixture(async input => json((input as Request).url.endsWith('/me') ? actor() : {id:'new'}), async () => {
    seed('getDocumentFolders',undefined,[{id:'folder',document_count:0,children:[]}]);
    for (const id of ['folder','other']) seed('getDocuments',{folder_id:id},{folder:{id,can_upload:true},documents:[],total:0});
    await request('uploadDocument',{folder_id:'folder',file:new File(['x'],'x.txt')}); await tick();
    assert.equal(select('getDocuments',{folder_id:'folder'}).status,'uninitialized');
    assert.equal(select('getDocumentFolders').status,'uninitialized');
    assert.equal(select('getDocuments',{folder_id:'other'}).status,'fulfilled');
  });
});

for (const mutation of ['deleteFolder','updateFolderPermissionsBulk']) test(`${mutation} invalidates known nested content, permissions and download descriptors`, async () => {
  await fixture(async input => json((input as Request).url.endsWith('/me')?actor():{}), async () => {
    seed('getDocumentFolders',undefined,[{id:'parent',children:[{id:'child',children:[]}]}]);
    seed('getDocuments',{folder_id:'child'},{folder:{id:'child',can_upload:true},documents:[{id:'file'}],total:1});
    seed('downloadDocument','file',{download_url:'old'}); seed('getFolderPermissions','child',[]);
    await request(mutation,mutation==='deleteFolder'?'parent':{folder_id:['parent'],role_id:['role'],can_read:false,can_upload:false}); await tick();
    for(const [name,arg]of [['getDocuments',{folder_id:'child'}],['downloadDocument','file'],['getFolderPermissions','child']]) assert.equal(select(name as string,arg).status,'uninitialized');
  });
});

test('folder/document rename and document deletion invalidate metadata/descriptors and counts', async () => {
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    seed('getDocuments',{folder_id:'folder'},{folder:{id:'folder',name:'Old'},documents:[{id:'file'}]});
    await request('updateFolder',{id:'folder',body:{name:'New'}}); await tick(); assert.equal(select('getDocuments',{folder_id:'folder'}).status,'uninitialized');
    for(const mutation of ['renameDocument','deleteDocument']){
      seed('getDocuments',{folder_id:'folder'},{folder:{id:'folder'},documents:[{id:'file'}]}); seed('downloadDocument','file',{filename:'Old'});
      await request(mutation,mutation==='renameDocument'?{id:'file',folderId:'folder',body:{original_name:'New'}}:{id:'file',folderId:'folder'}); await tick();
      assert.equal(select('getDocuments',{folder_id:'folder'}).status,'uninitialized'); assert.equal(select('downloadDocument','file').status,'uninitialized');
    }
  });
});

test('forum reply changes invalidate parent counts, topic pages, posts and pinned snapshots', async () => {
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    for(const mutation of ['createTopicPost','updatePost','deletePost']){
      seed('getForums',{}, {results:[{id:'forum',post_count:0}]}); seed('getPinnedTopics',undefined,[{id:'topic',reply_count:0}]);
      seed('getForumTopics',{forumId:'forum'},{results:[{id:'topic',reply_count:0}]}); seed('getTopicPosts',{topicId:'topic'},{results:[]});
      await request(mutation,{forum_id:'forum',topic_id:'topic',post_id:'post',content:'Reply'}); await tick();
      for(const [name,arg]of [['getForums',{}],['getPinnedTopics',undefined],['getForumTopics',{forumId:'forum'}],['getTopicPosts',{topicId:'topic'}]])assert.equal(select(name as string,arg).status,'uninitialized');
    }
  });
});

test('forum deletion removes known descendant post caches and pinned membership', async () => {
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    seed('getForumTopics',{forumId:'forum'},{results:[{id:'topic'}]}); seed('getTopicPosts',{topicId:'topic'},{results:[]}); seed('getPinnedTopics',undefined,[{id:'topic',forum:{id:'forum'}}]);
    await request('deleteForum','forum'); await tick(); assert.equal(select('getTopicPosts',{topicId:'topic'}).status,'uninitialized');assert.equal(select('getPinnedTopics').status,'uninitialized');
  });
});

test('forum ACL changes invalidate known descendant posts and pinned snapshots in one lifecycle batch',async()=>{
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    seed('getForumTopics',{forumId:'forum'},{results:[{id:'topic'}]});seed('getTopicPosts',{topicId:'topic'},{results:[]});seed('getPinnedTopics',undefined,[{id:'topic',forum:{id:'forum'}}]);
    await request('setForumPermission',{forum_id:['forum'],role_id:['role'],can_read:false,can_post:false});await tick();
    assert.equal(select('getTopicPosts',{topicId:'topic'}).status,'uninitialized');assert.equal(select('getPinnedTopics').status,'uninitialized');
  });
});

test('unrelated pinned snapshots survive reply edits and pinning does not refresh unchanged replies',async()=>{
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    seed('getPinnedTopics',undefined,[{id:'different-topic',forum:{id:'other'}}]);
    await request('createTopicPost',{forum_id:'forum',topic_id:'topic',content:'Reply'});await tick();assert.equal(select('getPinnedTopics').status,'fulfilled');
    seed('getTopicPosts',{topicId:'topic'},{results:[]});seed('getForumTopics',{forumId:'forum'},{results:[{id:'topic'}]});
    await request('pinTopic',{topic_id:'topic',forum_id:'forum',pinned:true});await tick();assert.equal(select('getTopicPosts',{topicId:'topic'}).status,'fulfilled');assert.equal(select('getForumTopics',{forumId:'forum'}).status,'uninitialized');
  });
});

test('role grant changes invalidate affected effective member profiles but preserve unrelated roles', async()=>{
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    for(const[id,role]of[['member','role'],['other','other-role']])seed('getUserById',id,actor({id,role_details:{id:role}}));
    await request('updateUserPermission',{id:'row',role_id:'role',can_view:false});await tick();
    assert.equal(select('getUserById','member').status,'uninitialized');assert.equal(select('getUserById','other').status,'fulfilled');
  });
});

for(const[query,mutation]of[['getTrainingById','updateTrainingCategory'],['getTechnicoProById','updateTechnicoProCategory']])test(`${mutation} updates embedded categories without refreshing unrelated details`,async()=>{
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    for(const[id,category]of[['record','category'],['other','other-category']])seed(query!,id,{id,category:{id:category,name:'Old'}});
    await request(mutation!,{id:'category',name:'New'});await tick();assert.equal(select(query!,'record').status,'uninitialized');assert.equal(select(query!,'other').status,'fulfilled');
  });
});

test('event participation refreshes matching event projections without unrelated events or calendar statistics',async()=>{
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    for(const id of ['event','other']){seed('getEventById',id,{id});seed('getEventRegistrations',id,{event_id:id,registrations:[]});}
    seed('getEvents',{year:2026,month:1},[{id:'event'}]);seed('getEvents',{year:2026,month:2},[{id:'other'}]);seed('getCalendarStats',undefined,{});
    await request('registerForEvent','event');await tick();
    assert.equal(select('getEventById','event').status,'uninitialized');assert.equal(select('getEventRegistrations','event').status,'uninitialized');assert.equal(select('getEvents',{year:2026,month:1}).status,'uninitialized');
    assert.equal(select('getEventById','other').status,'fulfilled');assert.equal(select('getEvents',{year:2026,month:2}).status,'fulfilled');assert.equal(select('getCalendarStats').status,'fulfilled');
  });
});

test('content CRUD invalidates search and Home lists, retaining required write preflights',async()=>{
  const calls:string[]=[];await fixture(async input=>{const r=input as Request;calls.push(r.method+' '+new URL(r.url).pathname);return json(r.url.endsWith('/me')?actor():{id:'record'});},async()=>{
    for(const[mutation,arg]of[['createArticle',{title:'New'}],['updateArticle',{id:'record',data:{title:'Changed'}}],['createTraining',{title:'New'}],['updateTraining',{id:'record',data:{title:'Changed'}}],['createTechnicoPro',{title:'New'}],['updateTechnicoPro',{id:'record',data:{title:'Changed'}}]]){
      seed('getDashboardSearch',{q:'term'},{results:[]});seed('getArticles',{page:1,pageSize:4},{results:[{id:'record'}]});
      const before=calls.length;await request(mutation as string,arg);await tick();assert.equal(calls[before],'GET /user/users/me');assert.equal(select('getDashboardSearch',{q:'term'}).status,'uninitialized');
      if((mutation as string).includes('Article'))assert.equal(select('getArticles',{page:1,pageSize:4}).status,'uninitialized');
    }
  });
});

test('notification preference change uses three HTTP requests and leaves unrelated user subscriptions alone',async()=>{
  const calls:string[]=[];await fixture(async input=>{const r=input as Request;calls.push(r.method+' '+new URL(r.url).pathname);return json(r.url.endsWith('/me')?actor():r.url.endsWith('/online')?{users:[]}:[]);},async()=>{
    const subs=['getUsersMe','getUsersOnline','getUserRoles','getNotificationPreferences'].map(name=>request(name));await Promise.all(subs);calls.length=0;
    await request('updateNotificationPreference',{notification_type:'new_article',email_enabled:true});await tick();
    assert.deepEqual(calls,['GET /user/users/me','PATCH /settings/notifications/preferences','GET /settings/notifications/preferences']);subs.forEach(s=>s.unsubscribe());
  });
});

test('definite rejected mutations preserve caches; ambiguous transport failures reconcile scoped data',async()=>{
  await fixture(async input=>(input as Request).url.endsWith('/me')?json(actor()):json({},403),async()=>{
    seed('getUserRoles',undefined,[]);seed('getNotificationPreferences',undefined,[]);await request('updateNotificationPreference',{notification_type:'new_article',email_enabled:true});await tick();
    assert.equal(select('getUserRoles').status,'fulfilled');assert.equal(select('getNotificationPreferences').status,'fulfilled');
    globalThis.fetch=async input=>{if((input as Request).url.endsWith('/me'))return json(actor());throw new TypeError('Connection lost');};
    await request('updateNotificationPreference',{notification_type:'new_article',email_enabled:true});await tick();assert.equal(select('getNotificationPreferences').status,'uninitialized');assert.equal(select('getUserRoles').status,'fulfilled');
  });
});

test('a newer revocation prevents an older in-flight write preflight from committing',async()=>{
  const delayed=gate(),started=gate();let writes=0,profiles=0;
  const owner=actor({is_superuser:false,permissions:[{feature:'article',can_view:true,can_edit:true}]});
  await fixture(async input=>{const r=input as Request;if(r.url.endsWith('/me')){profiles++;return json(profiles===1?owner:{...owner,permissions:[]});}if(r.method==='GET'){started.resolve();await delayed.promise;return json({id:'record',author:{id:'actor'}});}writes++;return json({id:'record'});},async()=>{
    signIn(owner);const first=request('updateArticle',{id:'record',data:{title:'Old edit'}});await started.promise;
    await request('updateArticle',{id:'other',data:{title:'Denied'}});delayed.resolve();assert.equal((await first).error.status,403);assert.equal(writes,0);
  });
});

test('a protected read finishing after confirmed feature revocation cannot republish its old response',async()=>{
  const delayed=gate(),started=gate();const owner=actor({is_superuser:false,permissions:[{feature:'article',can_view:true}]});
  await fixture(async input=>{const r=input as Request;if(r.url.endsWith('/me'))return json({...owner,permissions:[]});started.resolve();await delayed.promise;return json({id:'record',title:'Old protected read'});},async()=>{
    signIn(owner);const pending=request('getArticleById','record');await started.promise;await request('getUsersMe',undefined,{forceRefetch:true,subscribe:false});delayed.resolve();assert.equal((await pending).error.status,403);assert.equal(select('getArticleById','record').data,undefined);pending.unsubscribe();
  });
});

test('photo updates preserve the current identity, grants and avatar cache busting',async()=>{
  await fixture(async input=>{const r=input as Request;return json(r.url.endsWith('/me')?actor():actor({avatar_url:'/photo.png'}));},async()=>{
    await request('uploadUserPhoto',{userId:'actor',photo:new File(['x'],'x.png')});
    assert.match(store.getState().auth.user?.avatar_url||'',/photo\.png\?t=/);assert.equal(select('getUsersMe').data.id,'actor');
    globalThis.fetch=async input=>json((input as Request).url.endsWith('/me')?actor():actor({id:'other',avatar_url:'/other.png'}));
    await request('uploadUserPhoto',{userId:'other',photo:new File(['x'],'x.png')});assert.equal(store.getState().auth.user?.id,'actor');assert.equal(select('getUsersMe').data.id,'actor');
  });
});

test('attachment requests use the resolved Redux identity and reject replacement or late-session results',async()=>{
  const {fetchUrlAsObjectUrl}=await import('../src/utils/attachments');const delayed=gate(),started=gate();let hold=false;const headers:string[]=[];
  await fixture(async(input,options)=>{headers.push(new Headers(options?.headers).get('Authorization')||'');if(hold){started.resolve();await delayed.promise;}return new Response(new Blob(['file'],{type:'application/pdf'}));},async()=>{
    (globalThis as any).window=Object.assign(new EventTarget(),{location:{origin:'https://test.invalid'},localStorage});(globalThis as any).document={baseURI:'https://test.invalid/'};
    try{
      const url=await fetchUrlAsObjectUrl('/private.pdf');URL.revokeObjectURL(url);assert.deepEqual(headers,['Bearer token']);
      storage.set(SESSION_STORAGE_KEY,JSON.stringify({id:'B',token:'B-token',refreshToken:null}));
      await assert.rejects(fetchUrlAsObjectUrl('/private.pdf'),/Session is not ready/);assert.equal(headers.length,1);
      store.dispatch(auth.sessionResolved({user:actor({id:'B'}),sessionVersion:store.getState().auth.sessionVersion}));
      hold=true;const pending=fetchUrlAsObjectUrl('/private.pdf');await started.promise;store.dispatch(auth.setCredentials({access_token:'C-token'}));delayed.resolve();await assert.rejects(pending,/Session changed/);assert.equal(headers[1],'Bearer B-token');
    }finally{delete (globalThis as any).document;}
  });
});

test('self-profile save publishes its authoritative response without a redundant subscribed ME refetch',async()=>{
  const calls:string[]=[];await fixture(async input=>{const r=input as Request;calls.push(r.method+' '+new URL(r.url).pathname);return json(actor({first_name:r.method==='PATCH'?'Updated':'Test'}));},async()=>{
    const sub=request('getUsersMe');await sub;seed('getUserById','actor',actor());calls.length=0;
    await request('updateUsersMe',{first_name:'Updated'});await tick();assert.deepEqual(calls,['GET /user/users/me','PATCH /user/users/me']);assert.equal(store.getState().auth.user?.first_name,'Updated');assert.equal(select('getUserById','actor').data.first_name,'Updated');sub.unsubscribe();
  });
});

for(const[query,mutation]of[['getArticles','deleteArticleCategory'],['getTrainingsPaginated','deleteTrainingCategory'],['getTechnicoPros','deleteTechnicoProCategory']])test(`${mutation} rebuilds list pagination even on pages without the deleted category`,async()=>{
  await fixture(async input=>json((input as Request).url.endsWith('/me')?actor():{}),async()=>{
    seed(query!,{page:2},{results:[{id:'record',category:{id:'unrelated'}}]});await request(mutation!,'category');await tick();assert.equal(select(query!,{page:2}).status,'uninitialized');
  });
});
