import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PERMISSION_FEATURES, PERMISSION_ACTIONS } from '../src/redux/features/auth/permissionUtils.ts';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const parse = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(root, predicate) { const result=[]; function visit(node) { if(predicate(node))result.push(node);ts.forEachChild(node,visit); }visit(root);return result; }
function evaluate(code, context) { runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,context); }
const source=parse('src/pages/admin/AdminPermissionsEditor.tsx');
const component=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='AdminPermissionsEditor');
const en=JSON.parse(read('src/i18n/locales/en.json'));
const values=extra=>({can_view:true,can_create:false,can_edit:false,can_delete:false,...extra});
const finalRows=(article=values())=>PERMISSION_FEATURES.map(feature=>({feature,...(feature==='article'?article:values({can_view:false}))}));
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function harness(kind='member', options={}) {
  const { records=[], finalPermissions=finalRows(), targetId='target', allowed=true, fetching=false,
    profileFetching=false, profileId=targetId, failedQuery=false, profileError=false, mutationError, deferred }=options;
  const state=[],calls=[],notices=[],queries=[],busy=[];let cursor=0,effects=[],changed=false;
  const query={currentData:records,isFetching:fetching,isError:failedQuery,error:new Error('load failed'),refetch(){calls.push(['refetch']);}};
  const profileQuery={currentData:{id:profileId,permissions:finalPermissions,role_permissions:finalRows(values({can_view:false})),user_permissions:[]},isFetching:profileFetching,isError:profileError,error:new Error('profile failed'),fulfilledTimeStamp:1,refetch(){calls.push(['profile-refetch']);}};
  const mutation=name=>()=>[payload=>({unwrap:async()=>{
    calls.push([name,payload]);
    const error=typeof mutationError==='function'?mutationError(payload):mutationError;if(error)throw error;
    if(deferred)await deferred;
    if(name.startsWith('create'))query.currentData=[...query.currentData,{id:'server-id',...payload}];
    else query.currentData=query.currentData.map(row=>row.id===payload.id?{...row,...payload}:row);
    return payload;
  }})];
  const context={
    React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},PERMISSION_FEATURES,PERMISSION_ACTIONS,
    useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],value=>{const next=typeof value==='function'?value(state[index]):value;if(next!==state[index]){state[index]=next;changed=true;}}];},
    useRef(initial){const index=cursor++;if(!(index in state))state[index]={current:initial};return state[index];},
    useEffect(effect,deps){const index=cursor++,previous=state[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous[i]))){state[index]=deps;effects.push(effect);}},
    useI18n:()=>({translate:(key,params={})=>{const message=key.split('.').reduce((value,part)=>value?.[part],en);assert.equal(typeof message,'string',key);return Object.entries(params).reduce((text,[name,value])=>text.replace(`{${name}}`,value),message);}}),
    useAppToast:()=>({success:message=>notices.push(['success',message]),error:message=>notices.push(['error',message])}),getApiErrorDisplayMessage:error=>error.message,
    useGetUserPermissionsQuery:(args,config)=>{queries.push(['role',args,config]);return query;},
    useGetMemberPermissionsQuery:(args,config)=>{queries.push(['member',args,config]);return query;},useGetUserByIdQuery:()=>profileQuery,
    useCreateUserPermissionMutation:mutation('createRole'),useUpdateUserPermissionMutation:mutation('updateRole'),
    useCreateMemberPermissionMutation:mutation('createMember'),useUpdateMemberPermissionMutation:mutation('updateMember'),
  };
  evaluate(component.getText(source).replace('export ', '')+'\nresult=AdminPermissionsEditor;',context);
  return {query,profileQuery,calls,notices,queries,busy,render(){let tree,passes=0;do{cursor=0;effects=[];changed=false;tree=context.result({kind,targetId,canManage:allowed,onBusyChange:value=>busy.push(value)});effects.forEach(effect=>effect());assert.ok(++passes<12,'form reconciliation loop');}while(changed);return tree;},refresh(article){profileQuery.currentData={...profileQuery.currentData,permissions:finalRows(article)};profileQuery.fulfilledTimeStamp++;}};
}
function all(tree,type){const result=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node?.props)return;if(node.type===type)result.push(node);visit(node.props.children);}visit(tree);return result;}
const row=(tree,feature='article')=>all(tree,'fieldset').find(node=>node.props.key===feature);
const inputs=(tree,feature)=>all(row(tree,feature),'input');
const toggle=(tree,index,checked,feature)=>inputs(tree,feature)[index].props.onChange({target:{checked}});
const save=(tree,feature)=>all(row(tree,feature),'button')[0].props.onClick();
const dirty=(tree,feature)=>!all(row(tree,feature),'button')[0].props.disabled;
function markup(tree){function convert(node){if(Array.isArray(node))return node.map(convert);if(!node?.props)return node;const{children,...props}=node.props,rendered=convert(children);return React.createElement(node.type,props,...(Array.isArray(rendered)?rendered:[rendered]));}return renderToStaticMarkup(convert(tree));}
function editable(tree){const html=markup(tree);assert.equal(all(tree,'input').length,28);assert.equal(all(tree,'select').length,0);assert.doesNotMatch(html,/<fieldset[^>]*\sdisabled|<input[^>]*\sdisabled/);assert.ok(all(tree,'input').every(input=>input.props.type==='checkbox'));}

