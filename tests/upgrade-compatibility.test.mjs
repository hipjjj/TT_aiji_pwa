import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import Dexie from 'dexie';
import {db} from '../src/db.ts';
const photo='data:image/png;base64,'+readFileSync(new URL('./fixtures/choice-paper.png',import.meta.url)).toString('base64');
const originalSchema={expenses:'id,date,category',budgets:'month',meals:'id,date,mealType,expenseId',nutritionProfiles:'id',settings:'id',inventory:'id,location,expiry',shopping:'id,checked',fridgePreferences:'id',trips:'id,startDate,endDate',visitedCities:'cityId,date',travelSpots:'id,cityId,grade',chatThreads:'id,updatedAt',chatMessages:'id,threadId,createdAt',chatMemories:'id,kind',chatGrowth:'id',overseasTrips:'id,startDate,endDate',appMeta:'id',chatDrafts:'id,updatedAt',personalFoods:'id,&key,updatedAt',gradingSettings:'id',examGrades:'id,createdAt'};
test('a v1 database upgrades with its original expense preserved',async()=>{
  await db.delete();
  const old=new Dexie('riri-expenses');old.version(1).stores({expenses:'id,date,category'});
  await old.expenses.put({id:'old-2019',date:'2019-01-01',category:'住房',cents:120000,note:'原始旧账单'});old.close();
  await db.open();assert.equal(db.name,'riri-expenses');assert.equal(db.verno,11);
  assert.deepEqual(await db.expenses.get('old-2019'),{id:'old-2019',date:'2019-01-01',category:'生活缴费',cents:120000,note:'原始旧账单'});
  await db.delete();
});
test('a populated pre-redesign v11 database retains all 21 tables and photo bytes',async()=>{
  const old=new Dexie('riri-expenses');old.version(11).stores(originalSchema);
  const expected={};for(const table of old.tables){const key=table.schema.primKey.name;const row={[key]:`old-${table.name}`,date:'2026-10-01',note:'改版前资料',updatedAt:1};
    if(['meals','examGrades','chatMessages'].includes(table.name))row.photo=photo;
    if(['trips','overseasTrips'].includes(table.name))row.photos=[{id:'photo-1',caption:'原照片',dataURL:photo}];
    if(table.name==='personalFoods')row.key='原食物';
    if(table.name==='appMeta'){row.id='last-backup';row.value=12345;}
    if(table.name==='settings'){row.id='ai';row.url='https://example.com/old-worker';}
    await table.put(row);expected[table.name]=[row];}
  old.close();await db.open();
  assert.deepEqual(db.tables.map(t=>t.name).sort(),Object.keys(originalSchema).sort());
  for(const table of db.tables)assert.deepEqual(await table.toArray(),expected[table.name],table.name);
  db.close();await db.open();for(const table of db.tables)assert.deepEqual(await table.toArray(),expected[table.name],`${table.name} after reload`);
  const folder=mkdtempSync(join(tmpdir(),'tt-compat-'));
  try{
    const result=await build({entryPoints:['src/backup/export.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shared-dexie',setup(b){b.onResolve({filter:/^dexie$/},()=>({path:pathToFileURL(join(process.cwd(),'node_modules/dexie/dist/dexie.mjs')).href,external:true}));}}]});
    const modulePath=join(folder,'backup.mjs');writeFileSync(modulePath,result.outputFiles[0].text);
    const {createBackup}=await import(pathToFileURL(modulePath).href);
    const full=await createBackup('all',true);assert.equal(full.version,1);assert.equal(full.nutrition.meals[0].photo,photo);assert.equal(full.grading.records[0].photo,photo);assert.equal(full.chat.messages[0].photo,photo);assert.equal(full.travel.trips[0].photos[0].dataURL,photo);assert.equal(full.overseas.trips[0].photos[0].dataURL,photo);assert.ok(!JSON.stringify(full).includes('old-worker'));
    const light=await createBackup('all',false);assert.equal(light.nutrition.meals[0].photo,null);assert.deepEqual(light.travel.trips[0].photos,[]);
    for(const table of db.tables)assert.deepEqual(await table.toArray(),expected[table.name],`${table.name} after photo-free export`);
  }finally{rmSync(folder,{recursive:true,force:true});db.close();}
});
