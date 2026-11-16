import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const parse = path => ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function find(root,predicate){const rows=[];function visit(node){if(predicate(node))rows.push(node);ts.forEachChild(node,visit);}visit(root);return rows;}
const init = (sf,name) => find(sf,n=>ts.isVariableDeclaration(n)&&n.name.getText(sf)===name)[0].initializer.getText(sf);
function evaluate(code,context){vm.runInNewContext(ts.transpileModule(`result = (${code});`,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,context);return context.result;}
const effect = (sf,match) => find(sf,n=>ts.isCallExpression(n)&&/^(React\.)?useEffect$/.test(n.expression.getText(sf))&&n.arguments[0].getText(sf).includes(match))[0].arguments[0].getText(sf);
const draftSource=parse('src/utils/recordDraft.ts');
const reconcileDraft=evaluate(draftSource.statements.find(n=>ts.isFunctionDeclaration(n)).getText(draftSource).replace('export ',''),{});
const admin=parse('src/pages/AdminPanel.tsx');

for(const[tab,hook,detail]of[['members','useGetUserByIdQuery','memberDetail'],['forums','useGetForumQuery','forumDetail'],['technicopro','useGetTechnicoProByIdQuery','technicoproDetail'],['events','useGetEventByIdQuery','eventDetail'],['trainings','useGetTrainingByIdQuery','trainingDetail']]){
  test(`Admin ${tab}: A -> unresolved B -> A uses only current target data`,()=>{
    const binding=find(admin,n=>ts.isVariableDeclaration(n)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(admin)===hook)[0];
    for(const currentData of [undefined,{id:'A',title:'A'}]){
      const context={activeTab:tab,isModalOpen:true,isDetailsOpen:false,editingItem:{id:currentData?'A':'B'},viewingId:null,[hook]:()=>({data:{id:'Previous',title:'Previous'},currentData,isFetching:!currentData,isLoading:false})};
      vm.runInNewContext(ts.transpileModule(`const ${binding.getText(admin)}; result = ${detail};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
      assert.equal(context.result?.id,currentData?.id);
    }
  });
}

function adminContext(){const c={activeTab:'members',isModalOpen:true,isDetailsOpen:true,editingItem:{id:'B'},isEditorDetailReady:false,isCurrentDetailError:false,canAccessAdminPanel:true,formData:{first_name:'B',last_name:'Member',email:'b@test.invalid'},memberDetail:{id:'A',first_name:'A',last_name:'Admin',email:'a@test.invalid',is_superuser:true},forumDetail:null,articleDetail:null,technicoproDetail:null,eventDetail:null,trainingDetail:null,selectedFiles:[],removedFileUrls:[],editorDraft:{current:null},reconcileDraft,hasDraftConflict:false,translate:x=>x,writes:[],setFormData:value=>c.formData=value,setHasDraftConflict:value=>c.hasDraftConflict=value,updateUser:args=>({unwrap:async()=>{c.writes.push(args);return args;}}),notifyRequiredField:()=>assert.fail('unexpected validation'),notifyError:e=>{throw e;},setIsModalOpen(){},setShowMemberPassword(){},setSelectedFiles(){},setRemovedFileUrls(){},notifySuccess(){}};return c;}
test('Admin wrong-record effect cannot populate or submit a new target, including privileged fields',async()=>{
  const c=adminContext();evaluate(effect(admin,'const sync ='),c)();assert.equal(c.formData.first_name,'B');
  await evaluate(init(admin,'handleSubmit'),c)({preventDefault(){}});assert.equal(c.writes.length,0);
  c.isEditorDetailReady=true;c.memberDetail={id:'B',first_name:'B',last_name:'Member',email:'b@test.invalid',is_superuser:false,role_details:{id:'role-B'}};
  evaluate(effect(admin,'const sync ='),c)();c.formData={...c.formData,first_name:'Edited B'};
  await evaluate(init(admin,'handleSubmit'),c)({preventDefault(){}});assert.equal(c.writes[0].id,'B');assert.equal(c.writes[0].body.first_name,'Edited B');assert.notEqual(c.writes[0].body.is_superuser,true);
});

test('Admin dirty draft survives same-record server refresh and resets on intentional target switch',()=>{
  const c=adminContext();c.isEditorDetailReady=true;c.memberDetail={id:'B',first_name:'Saved',last_name:'Member',email:'b@test.invalid'};
  const sync=evaluate(effect(admin,'const sync ='),c);sync();c.formData={...c.formData,first_name:'Unsaved'};
  c.memberDetail={...c.memberDetail,last_name:'Server change'};sync();assert.equal(c.formData.first_name,'Unsaved');assert.equal(c.hasDraftConflict,true);
  c.editingItem={id:'C'};c.memberDetail={id:'C',first_name:'C',last_name:'Member',email:'c@test.invalid'};sync();assert.equal(c.formData.first_name,'C');
});

test('Admin missing detail loads and settled errors render as errors',()=>{
  for(const error of [false,true]){
    const c={isDetailsOpen:true,viewingItem:undefined,isCurrentDetailError:error,isLoadingForum:false,isLoadingMember:false,isLoadingArticle:false,isLoadingTechnicoProDetail:false,isLoadingEvent:false,isLoadingTraining:false};
    assert.equal(evaluate(init(admin,'isDetailsLoading'),c),!error);
  }
});

test('Profile background refresh preserves dirty inputs and identifies a server conflict',()=>{
  const sf=parse('src/pages/Profile.tsx'),c={apiUser:{id:'actor',first_name:'Saved',last_name:'Member'},formData:{},profileDraft:{current:null},reconcileDraft,conflict:false,setFormData:v=>c.formData=v,setHasDraftConflict:v=>c.conflict=v};
  const sync=evaluate(effect(sf,'const incoming ='),c);sync();c.formData={...c.formData,first_name:'Unsaved'};c.apiUser={...c.apiUser,last_name:'Changed'};sync();assert.equal(c.formData.first_name,'Unsaved');assert.equal(c.conflict,true);
  c.apiUser={id:'other',first_name:'Other'};sync();assert.equal(c.formData.first_name,'Other');assert.equal(c.conflict,false);
});

test('Article background refresh preserves text and local attachments',()=>{
  const sf=parse('src/pages/Articles.tsx'),c={articleDetail:{id:'article',title:'Saved',body:'Body'},selectedArticleId:'article',canModify:()=>true,categoriesData:[],defaultArticleAuthor:'Actor',DEFAULT_ARTICLE_STATUS:'draft',getArticleCategoryId:()=> 'category',normalizeStructuredFields:value=>value||{},formData:{},selectedFiles:[],articleDraft:{current:null},reconcileDraft,setEditingArticle(){},setHasDraftConflict:v=>c.conflict=v,setFormData:v=>c.formData=v};
  const sync=evaluate(effect(sf,'articleDetail.id === selectedArticleId'),c);sync();c.formData={...c.formData,body:'Unsaved'};c.selectedFiles=[new File(['x'],'x.txt')];c.articleDetail={...c.articleDetail,title:'Server'};sync();assert.equal(c.formData.body,'Unsaved');assert.equal(c.selectedFiles.length,1);assert.equal(c.conflict,true);
  c.canModify=()=>false;c.articleDetail={...c.articleDetail,title:'Denied'};sync();assert.equal(c.formData.body,'Unsaved');
});

test('pinning does not shadow an authoritative topic removal or a later edited title',async()=>{
  const sf=parse('src/pages/Forums.tsx'),c={canPinTopic:true,setPinningTopicId(){},pinTopic:()=>({unwrap:async()=>({})}),toast:{error:assert.fail},getApiErrorDisplayMessage:String,translate:x=>x,useMemo:fn=>fn(),activeForumId:'forum',forumTopicsData:{results:[]},localeCode:'en',formatTopicActivity:x=>x};
  await evaluate(init(sf,'handleTogglePin'),c)({stopPropagation(){}},{id:'topic',forumId:'forum',title:'Old',isPinned:false});
  assert.equal(evaluate(init(sf,'topics'),c).length,0);
  c.forumTopicsData={results:[{id:'topic',title:'New',author:{id:'author',first_name:'A',last_name:'B'}}]};assert.equal(evaluate(init(sf,'topics'),c)[0].title,'New');
});

test('obsolete sidebar page two cannot append after page one resets the generation',async()=>{
  const sf=parse('src/layouts/SidebarCategorySection.tsx');let release;const pending=new Promise(r=>release=r);
  const c={skip:false,generationRef:{current:1},isFetchingNextPageRef:{current:false},currentPageRef:{current:1},totalPagesRef:{current:3},pageSize:20,page1Data:{results:[{id:'old'}],total_pages:3},additionalItems:[],name:'Articles',setIsFetchingNextPage(){},setAdditionalItems:v=>c.additionalItems=typeof v==='function'?v(c.additionalItems):v,setCurrentPage(){},setTotalPages(){},triggerLazyQuery:()=>({unwrap:()=>pending}),console};
  const declaration=find(sf,n=>ts.isVariableDeclaration(n)&&n.name.getText(sf)==='fetchNextPage')[0];
  const request=evaluate(declaration.initializer.arguments[0].getText(sf),c)();c.page1Data={results:[{id:'fresh'}],total_pages:2};evaluate(effect(sf,'generationRef.current += 1'),c)();release({results:[{id:'removed'}]});await request;assert.equal(c.additionalItems.length,0);assert.equal(c.currentPageRef.current,1);
});

test('search hides earlier terms and suppresses repeated identical automatic triggers',async()=>{
  const sf=parse('src/layouts/DashboardLayout.tsx');let refreshes=0;
  const c={isAuthenticated:true,useMemo:fn=>fn(),SEARCH_PERMISSION_FEATURES:{articles:'article'},hasPermission:()=>true,searchResults:{results:[{type:'articles',id:'old'}]},debouncedSearchTerm:'old',normalizedSearchTerm:'new',searchOpen:true,isSearchFetching:false,refetchSearch:()=>{refreshes++;},setSearchOpen(){},setDebouncedSearchTerm:term=>c.debouncedSearchTerm=term};
  assert.equal(evaluate(init(sf,'visibleSearchResults'),c).length,0);
  const execute=evaluate(init(sf,'executeSearch'),c);await execute(' old ');assert.equal(refreshes,0);await execute('old',true);assert.equal(refreshes,1);await execute('new');assert.equal(c.debouncedSearchTerm,'new');assert.equal(refreshes,1);
});

test('search failure retries on reopening, without a retry loop driven by error updates',()=>{
  const sf=parse('src/layouts/DashboardLayout.tsx');let refreshes=0;const c={searchOpen:true,debouncedSearchTerm:'term',isSearchError:true,isSearchFetching:false,refetchSearch:()=>{refreshes++;}};
  const retry=find(sf,n=>ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect'&&n.arguments[0].getText(sf).includes('Reopening a failed'))[0];
  evaluate(retry.arguments[0].getText(sf),c)();assert.equal(refreshes,1);c.searchOpen=false;evaluate(retry.arguments[0].getText(sf),c)();assert.equal(refreshes,1);
});
