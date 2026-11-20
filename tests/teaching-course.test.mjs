import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectCourseUnits,periodNumbers,suggestTextbookReferences,makeTextbookReference,textbookVocabulary} from '../src/teaching/course.mjs';
import {fixture} from './helpers/teaching-fixture.mjs';
import {emptyTeaching,validateTeaching,generatePlan,validateTeachingBackup,actualCounts,prepGroup} from '../src/teaching/model.mjs';
import {selectTeachingMaterials} from '../src/teaching/files.mjs';
import {setUnitCovered,activeMaterials,activeClasses} from '../src/teaching/settings-model.mjs';
import {deleteMaterial,restoreMaterial,teachingTrashSummary,purgeTeachingTrash} from '../src/teaching/trash-model.mjs';
import {validateTeachingRequest,prepareTeachingInput,resolveTeachingAnalysis} from '../server/teaching.mjs';
const pages=texts=>texts.map((text,i)=>({number:i+1,text,bold:[]}));
const course=()=>{const p=pages(['Unit 1 Holiday\nPeriod 1 Section A 1a-1b\nPeriod 2 Section B 1a-1b\nOverview: eight weekly sessions.', 'Unit 1 Holiday · Section A (1a-1b) Listening 1 / 2\nTeaching goals: ask about a holiday.\nStep 1 Share a photo and practise short answers.','Step 2 Listen and repeat.\nHomework: copy words.', 'Unit 1 Holiday · Section B (1a-1b) Reading\n2 / 2\nStep 1 Read about a quiet holiday.\nTeaching goals: find key events.','Homework and board design.']);return {id:'course',role:'lessonPlan',planningBasis:'lessonPlan',format:'pdf',title:'Holiday lesson plan',primaryId:'',pages:p,units:detectCourseUnits(p),createdAt:1};};
const book=()=>({id:'ref',role:'primary',format:'pdf',title:'Reference book',primaryId:'',createdAt:1,units:[{id:'unit-1',title:'Unit 1 Holiday',from:1,to:3,printedFrom:'2',lessons:99}],pages:pages(['SECTION A\n1a Share a holiday photo.\n1b Ask about a holiday.\n2','SECTION B\n1a Read about a holiday.\n1b Retell the events.\n3','Project: holiday card.\n4','Vocabulary in Each Unit\nUnit 1\nholiday /ˈhɒlədeɪ/ n. 假期 p.2\nquiet /ˈkwaɪət/ adj. 安静的 p.3\nVocabulary in Each Unit 100'])});
function stateWithCourse(){const s=fixture();s.materials=[course()];s.classes[0].materialId='course';s.classes[0].unitIds=['unit-1'];s.classes[0].exams=[];return s;}
test('detailed fractional lesson headers win over overview allocations and retain continuation pages',()=>{
  const c=course();assert.equal(c.units.length,1);assert.equal(c.units[0].lessons,2);assert.deepEqual(c.units[0].periods.map(p=>[p.number,p.from,p.to]),[[1,2,3],[2,4,5]]);assert.equal(c.units[0].from,2);
  const sparse=detectCourseUnits(pages(['Unit 7 Future | Section A 1 / 6\nStep 1 Start.','Unit 7 Future | Section B 5 / 6\nStep 1 Read.']));assert.deepEqual(periodNumbers(sparse[0]),[1,5]);assert.equal(sparse[0].lessons,2);assert.deepEqual(setUnitCovered([],sparse[0],true),['unit-7:1','unit-7:5']);
  const wrapped=detectCourseUnits(pages(['Unit 5 Meal | Section A Grammar\n(3a-3c)\nGrammar\n3 / 6\nStep 1 Practise.']));assert.match(wrapped[0].periods[0].title,/3a-3c/);
});
test('a standalone lesson plan schedules its explicit periods without a textbook or an AI estimate',()=>{
  const s=stateWithCourse();validateTeaching(s);const plan=generatePlan(s,s.classes[0]),lessons=plan.weeks.flatMap(w=>w.lessons);assert.deepEqual(lessons.map(l=>l.id),['unit-1:1','unit-1:2']);assert.match(lessons[0].content,/Share a photo/);assert.match(lessons[1].source,/PDF 4–5/);
  s.materials[0].units[0].analysis={goals:['练习'],vocabulary:[],grammar:[],consolidation:[],extension:[],lessons:99,note:'AI estimated too many lessons',sources:[]};assert.equal(generatePlan(s,s.classes[0]).weeks.flatMap(w=>w.lessons).length,2);
  validateTeachingBackup({teaching:{state:s,files:[],filesIncluded:false}});
});
test('textbook mappings use exercise headings and appendix first-occurrence pages, and locks survive rematching',()=>{
  const b=book(),mapped=suggestTextbookReferences(course(),b);assert.equal(textbookVocabulary(b).length,2);const periods=mapped.units[0].periods;assert.deepEqual(periods.map(p=>[p.reference.from,p.reference.to]),[[1,1],[2,2]]);assert.equal(periods[0].reference.printedFrom,'2');assert.deepEqual(periods[0].reference.vocabulary.map(w=>w.word),['holiday']);assert.deepEqual(periods[1].reference.vocabulary.map(w=>w.word),['quiet']);
  periods[0].reference=makeTextbookReference(b,2,2,true);const rematched=suggestTextbookReferences(mapped,b);assert.deepEqual(rematched.units[0].periods[0].reference,periods[0].reference);validateTeaching({...emptyTeaching(),materials:[b,rematched]});
  const tampered=structuredClone(rematched);tampered.units[0].periods[0].reference.vocabulary[0].quote='made up';assert.throws(()=>validateTeaching({...emptyTeaching(),materials:[b,tampered]}),/词表关联/);
});
test('new AI requests contain just the selected lesson-plan unit and matching textbook pages, never legacy notes',()=>{
  const b=book(),c=suggestTextbookReferences(course(),b),legacy={...b,id:'old-notes',role:'auxiliary',primaryId:'ref',pages:pages(['PRIVATE OTHER NOTES'])};
  const selected=selectTeachingMaterials(c.units[0],[c,b,legacy]);assert.deepEqual(selected.map(m=>m.id),['course','ref']);assert(!JSON.stringify(selected).includes('PRIVATE'));assert(!selected[0].pages.some(p=>p.number===1));assert(!selected[1].pages.some(p=>p.number===3));assert(selected[1].pages.some(p=>p.number===4));
  const standalone=validateTeachingRequest({unitTitle:'Holiday',materials:selectTeachingMaterials(c.units[0],[c])});assert.equal(standalone.materials.length,1);assert.equal(prepareTeachingInput(standalone).input.materials[0].planningBasis,'lessonPlan');assert.throws(()=>validateTeachingRequest({unitTitle:'Holiday',materials:[...selected,legacy]}));
});
test('AI cannot add new periods or change the lesson count and missing suggestions preserve the original plan',()=>{
  const c=course(),r=validateTeachingRequest({unitTitle:'Holiday',materials:selectTeachingMaterials(c.units[0],[c])}),prepared=prepareTeachingInput(r);
  const value={goals:[],vocabulary:[],grammar:[],consolidation:[],extension:[],lessons:20,note:'Draft',references:['S1'],lessonSuggestions:[{lesson:1,title:'Speak',content:'Share a photo.',references:['S1']}]};const result=resolveTeachingAnalysis(value,prepared,r.materials);assert.equal(result.lessons,2);assert.equal(result.sourceStatus,'partial');assert.match(result.note,/部分教案课时/);
  assert.throws(()=>resolveTeachingAnalysis({...value,lessonSuggestions:[{...value.lessonSuggestions[0],lesson:8}]},prepared,r.materials),/教案外/);
});
test('deleting and clearing a reference textbook preserves the independent course, classes, plans and progress',()=>{
  const s=stateWithCourse(),b=book();s.materials=[suggestTextbookReferences(s.materials[0],b),b];s.plans=[generatePlan(s,s.classes[0])];const deleted=deleteMaterial(s,'ref',1);assert.equal(activeMaterials(deleted).length,1);assert.equal(activeClasses(deleted).length,1);assert.equal(teachingTrashSummary(deleted).classes.length,0);assert.deepEqual(restoreMaterial(deleted,'ref'),s);
  const cleared=purgeTeachingTrash(deleted,teachingTrashSummary(deleted).token);assert.deepEqual(cleared.fileIds,['ref']);assert.equal(cleared.state.classes.length,1);assert.deepEqual(cleared.state.plans,s.plans);assert.equal(cleared.state.materials[0].primaryId,'');assert(!cleared.state.materials[0].units[0].periods[0].reference);validateTeaching(cleared.state);
  const removedCourse=deleteMaterial(s,'course',2);assert.equal(teachingTrashSummary(removedCourse).classes.length,1);assert.equal(purgeTeachingTrash(removedCourse,teachingTrashSummary(removedCourse).token).state.materials[0].id,'ref');
});
test('switching an existing class to a lesson plan can retain the original shared preparation accounting',()=>{
  const s=fixture(),c=s.classes[0];c.sharedPrep=true;s.prepProgress=[{id:'actual',groupId:prepGroup(c),week:1,count:7}];const before=actualCounts(s,c);s.materials.push(course());const switched={...c,materialId:'course',unitIds:['unit-1'],exams:[],prepGroupId:prepGroup(c)};s.classes[0]=switched;validateTeaching(s);assert.deepEqual(actualCounts(s,switched),before);assert.equal(s.prepProgress[0].count,7);
});
