import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/teaching-fixture.mjs';
import {activeMaterials,activeClasses,deleteSetting} from '../src/teaching/settings-model.mjs';
import {deleteMaterial,restoreMaterial,teachingTrashSummary,purgeTeachingTrash} from '../src/teaching/trash-model.mjs';
import {generatePlan,validateTeaching,prepGroup} from '../src/teaching/model.mjs';
const supplement=id=>({id,title:id,role:'auxiliary',primaryId:'book',createdAt:1,pages:[{number:1,text:'Supplementary reference text.',bold:[]}],units:[]});
const analysis=sources=>({goals:['保留教学目标'],vocabulary:[],grammar:[],consolidation:[],extension:[],lessons:5,note:'原教学建议',sources,sourceStatus:'verified'});
test('deleting a textbook hides related materials and classes reversibly without rewriting records',()=>{
  const s=fixture();s.materials.push(supplement('notes'));s.plans=[generatePlan(s,s.classes[0])];const before=structuredClone(s);
  const deleted=deleteMaterial(s,'book',1);assert.equal(activeMaterials(deleted).length,0);assert.equal(activeClasses(deleted).length,0);assert.deepEqual(deleted.plans,s.plans);assert.equal(teachingTrashSummary(deleted).materials.length,2);assert.deepEqual(restoreMaterial(deleted,'book'),s);assert.deepEqual(s,before);validateTeaching(deleted);
  const both=deleteMaterial(deleted,'notes',2);assert.throws(()=>restoreMaterial(both,'notes'),/主教材/);assert.equal(activeMaterials(restoreMaterial(both,'book')).length,1);
});
test('clearing deleted auxiliary material preserves teaching content and correctly remaps lesson references',()=>{
  const s=fixture();s.materials.push(supplement('notes'),supplement('other'));
  const a=analysis([{materialId:'notes',page:1,quote:'Supplementary reference text.'},{materialId:'book',page:1,quote:'It just took my breath away.'},{materialId:'other',page:1,quote:'Supplementary reference text.'}]);
  a.lessonSuggestions=[{lesson:1,title:'保留课时',content:'保留课堂活动',references:[0,2]}];s.materials[0].units[0].analysis=a;s.plans=[generatePlan(s,s.classes[0])];validateTeaching(s);
  const deleted=deleteMaterial(s,'notes',1),before=structuredClone(deleted),result=purgeTeachingTrash(deleted,teachingTrashSummary(deleted).token);
  assert.deepEqual(result.fileIds,['notes']);assert.deepEqual(result.state.materials.map(m=>m.id),['book','other']);assert.deepEqual(result.state.plans,s.plans);const kept=result.state.materials[0].units[0].analysis;assert.deepEqual(kept.goals,a.goals);assert.equal(kept.sourceStatus,'partial');assert.deepEqual(kept.lessonSuggestions[0].references,[1]);assert.equal(kept.lessonSuggestions[0].content,'保留课堂活动');assert.match(kept.note,/已清空/);assert.deepEqual(deleted,before);validateTeaching(result.state);
});
test('clearing a textbook removes its dependent class records while keeping unrelated books and semesters',()=>{
  const s=fixture();s.materials.push(supplement('notes'),{...structuredClone(s.materials[0]),id:'book2',title:'另一本教材'});s.classes.push({...structuredClone(s.classes[0]),id:'c2',materialId:'book2'});s.plans=s.classes.map(c=>generatePlan(s,c));s.progress=s.classes.map(c=>({id:c.id+':1',classId:c.id,week:1,lessons:1,completed:[],consolidation:'',note:'保留',counts:{homework:1,dictation:0,prep:0}}));s.prepProgress=s.classes.map(c=>({id:c.id,groupId:prepGroup(c),week:1,count:1}));
  const deleted=deleteMaterial(s,'book',1),summary=teachingTrashSummary(deleted),result=purgeTeachingTrash(deleted,summary.token);assert.equal(summary.classes.length,1);assert.deepEqual(result.fileIds.sort(),['book','notes']);assert.deepEqual(result.state.classes.map(c=>c.id),['c2']);assert.equal(result.state.plans.length,1);assert.equal(result.state.progress[0].classId,'c2');assert.equal(result.state.prepProgress[0].groupId,'c2');assert.deepEqual(result.state.terms,s.terms);validateTeaching(result.state);
});
test('clearing one deleted class preserves shared preparation records required by another class',()=>{
  const s=fixture();s.classes[0].sharedPrep=true;s.classes.push({...structuredClone(s.classes[0]),id:'c2'});s.prepProgress=[{id:'shared-record',groupId:prepGroup(s.classes[0]),week:1,count:2}];
  const deleted=deleteSetting(s,'class','c1',1),next=purgeTeachingTrash(deleted,teachingTrashSummary(deleted).token).state;assert.deepEqual(next.prepProgress,s.prepProgress);assert.equal(next.classes[0].id,'c2');
  const termDeleted=deleteSetting(s,'term','term',1),cleared=purgeTeachingTrash(termDeleted,teachingTrashSummary(termDeleted).token).state;assert.deepEqual(cleared.prepProgress,[]);assert.equal(cleared.materials.length,1);assert.equal(cleared.terms.length,0);
});
test('clear confirmation becomes invalid when another item is deleted before execution',()=>{
  const s=fixture();s.materials.push(supplement('notes'));const first=deleteMaterial(s,'notes',1),token=teachingTrashSummary(first).token,changed=deleteSetting(first,'class','c1',2);assert.throws(()=>purgeTeachingTrash(changed,token),/重新查看/);assert.equal(changed.materials.length,2);assert.equal(changed.classes.length,1);
});
