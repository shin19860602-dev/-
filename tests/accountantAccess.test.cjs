const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks){ const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; vm.runInNewContext(code,{exports,process,require(name){if(name in mocks)return mocks[name];throw Error('Unexpected import '+name)}});return exports; }
function auth(staff,cookie={staffId:'a',role:'OWNER'}) {return load('lib/session.ts',{'next/headers':{cookies:async()=>({})},'iron-session':{getIronSession:async()=>({...cookie})},'@/lib/prisma':{prisma:{staff:{findUnique:async()=>staff}}}});}
const accountant={id:'a',active:true,role:'ACCOUNTANT',storeId:null,name:'Reader',title:null};
test('accountant cannot enter default protected routes/actions even with old owner cookie',async()=>{assert.equal(await auth(accountant).requireSession(),null)});
test('accountant may read explicitly allowed pages; database role overrides cookie',async()=>{const s=await auth(accountant).requireSession({allowAccountant:true});assert.equal(s.role,'ACCOUNTANT');assert.equal(s.storeId,null)});
test('revoked and removed accountant are denied even on read pages',async()=>{for(const s of [null,{...accountant,active:false}])assert.equal(await auth(s).requireSession({allowAccountant:true}),null)});
test('existing owner and staff access remains available',async()=>{for(const role of ['OWNER','MANAGER','STAFF'])assert.equal((await auth({...accountant,role}).requireSession()).role,role)});
test('unknown roles and anonymous sessions denied',async()=>{assert.equal(await auth({...accountant,role:'UNKNOWN'}).requireSession({allowAccountant:true}),null);assert.equal(await auth(accountant,{}).requireSession({allowAccountant:true}),null)});
test('accountant opt-in is never present in mutation modules',()=>{function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name])}for(const p of walk('app').filter(p=>p.endsWith('.ts')&&fs.readFileSync(p,'utf8').includes('"use server"')&&!p.includes('/login/'))){const s=fs.readFileSync(p,'utf8');assert.ok(s.includes('requireSession'),p);assert.ok(!s.includes('allowAccountant: true'),p)}});
test('savings and settings routes deny accountant access',()=>{for(const p of ['app/(app)/payroll/savings/page.tsx','app/(app)/staff/page.tsx','app/(app)/accountant-settings/page.tsx']){const s=fs.readFileSync(p,'utf8');assert.match(s,/await requireSession\(\)/,p);assert.ok(!s.includes('allowAccountant: true'),p)}});