for(const kind of ['role','member']) {
  test(`${kind}: seven features use labelled checkboxes, correct queries and no initial mutation`,()=>{
    const h=harness(kind),tree=h.render();editable(tree);assert.equal(all(tree,'fieldset').length,7);assert.equal(all(tree,'label').length,28);
    assert.ok(all(tree,'button').every(button=>button.props.disabled));assert.equal(h.calls.length,0);
    assert.equal(h.queries.find(([name])=>name===kind)[2].skip,false);assert.equal(h.queries.find(([name])=>name!==kind)[2].skip,true);
    if(kind==='member')assert.equal(h.queries.find(([name])=>name===kind)[2].refetchOnMountOrArgChange,true);
  });
  test(`${kind}: reverting every checkbox to its original value sends no mutation`,async()=>{
    const h=harness(kind,{records:kind==='role'?[{id:'row',feature:'article',...values()}]:[]});let tree=h.render();
    save(tree);await flush();toggle(tree,1,true);tree=h.render();assert.equal(dirty(tree),true);toggle(tree,1,false);tree=h.render();assert.equal(dirty(tree),false);
    save(tree);await flush();assert.equal(h.calls.length,0);
  });
}

test('member initialization uses only final server permissions, including role-derived grants without direct rows',()=>{
  const expected=values({can_edit:true});
  const h=harness('member',{finalPermissions:finalRows(expected),records:[{id:'row',feature:'article',...values({can_view:false,can_create:true,can_delete:true})}]});
  h.profileQuery.currentData.effective_permissions=finalRows(values({can_view:false}));
  h.profileQuery.currentData.is_superuser=true;
  const tree=h.render();editable(tree);assert.deepEqual(inputs(tree).map(input=>input.props.checked),[true,false,true,false]);
  assert.doesNotMatch(markup(tree),/Inherit|Allow|Deny|Inherited:|Effective:/);
});

test('first override POST preserves untouched final values after changing one checkbox',async()=>{
  const h=harness('member',{finalPermissions:finalRows(values({can_edit:true}))});let tree=h.render();editable(tree);
  toggle(tree,1,true);tree=h.render();assert.equal(dirty(tree),true);assert.equal(h.calls.length,0);save(tree);await flush();
  assert.deepEqual(plain(h.calls),[['createMember',{user_id:'target',feature:'article',can_view:true,can_create:true,can_edit:true,can_delete:false}]]);
  assert.deepEqual(inputs(h.render()).map(input=>input.props.checked),[true,true,true,false]);
});

test('unchecking a granted permission includes explicit false in a first full override',async()=>{
  const h=harness();let tree=h.render();toggle(tree,0,false);tree=h.render();save(tree);await flush();
  assert.deepEqual(plain(h.calls[0]),['createMember',{user_id:'target',feature:'article',can_view:false,can_create:false,can_edit:false,can_delete:false}]);
});

test('existing override PATCH uses its stable ID and only changed final checkbox actions',async()=>{
  const h=harness('member',{finalPermissions:finalRows(values({can_edit:true})),records:[{id:'record-id',user_id:'target',feature:'article',can_view:null,can_create:null,can_edit:true,can_delete:null}]});
  let tree=h.render();toggle(tree,2,false);tree=h.render();save(tree);await flush();
  assert.deepEqual(plain(h.calls[0]),['updateMember',{id:'record-id',user_id:'target',can_edit:false}]);
  assert.equal(h.query.currentData[0].can_view,null);assert.equal(h.query.currentData[0].can_delete,null);
});

test('multiple feature edits remain independent and failed features retain their drafts',async()=>{
  const h=harness('member',{mutationError:payload=>payload.feature==='forum'?new Error('Forum save failed'):undefined});let tree=h.render();
  toggle(tree,1,true);tree=h.render();toggle(tree,0,true,'forum');tree=h.render();save(tree);await flush();tree=h.render();
  assert.equal(dirty(tree),false);assert.equal(dirty(tree,'forum'),true);save(tree,'forum');await flush();tree=h.render();
  assert.equal(inputs(tree,'forum')[0].props.checked,true);assert.equal(dirty(tree,'forum'),true);
  assert.deepEqual(h.calls.map(([name,payload])=>[name,payload.feature]),[['createMember','article'],['createMember','forum']]);
  assert.deepEqual(h.notices.map(([type])=>type),['success','error']);
});

