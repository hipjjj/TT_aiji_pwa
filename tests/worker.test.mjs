import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle,NutritionQuota} from '../server/worker.mjs';
const origin='https://hipjjj.github.io';
const result={note:'份量为估计',foods:[{name:'米饭',grams:150,per100:{kcal:130,protein:2.38,carbs:28.59,fat:.21},assumption:'一碗150克',confidence:'medium'}]};
const env=()=>({NUTRITION_API_KEY:'fixture-api-key',ACCESS_CODE:'fixture-access-code',ALLOWED_ORIGINS:origin,AI_QUOTA:{idFromName:()=>1,get:()=>({fetch:async()=>Response.json({allowed:true})})}});
const request=(body={text:'米饭150克',photo:null},headers={})=>new Request('https://worker.test/analyze',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Access-Code':'fixture-access-code',...headers},body:JSON.stringify(body)});
test('AI backend refuses unconfigured service, wrong origin and wrong access code without contacting provider',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw new Error('must not fetch');};
 assert.equal((await handle(request(),{}, {fetchImpl})).status,503);
 assert.equal((await handle(request({}, {Origin:'https://other.test'}),env(),{fetchImpl})).status,403);
 assert.equal((await handle(request({}, {'X-Access-Code':'wrong'}),env(),{fetchImpl})).status,401);assert.equal(calls,0);
});
test('AI backend uses Responses schema and store:false, does not transmit profile, and validates output',async()=>{
 let posted;
 const response=await handle(request(),env(),{fetchImpl:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');posted=JSON.parse(options.body);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});}});
 assert.equal(response.status,200);assert.deepEqual((await response.json()).foods,result.foods);assert.equal(posted.store,false);assert.equal(posted.text.format.strict,true);assert.equal(posted.input[0].content[0].type,'input_text');assert.ok(!Object.hasOwn(posted,'profile'));assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
});
test('explicit photo upload is forwarded as image input, not decoded or uploaded before request',async()=>{
 const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=';
 const response=await handle(request({text:'',photo}),env(),{fetchImpl:async(_,options)=>{const posted=JSON.parse(options.body);assert.equal(posted.input[0].content[1].image_url,photo);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]});}});assert.equal(response.status,200);
});
test('quota exhaustion, invalid payload and unsafe photo stop before API call',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw new Error('must not fetch');};const limited=env();limited.AI_QUOTA.get=()=>({fetch:async()=>Response.json({allowed:false,reason:'day',retryAfter:300})});assert.equal((await handle(request(),limited,{fetchImpl})).status,429);assert.equal((await handle(request({text:'a'.repeat(2001)}),env(),{fetchImpl})).status,400);assert.equal((await handle(request({text:'米饭',photo:'https://untrusted.test/img'}),env(),{fetchImpl})).status,400);assert.equal((await handle(request({text:'a'.repeat(900001)}),env(),{fetchImpl})).status,413);assert.equal(calls,0);
});
test('bad or incomplete AI responses are not returned as nutritional facts',async()=>{
 for(const output of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'output_text',text:'not json'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...result,foods:[{...result.foods[0],grams:-1}]})}]}]}])assert.equal((await handle(request(),env(),{fetchImpl:async()=>Response.json(output)})).status,502);
});
test('AI health and CORS expose no credentials',async()=>{
 const response=await handle(new Request('https://worker.test/health',{headers:{Origin:origin}}),env());const data=await response.json();assert.equal(data.ready,true);assert.ok(!JSON.stringify(data).includes('fixture'));const options=await handle(new Request('https://worker.test/analyze',{method:'OPTIONS',headers:{Origin:origin}}),env());assert.equal(options.status,204);assert.match(options.headers.get('Access-Control-Allow-Headers'),/X-Access-Code/);
});
function state(){const values=new Map();let queue=Promise.resolve();const storage={get:async key=>structuredClone(values.get(key)),put:async(key,value)=>{values.set(key,structuredClone(value));},transaction:async(callback)=>{const result=queue.then(()=>callback(storage));queue=result.catch(()=>{});return result;}};return {storage};}
test('durable quota serializes concurrent requests and resets day/minute counters',async()=>{
 const quota=new NutritionQuota(state());const original=Date.now;let time=Date.parse('2026-10-12T12:00:00Z');Date.now=()=>time;
 try{const make=()=>new Request('https://quota/check',{method:'POST',body:JSON.stringify({daily:3,minute:2})});const first=await Promise.all(Array.from({length:10},async()=>await (await quota.fetch(make())).json()));assert.equal(first.filter(row=>row.allowed).length,2);time+=60000;assert.equal((await (await quota.fetch(make())).json()).allowed,true);assert.equal((await (await quota.fetch(make())).json()).reason,'day');time+=86400000;assert.equal((await (await quota.fetch(make())).json()).allowed,true);}finally{Date.now=original;}
});
