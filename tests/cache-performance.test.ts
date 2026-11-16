import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

globalThis.localStorage = {getItem:()=>null,setItem(){},removeItem(){}} as unknown as Storage;
const {store}=await import('../src/redux/store');
const {apiSlice:api}=await import('../src/redux/features/api/apiSlice');
const auth=await import('../src/redux/features/auth/authSlice');
await import('../src/redux/features/members/membersApi');await import('../src/redux/features/forum/forumApi');
await import('../src/redux/features/articles/articlesApi');await import('../src/redux/features/technicopro/technicoproApi');
await import('../src/redux/features/events/eventsApi');await import('../src/redux/features/trainings/trainingsApi');
await import('../src/redux/features/moderation/moderationApi');await import('../src/redux/features/admin/adminApi');
await import('../src/redux/features/dashboard/dashboardApi');
const actor:any={id:'actor',status:'active',is_deleted:false,is_superuser:true,role:'admin',permissions:[],user_permissions:[]};
const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const endpoint=(name:string)=>(api.endpoints as any)[name];
const tick=()=>new Promise(r=>setTimeout(r,20));
const hooks:Record<string,string>={useGetUsersQuery:'getUsers',useGetForumsQuery:'getForums',useGetArticlesQuery:'getArticles',useGetTechnicoProsQuery:'getTechnicoPros',useGetEventsQuery:'getEvents',useGetEventCategoriesQuery:'getEventCategories',useGetAllTrainingsQuery:'getAllTrainings',useGetUserRolesQuery:'getUserRoles',useGetModerationQueueQuery:'getModerationQueue',useGetModerationLogsQuery:'getModerationLogs',useGetArticleCategoriesQuery:'getArticleCategories',useGetTechnicoProCategoriesQuery:'getTechnicoProCategories',useGetTrainingCategoriesQuery:'getTrainingCategories',useGetAdminSmtpSettingsQuery:'getAdminSmtpSettings',useGetAdminSystemLogsQuery:'getAdminSystemLogs',useGetAdminBackupsQuery:'getAdminBackups'};