test('failed PATCH preserves an unchecked draft and does not report success',async()=>{
  const h=harness('member',{records:[{id:'row',feature:'article',...values()}],mutationError:new Error('Rejected')});let tree=h.render();
  toggle(tree,0,false);tree=h.render();save(tree);await flush();tree=h.render();assert.equal(inputs(tree)[0].props.checked,false);assert.equal(dirty(tree),true);
  assert.deepEqual(h.notices,[['error','Rejected']]);
});

test('active save disables rendered fieldsets and synchronously rejects duplicate submission',async()=>{
  let resolve;const deferred=new Promise(done=>{resolve=done;}),h=harness('member',{deferred});let tree=h.render();toggle(tree,1,true);tree=h.render();save(tree);save(tree);
  assert.equal(h.calls.length,1);assert.equal((markup(h.render()).match(/<fieldset[^>]*\sdisabled/g)||[]).length,7);
  resolve();await flush();editable(h.render());assert.deepEqual(h.busy,[true,false]);
});

test('background direct/profile requests permit local checkbox edits but block writes until settled',async()=>{
  for(const which of ['query','profileQuery']){
    const h=harness();h[which].isFetching=true;let tree=h.render();editable(tree);toggle(tree,1,true);tree=h.render();assert.equal(inputs(tree)[1].props.checked,true);
    assert.equal(dirty(tree),false);save(tree);await flush();assert.equal(h.calls.length,0);
    h[which].isFetching=false;tree=h.render();assert.equal(dirty(tree),true);save(tree);await flush();assert.equal(h.calls.length,1);
  }
});

test('background final-profile refresh preserves edited actions and refreshes untouched POST values',async()=>{
  const h=harness();let tree=h.render();toggle(tree,1,true);tree=h.render();
  h.profileQuery.isFetching=true;editable(h.render());h.refresh(values({can_view:false,can_edit:true}));h.profileQuery.isFetching=false;tree=h.render();
  assert.deepEqual(inputs(tree).map(input=>input.props.checked),[false,true,true,false]);save(tree);await flush();
  assert.deepEqual(plain(h.calls[0][1]),{user_id:'target',feature:'article',can_view:false,can_create:true,can_edit:true,can_delete:false});
});

test('saved checkbox remains visible during refetch, then the fresh final server profile wins',async()=>{
  const h=harness('member',{records:[{id:'row',feature:'article',...values()}]});let tree=h.render();toggle(tree,0,false);tree=h.render();save(tree);await flush();
  h.profileQuery.isFetching=true;tree=h.render();assert.equal(inputs(tree)[0].props.checked,false);
  h.refresh(values());h.profileQuery.isFetching=false;tree=h.render();assert.equal(inputs(tree)[0].props.checked,true);assert.equal(dirty(tree),false);
  assert.equal(h.calls.length,1);
});

test('a new edit made while a successful save refreshes is retained for the next PATCH',async()=>{
  const h=harness();let tree=h.render();toggle(tree,1,true);tree=h.render();save(tree);await flush();
  h.profileQuery.isFetching=true;tree=h.render();toggle(tree,2,true);tree=h.render();h.refresh(values({can_create:true}));h.profileQuery.isFetching=false;tree=h.render();
  assert.deepEqual(inputs(tree).map(input=>input.props.checked),[true,true,true,false]);save(tree);await flush();
  assert.deepEqual(plain(h.calls[1]),['updateMember',{id:'server-id',user_id:'target',can_edit:true}]);
});

test('unavailable or incomplete final permissions show an error instead of fabricated unchecked permissions',()=>{
  for(const payload of [undefined,[],[{feature:'article',can_view:true}],finalRows(values({can_view:null}))]){
    const h=harness();h.profileQuery.currentData.permissions=payload;const tree=h.render();assert.equal(tree.props.role,'alert');assert.equal(all(tree,'input').length,0);assert.match(markup(tree),/unavailable or incomplete/);
  }
});

test('initial loading, target mismatch, failed queries and authorization loss withhold controls',()=>{
  const loading=harness();loading.query.currentData=undefined;assert.equal(loading.render().props.role,'status');
  assert.equal(harness('member',{profileId:'other'}).render().props.role,'status');
  for(const options of [{failedQuery:true},{profileError:true}]){const tree=harness('member',options).render();assert.equal(tree.props.role,'alert');assert.equal(all(tree,'input').length,0);assert.match(markup(tree),/Retry Fetch/);}
  for(const options of [{allowed:false},{targetId:''}])assert.equal(harness('member',options).render(),null);
});

