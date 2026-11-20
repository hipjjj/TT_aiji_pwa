import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../server/worker.mjs';
import {prepareTeachingInput,resolveTeachingAnalysis,validateTeachingRequest} from '../server/teaching.mjs';
import {validateTeachingAnalysis} from '../src/teaching/model.mjs';
const origin='https://hipjjj.github.io';
const env=()=>({NUTRITION_API_KEY:'fixture-key',ACCESS_CODE:'fixture-access-code',AI_QUOTA:{idFromName:()=>1,get:()=>({fetch:async()=>Response.json({allowed:true})})}});
const body=()=>({unitTitle:'Happy Holiday',materials:[{id:'book',title:'主教材',role:'primary',pages:[{number:12,text:'It just took my breath away. This is an English textbook.',bold:[]}]}],privateLedger:'must-not-leave-client'});
const request=value=>new Request('https://worker.test/teaching-analyze',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Access-Code':'fixture-access-code'},body:JSON.stringify(value)});
const analysis=()=>({goals:['描述假期'],vocabulary:['holiday 假期'],grammar:['一般过去时'],consolidation:['复习基础动词'],extension:[],lessons:8,note:'AI建议，核对教材',references:['S1'],lessonSuggestions:[]});
const completed=value=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});

test('teaching endpoint transmits only selected material and restores exact citations using reference IDs',async()=>{
  let posted;
  const result=await handle(request(body()),env(),{fetchImpl:async(_,options)=>{posted=JSON.parse(options.body);return completed(analysis());}});
  assert.equal(result.status,200);assert.equal(posted.store,false);assert.equal(posted.text.format.name,'teaching_unit');assert.equal(posted.text.format.strict,true);assert(!JSON.stringify(posted).includes('must-not-leave-client'));
  const input=JSON.parse(posted.input[0].content[0].text);assert.equal(input.materials[0].pages[0].segments[0].sourceId,'S1');assert(!Object.hasOwn(posted.text.format.schema.properties,'sources'));
  const data=await result.json();assert.equal(data.sourceStatus,'verified');assert.deepEqual(data.sources,[{materialId:'book',page:12,quote:body().materials[0].pages[0].text}]);
});

test('PDF curly apostrophes, punctuation spacing and line wraps never require model transcription',()=>{
  const original='Talk about Yaming’s and Emma’s holidays.\nIt just took my breath away .';
  const materials=[{id:'book',title:'Book',role:'primary',pages:[{number:11,text:original,bold:[]}]}];
  assert.throws(()=>validateTeachingAnalysis({...analysis(),sources:[{materialId:'book',page:11,quote:"Talk about Yaming's and Emma's holidays."}]},materials));
  const prepared=prepareTeachingInput({unitTitle:'Holiday',materials});
  const result=resolveTeachingAnalysis({...analysis(),vocabulary:["Yaming's holiday"]},prepared,materials);
  assert.equal(result.sources[0].quote,original);assert.equal(result.sources[0].page,11);assert.equal(result.sourceStatus,'verified');validateTeachingAnalysis(result,materials);
});

test('unknown references remain explicit unverified drafts and never become fabricated citations',async()=>{
  for(const [references,status,count] of [[['S1','not-in-input'],'partial',1],[['not-in-input'],'pending',0],[[],'pending',0]]){
    const response=await handle(request(body()),env(),{fetchImpl:async()=>completed({...analysis(),references})});
    assert.equal(response.status,200);const data=await response.json();assert.equal(data.sourceStatus,status);assert.equal(data.sources.length,count);assert.match(data.note,/核对/);assert(data.sources.every(s=>s.quote===body().materials[0].pages[0].text));
  }
});

test('source IDs retain file and PDF page attribution across long primary and auxiliary pages',()=>{
  const material={id:'book',title:'Book',role:'primary',pages:[{number:11,text:'Read about Emma’s holiday. '.repeat(50),bold:[]},{number:12,text:'Practise the past tense. '.repeat(25),bold:[]}]};
  const auxiliary={id:'notes',title:'Notes',role:'auxiliary',pages:[{number:11,text:'辅助：复习过去式。'.repeat(90),bold:[]}]};
  const request=validateTeachingRequest({unitTitle:'Holiday',materials:[material,auxiliary]}),prepared=prepareTeachingInput(request);
  const segments=prepared.input.materials.flatMap(m=>m.pages.flatMap(p=>p.segments));assert.equal(new Set(segments.map(s=>s.sourceId)).size,segments.length);
  const selected=[...prepared.sources].filter(([,s])=>s.materialId==='notes').map(([id])=>id);
  const result=resolveTeachingAnalysis({...analysis(),references:selected},prepared,request.materials);assert(result.sources.every(s=>s.materialId==='notes'&&s.page===11));validateTeachingAnalysis(result,request.materials);
  for(const m of request.materials)for(const p of m.pages){const restored=[...prepared.sources.values()].filter(s=>s.materialId===m.id&&s.page===p.number).map(s=>s.quote).join('').replace(/\s/g,'');assert.equal(restored,p.text.replace(/\s/g,''));}
});

test('invalid input, wrong credentials and quota exhaustion stop before a model call',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;throw Error('unexpected');};assert.equal((await handle(request({...body(),materials:[]}),env(),{fetchImpl})).status,400);
  const wrong=env();wrong.ACCESS_CODE='another-access-code';assert.equal((await handle(request(body()),wrong,{fetchImpl})).status,401);
  const limited=env();limited.AI_QUOTA.get=()=>({fetch:async()=>Response.json({allowed:false,reason:'day'})});const response=await handle(request(body()),limited,{fetchImpl});assert.equal(response.status,429);assert.match((await response.json()).error,/明天/);assert.equal(calls,0);
});

test('timeouts, truncated output and malformed content have distinct actionable error codes',async()=>{
  const cases=[
    [async()=>{throw new DOMException('timed out','TimeoutError');},504,'AI_TIMEOUT'],
    [async()=>Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]}),502,'AI_OUTPUT_LIMIT'],
    [async()=>Response.json({status:'incomplete',output:[]}),502,'AI_INCOMPLETE'],
    [async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:'broken json'}]}]}),502,'AI_RESULT_FORMAT'],
    [async()=>Response.json({}, {status:429}),429,'AI_UPSTREAM'],
  ];
  for(const [fetchImpl,status,code] of cases){const response=await handle(request(body()),env(),{fetchImpl});assert.equal(response.status,status);assert.equal((await response.json()).code,code);}
});