test('Admin real query blocks dispatch only active-tab HTTP requests and reuse cached tabs',async()=>{
  const requests:string[]=[];const original=globalThis.fetch;
  globalThis.fetch=async input=>{const r=input as Request,url=new URL(r.url);requests.push(`${r.method} ${url.pathname}`);return json(url.pathname.endsWith('/me')?actor:url.pathname.endsWith('/roles')?[]:url.pathname==='/events/events'?[]:{results:[],total:0});};
  const subscriptions=new Map<string,{key:string;request:any}>();
  store.dispatch(auth.setCredentials({access_token:'token'}));store.dispatch(auth.sessionResolved({user:actor,sessionVersion:store.getState().auth.sessionVersion}));
  const source=readFileSync(new URL('../src/pages/AdminPanel.tsx',import.meta.url),'utf8'),sf=ts.createSourceFile('AdminPanel.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const component=sf.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='AdminPanel') as ts.FunctionDeclaration;
  const statements=component.body!.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.initializer&&ts.isCallExpression(d.initializer)&&hooks[d.initializer.expression.getText(sf)]));
  const code=ts.transpileModule(statements.map(n=>n.getText(sf)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const render=async(activeTab:string)=>{
    const pending:any[]=[];const context:any={Date,activeTab,modSubTab:'queue',canAccessAdminPanel:true,memberPage:1,MEMBERS_PAGE_SIZE:10,searchTerm:'',memberRoleFilter:'all',memberStatusFilter:'all',articlePage:1,ARTICLES_PAGE_SIZE:20,technicoproPage:1,TECHNICOPRO_PAGE_SIZE:20,moderationQueuePage:1,MODERATION_QUEUE_PAGE_SIZE:20,moderationLogsPage:1,MODERATION_LOGS_PAGE_SIZE:20,systemLogsLimit:8,systemLogSearchTerm:''};
    for(const[name,query]of Object.entries(hooks))context[name]=(arg:any,options:any)=>{
      const key=JSON.stringify(arg),old=subscriptions.get(name);
      if(options?.skip){old?.request.unsubscribe();subscriptions.delete(name);return{};}
      if(!old||old.key!==key){old?.request.unsubscribe();const request=store.dispatch(endpoint(query).initiate(arg));subscriptions.set(name,{key,request});pending.push(request);}
      return endpoint(query).select(arg)(store.getState());
    };
    vm.runInNewContext(code,context);await Promise.all(pending);await tick();
  };
  try{
    await render('members');assert.deepEqual(requests,['GET /user/users','GET /user/roles']);console.log('MEASURE Admin initial Members data requests: 2 (baseline 16)');
    requests.length=0;await render('articles');assert.equal(requests.length,2);console.log('MEASURE Admin first Articles tab data requests: 2');
    requests.length=0;await render('members');assert.equal(requests.length,0);console.log('MEASURE Admin return to cached Members requests: 0');
    await store.dispatch(endpoint('updateUser').initiate({id:'other',body:{role_id:'role'}}));await tick();
    assert.deepEqual(requests,['GET /user/users/me','PATCH /user/users/other','GET /user/users']);console.log('MEASURE member role update requests: 3, including required ME preflight');
    await render('outside-admin');requests.length=0;await store.dispatch(endpoint('updateUser').initiate({id:'other',body:{first_name:'Changed'}}));await tick();
    assert.deepEqual(requests,['GET /user/users/me','PATCH /user/users/other']);console.log('MEASURE update after leaving Admin requests: 2; no hidden-tab GET');
  }finally{subscriptions.forEach(s=>s.request.unsubscribe());store.dispatch(auth.logout());globalThis.fetch=original;}
});

test('same-key concurrent subscribers and cached navigation share one real HTTP read',async()=>{
  let requests=0;const original=globalThis.fetch;globalThis.fetch=async()=>{requests++;await tick();return json({results:[],total:0});};
  store.dispatch(auth.setCredentials({access_token:'token'}));store.dispatch(auth.sessionResolved({user:actor,sessionVersion:store.getState().auth.sessionVersion}));
  try{
    const a=store.dispatch(endpoint('getUsers').initiate({page:1})),b=store.dispatch(endpoint('getUsers').initiate({page:1}));await Promise.all([a,b]);assert.equal(requests,1);a.unsubscribe();b.unsubscribe();
    const back=store.dispatch(endpoint('getUsers').initiate({page:1}));await back;assert.equal(requests,1);back.unsubscribe();console.log('MEASURE same-key subscribers: 1 GET; cached return: 0 additional GETs');
  }finally{store.dispatch(auth.logout());globalThis.fetch=original;}
});

test('normalized search reuse has zero reopening requests; invalidation and failure each allow fresh requests',async()=>{
  let requests=0,fail=false;const original=globalThis.fetch;globalThis.fetch=async()=>{requests++;return fail?new Response('{}',{status:500,headers:{'Content-Type':'application/json'}}):json({results:[],meta:{query:'term'}});};
  store.dispatch(auth.setCredentials({access_token:'token'}));store.dispatch(auth.sessionResolved({user:actor,sessionVersion:store.getState().auth.sessionVersion}));
  try{
    const first=store.dispatch(endpoint('getDashboardSearch').initiate({q:' term '}));await first;first.unsubscribe();
    const reopened=store.dispatch(endpoint('getDashboardSearch').initiate({q:'term',limit:10}));await reopened;assert.equal(requests,1);reopened.unsubscribe();
    store.dispatch(api.util.invalidateTags([{type:'Search',id:'GLOBAL'}]));await tick();const fresh=store.dispatch(endpoint('getDashboardSearch').initiate({q:'term'}));await fresh;assert.equal(requests,2);fresh.unsubscribe();
    fail=true;const failed=store.dispatch(endpoint('getDashboardSearch').initiate({q:'new'}));await failed;failed.unsubscribe();fail=false;
    const retry=store.dispatch(endpoint('getDashboardSearch').initiate({q:'new'}));assert.ok((await retry).data);retry.unsubscribe();assert.equal(requests,4);
    console.log('MEASURE search reopening: 0 extra GETs when valid; 1 GET after invalidation; failed query can retry');
  }finally{store.dispatch(auth.logout());globalThis.fetch=original;}
});