test('malformed existing row IDs block saving without locking checkbox interaction or creating duplicates',async()=>{
  const h=harness('member',{records:[{feature:'article',...values()}]});let tree=h.render();editable(tree);toggle(tree,0,false);tree=h.render();assert.equal(dirty(tree),false);assert.match(markup(tree),/record has no ID/);save(tree);await flush();assert.equal(h.calls.length,0);
});

test('closing/reopening and distinct keyed member instances initialize fresh final values without shared drafts',()=>{
  const a=harness('member',{targetId:'A'});let tree=a.render();toggle(tree,0,false);assert.equal(inputs(a.render())[0].props.checked,false);
  const b=harness('member',{targetId:'B',finalPermissions:finalRows(values({can_create:true}))});assert.deepEqual(inputs(b.render()).map(input=>input.props.checked),[true,true,false,false]);
  const reopened=harness('member',{targetId:'A'});assert.equal(inputs(reopened.render())[0].props.checked,true);
  assert.match(read('src/pages/AdminPanel.tsx'),/AdminPermissionsEditor key=\{permissionMember.id\} kind="member" targetId=\{permissionMember.id\}/);
});

test('role permission POST/PATCH remains independent of member final permissions',async()=>{
  const create=harness('role');let tree=create.render();toggle(tree,1,true);tree=create.render();save(tree);await flush();assert.deepEqual(plain(create.calls[0]),['createRole',{role_id:'target',feature:'article',can_view:false,can_create:true,can_edit:false,can_delete:false}]);
  const update=harness('role',{records:[{id:'role-row',feature:'article',...values({can_edit:null})}]});tree=update.render();toggle(tree,0,false);tree=update.render();save(tree);await flush();assert.deepEqual(plain(update.calls[0]),['updateRole',{id:'role-row',role_id:'target',can_view:false}]);
});

test('simple member labels exist in English/French without obsolete three-state UI keys',()=>{
  for(const[locale,actions,saveLabel]of[['en',['View','Create','Edit','Delete'],'Save Permissions'],['fr',['Voir','Créer','Modifier','Supprimer'],'Enregistrer les permissions']]){
    const messages=JSON.parse(read(`src/i18n/locales/${locale}.json`)).adminPanelPage;
    assert.deepEqual(Object.values(messages.rolePermissions.actions),actions);assert.equal(messages.memberPermissions.savePermissions,saveLabel);
    for(const key of ['allow','deny','inherit','inheritedValue','effectiveValue','inheritanceUnavailable','newOverrideUnavailable','resetUnavailable'])assert.equal(messages.memberPermissions[key],undefined);
  }
});

test('existing permission endpoint serializers and targeted cache invalidation remain intact',()=>{
  const api=parse('src/redux/features/members/membersApi.ts');
  for(const[endpoint,kind,method,url]of[['createUserPermission','role','POST','/user/permissions'],['updateUserPermission','role','PATCH','/user/permissions/permission'],['createMemberPermission','member','POST','/user/user-permissions'],['updateMemberPermission','member','PATCH','/user/user-permissions/permission']]){
    const declaration=find(api,node=>ts.isPropertyAssignment(node)&&node.name.getText(api)===endpoint)[0];
    const context={builder:{mutation:options=>options},mutationChanged:error=>!error,projectionTags:[]};evaluate(`result=${declaration.initializer.getText(api)};`,context);
    const args={id:'permission',[kind==='role'?'role_id':'user_id']:'target',can_view:false},request=context.result.query(args);assert.equal(request.url,url);assert.equal(request.method,method);assert.equal(request.body.can_view,false);
    if(method==='PATCH'){assert.equal(request.body.id,undefined);assert.equal(request.body.user_id,undefined);assert.equal(request.body.role_id,undefined);}
    const tags=plain(context.result.invalidatesTags(null,null,args));assert.ok(tags.some(tag=>tag.id===`${kind==='role'?'PERMISSIONS':'USER-PERMISSIONS'}-target`));assert.ok(tags.some(tag=>kind==='role'?tag.type==='RoleMembers'&&tag.id==='target':tag.type==='User'&&tag.id==='target'));
  }
});

test('Admin authorization guard remains after its hooks and selectors retain stable target keys',()=>{
  const admin=parse('src/pages/AdminPanel.tsx'),fn=admin.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='AdminPanel');
  const guard=fn.body.statements.find(node=>ts.isIfStatement(node)&&node.expression.getText(admin)==='!canAccessAdminPanel');assert.ok(guard);
  const hooks=find(fn,node=>ts.isCallExpression(node)&&/^(React\.)?use[A-Z]/.test(node.expression.getText(admin)));assert.ok(hooks.every(hook=>hook.getStart(admin)<guard.getStart(admin)));
  assert.match(read('src/pages/AdminPanel.tsx'),/AdminPermissionsEditor key=\{selectedRoleId\}/);
});
