import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/worker.mjs';
const origin='https://hipjjj.github.io';
const base={NUTRITION_API_KEY:'fixture-key',ACCESS_CODE:'fixture-access-code',ALLOWED_ORIGINS:origin,AI_QUOTA:{idFromName:()=>1,get:()=>({fetch:async()=>Response.json({allowed:true})})}};
const chat={mode:'鲍比',messages:[{speaker:'用户',text:'你好'}],today:'2026-10-15'};
const make=(path,body)=>new Request('https://worker.test'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Access-Code':base.ACCESS_CODE},body:JSON.stringify(body)});
test('chat has an independent upgrade with minimal reasoning; tools retain economical model',async()=>{
 for(const [path,body,expected,effort] of [['/chat',chat,'gpt-5-mini','minimal'],['/analyze',{text:'米饭'},'gpt-4.1-mini',undefined]]){
 let sent;
 await handle(make(path,body),base,{fetchImpl:async(_,options)=>{sent=JSON.parse(options.body);return Response.json({}, {status:503})}});
 assert.equal(sent.model,expected);assert.equal(sent.reasoning?.effort,effort);assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);
 }
});
test('chat and tool model overrides remain independent and health exposes both without credentials',async()=>{
 const env={...base,CHAT_MODEL:'gpt-4.1',NUTRITION_MODEL:'tool-fixture'};
 let sent;
 await handle(make('/chat',chat),env,{fetchImpl:async(_,o)=>{sent=JSON.parse(o.body);return Response.json({}, {status:503})}});
 assert.equal(sent.model,'gpt-4.1');assert(!sent.reasoning);
 const response=await handle(new Request('https://worker.test/health'),env);const health=await response.json();assert.equal(health.chatModel,'gpt-4.1');assert.equal(health.model,'tool-fixture');assert(!JSON.stringify(health).includes('fixture-key'));
});
