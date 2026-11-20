import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from 'linkedom';
import {fixture} from './helpers/teaching-fixture.mjs';
import {activeClasses,activeTerms,deleteSetting,restoreSetting,setUnitCovered} from '../src/teaching/settings-model.mjs';
import {docxXML,docxText,textPages,detectPlanSections,selectTeachingMaterials,teachingMime} from '../src/teaching/files.mjs';
import {generatePlan,validateTeaching,weeklyCapacity,validateTeachingBackup} from '../src/teaching/model.mjs';
import {validateTeachingRequest,prepareTeachingInput,resolveTeachingAnalysis} from '../server/teaching.mjs';

test('deleting settings is reversible and keeps saved plans, actuals and material bytes',()=>{
  const state=fixture();state.plans=[generatePlan(state,state.classes[0])];const original=structuredClone(state);
  const removed=deleteSetting(state,'term','term',10);assert.equal(activeTerms(removed).length,0);assert.equal(activeClasses(removed).length,0);assert.deepEqual(removed.plans,state.plans);assert.deepEqual(removed.materials,state.materials);validateTeaching(removed);
  assert.throws(()=>generatePlan(removed,removed.classes[0]),/恢复/);assert.deepEqual(restoreSetting(removed,'term','term'),state);assert.deepEqual(state,original);
  const deletedClass=deleteSetting(state,'class','c1',11),deletedBoth=deleteSetting(deletedClass,'term','term',12);
  assert.throws(()=>restoreSetting(deletedBoth,'class','c1'),/所属学期/);assert.equal(activeClasses(restoreSetting(deletedBoth,'term','term')).length,0);assert.deepEqual(restoreSetting(deletedClass,'class','c1'),state);
});
test('one-click unit coverage adds all periods without duplicating or changing other units',()=>{
  const unit=fixture().materials[0].units[0],before=['unit-1:1','unit-2:3'];const after=setUnitCovered(before,unit,true);
  assert.equal(after.length,6);assert(after.includes('unit-2:3'));assert.deepEqual(setUnitCovered(after,unit,true),after);assert.deepEqual(setUnitCovered(after,unit,false),['unit-2:3']);assert.deepEqual(before,['unit-1:1','unit-2:3']);
});
test('regular timetable uses weekdays; explicit dated weekend makeup still counts',()=>{
  const s=fixture(),c=s.classes[0];c.schedule=[{weekday:1,periods:2,time:''},{weekday:6,periods:4,time:''},{weekday:0,periods:3,time:''}];assert.equal(weeklyCapacity(s.terms[0],c,1),2);c.exceptions=[{date:'2026-09-12',lessons:1,note:'临时补课'}];assert.equal(weeklyCapacity(s.terms[0],c,1),3);
});
test('real DOCX archive extracts paragraph text and organizes a multi-period lesson plan',async()=>{
  const bytes=new Uint8Array(readFileSync(new URL('./fixtures/teaching-lesson-plan.docx',import.meta.url))),xml=await docxXML(bytes),text=docxText(xml,DOMParser);
  assert.match(text,/Unit 1 Happy Holiday/);assert.match(text,/第2课时/);assert.match(text,/sentence cards/);
  const pages=textPages(text),units=detectPlanSections(pages,fixture().materials[0].units,'unit-1');assert.equal(units.length,2);assert.deepEqual(units.map(u=>[u.unitId,u.lessonFrom,u.lessonTo]),[['unit-1',1,1],['unit-1',2,2]]);
  const signal=new AbortController();signal.abort();await assert.rejects(docxXML(bytes,signal.signal),/取消/);await assert.rejects(docxXML(new Uint8Array([1,2,3])),/Word/);
  const corrupt=bytes.slice(),view=new DataView(corrupt.buffer);for(let i=0;i<corrupt.length-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,0x7fffffff,true);break;}await assert.rejects(docxXML(corrupt),/过大/);
});
test('lesson-plan selection transmits only the chosen unit and AI per-period arrangements reach weekly plans',()=>{
  const s=fixture(),plan={id:'lesson-file',title:'Unit 1 教案',role:'lessonPlan',format:'txt',primaryId:'book',createdAt:1,pages:[{number:1,text:'第1课时: share a holiday photo. 第2课时: use sentence cards.',bold:[]},{number:2,text:'Other unit private planning notes.',bold:[]}],units:[{id:'p1',unitId:'unit-1',title:'教案1',from:1,to:1,printedFrom:'',lessons:2,lessonFrom:1,lessonTo:2},{id:'p2',unitId:'unit-2',title:'教案2',from:2,to:2,printedFrom:'',lessons:1,lessonFrom:1,lessonTo:1}]};s.materials.push(plan);validateTeaching(s);
  const selected=selectTeachingMaterials(s.materials[0].units[0],s.materials);assert.equal(selected[1].pages.length,1);assert(!JSON.stringify(selected).includes('Other unit private'));
  const request=validateTeachingRequest({unitTitle:'Holiday',materials:selected}),prepared=prepareTeachingInput(request);
  const result=resolveTeachingAnalysis({goals:['分享假期'],vocabulary:['holiday 假期'],grammar:['过去时'],consolidation:['口头练习'],extension:[],lessons:2,note:'根据上传教案整理',references:['S1'],lessonSuggestions:[{lesson:1,title:'分享照片',content:'Share a holiday photo in pairs.',references:['S2']},{lesson:2,title:'句卡复述',content:'Use sentence cards to retell the story.',references:['S2']}]},prepared,request.materials);
  s.materials[0].units[0]={...s.materials[0].units[0],lessons:2,analysis:result};validateTeaching(s);
  const generated=generatePlan(s,s.classes[0]);const lesson=generated.weeks.flatMap(w=>w.lessons).find(l=>l.id==='unit-1:2');assert.match(lesson.content,/sentence cards/);assert.match(lesson.source,/Unit 1 教案/);assert.match(lesson.source,/资料分段/);
});
test('TXT and DOCX originals remain valid in teaching backups alongside legacy PDFs',()=>{
  const s=fixture();for(const format of ['txt','docx']){const m={id:format,title:format,format,role:'lessonPlan',primaryId:'book',createdAt:1,pages:[{number:1,text:'Teaching content',bold:[]}],units:[{id:'p',unitId:'unit-1',title:'Lesson',from:1,to:1,printedFrom:'',lessons:1,lessonFrom:1,lessonTo:1}]};s.materials.push(m);}
  const files=[{id:'book',name:'book.pdf',dataURL:'data:application/pdf;base64,'+btoa('%PDF-1.4')},{id:'txt',name:'plan.txt',dataURL:`data:${teachingMime.txt};base64,`+btoa('Lesson plan')},{id:'docx',name:'plan.docx',dataURL:`data:${teachingMime.docx};base64,`+readFileSync(new URL('./fixtures/teaching-lesson-plan.docx',import.meta.url)).toString('base64')}];
  validateTeachingBackup({teaching:{state:s,files,filesIncluded:true}});const bad=structuredClone(files);bad[1].dataURL='data:text/html;base64,'+btoa('<script>bad</script>');assert.throws(()=>validateTeachingBackup({teaching:{state:s,files:bad,filesIncluded:true}}));
});
