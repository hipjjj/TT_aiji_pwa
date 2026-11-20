import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/teaching-fixture.mjs';
import {detectCourseUnits} from '../src/teaching/course.mjs';
import {extractUnitOverview,extractLessonContent} from '../src/teaching/lesson-content.mjs';
import {prepareLocalCoursePlan} from '../src/teaching/local-plan.mjs';
import {validateTeaching,validateTeachingBackup,generatePlan} from '../src/teaching/model.mjs';
function setup(){
  const s=fixture(),texts=[
    'Unit 1 Holiday\nLanguage skills:\nTalk about holidays.\nCultural awareness:\nRespect cultures.\nKey words and phrases:\nancient, camp, guide, might\nKey grammar:\nSimple past tense.\nAllocation of periods:\nPeriod 1 Section A\nPeriod 2 Section B\n单元（章）集备要点\n第（1）单元（章）',
    'Unit 2 Home\nLanguage skills:\nMake polite requests.\nKey words and phrases:\nhome, clean\nKey grammar:\nPolite requests.\n单元（章）集备要点\n第（2）单元（章）',
    'Unit 1 Holiday · Section A Listening\n1 / 2\n1. Talk about a holiday.\n2. Use short answers.\nStep 1\nLead in\n1. Guide students to share photos. They might talk in pairs.\nStep 2\nPractice\n1. Teach new vocabularies: ancient, camp.\n2. Ask students to practise.',
    'Step 3\nSummary\nSay two holiday sentences.\nHomework\nMust-do:\n1. Copy the new words.\nChoose to do: interview a friend.\nUnit 1 Holiday\nBb design\nUnrelated board drawing.',
    'Unit 1 Holiday · Section B Reading\n2 / 2\n1. Read a holiday story.\nStep 1\nRead\nGuide students to find the events.\nHomework\nRetell the story.',
    'Unit 2 Home · Section A\n1 / 1\n1. Make a request.\nStep 1\nSpeak\nPractise polite requests.\nHomework\nWrite two sentences.',
  ],pages=texts.map((text,i)=>({number:i+1,text,bold:[]}));
  s.materials=[{id:'local-course',role:'lessonPlan',planningBasis:'lessonPlan',format:'pdf',primaryId:'',title:'Synthetic lesson plan',pages,units:detectCourseUnits(pages),createdAt:1}];s.classes[0]={...s.classes[0],materialId:'',unitIds:[],exams:[]};return s;
}
test('the supplied layout yields unit context and exact per-period goals, stages and homework without invented vocabulary',()=>{
  const s=setup(),m=s.materials[0],u=m.units[0],overview=extractUnitOverview(m,u),lesson=extractLessonContent(m,u,u.periods[0]);
  assert.deepEqual(overview.pages,[1]);assert.deepEqual(overview.goals,['Talk about holidays.']);assert.equal(overview.grammar,'Simple past tense.');assert.deepEqual(lesson.vocabulary,['ancient','camp']);assert.deepEqual(lesson.steps.map(s=>s.number),[1,2,3]);assert.match(lesson.content,/Use short answers/);assert.match(lesson.homework,/interview a friend/);assert(!lesson.homework.includes('Unrelated board'));assert(!overview.goals.includes('Make polite requests.'));
});
test('local generation works without AI, preserves its existing analyses and previews all real periods once',()=>{
  const s=setup(),m=s.materials[0];m.units[0].analysis={goals:['AI goal'],vocabulary:[],grammar:[],consolidation:[],extension:[],lessons:90,note:'Existing draft',sources:[],lessonSuggestions:[{lesson:1,title:'AI title',content:'CACHED AI CONTENT'}]};const before=structuredClone(s),prepared=prepareLocalCoursePlan(s,s.classes[0].id,m.id,'2026-09-01');
  const lessons=prepared.plan.weeks.flatMap(w=>w.lessons);assert.equal(prepared.plan.method,'local');assert.deepEqual(lessons.map(l=>l.id),['unit-1:1','unit-1:2','unit-2:1']);assert.match(lessons[0].content,/Talk about a holiday/);assert(!lessons[0].content.includes('CACHED AI CONTENT'));assert.match(lessons[0].source,/PDF 3–4/);assert.match(lessons[0].source,/集备 1/);assert.deepEqual(s,before);assert.deepEqual(prepared.state.materials,s.materials);assert.equal(prepared.state.plans.length,0);assert(!prepared.plan.warnings.some(w=>/尚未.*分析|尚未由AI/.test(w)));
  const stored={...prepared.state,plans:[prepared.plan]};validateTeaching(stored);validateTeachingBackup({teaching:{state:stored,files:[],filesIncluded:false}});
});
test('local replanning preserves locked weeks, actual progress and task totals',()=>{
  let s=setup();const first=prepareLocalCoursePlan(s,s.classes[0].id,s.materials[0].id,'2026-09-01');s=first.state;const c=s.classes[0],old=first.plan;old.weeks[0].locked=true;s.plans=[old];s.progress=[{id:'actual',classId:c.id,week:2,lessons:1,completed:[],consolidation:'Review requests.',note:'Keep this actual record.',counts:{homework:1,dictation:0,prep:0}}];const before=structuredClone(s);const next=prepareLocalCoursePlan(s,c.id,c.materialId,'2026-09-15');assert.deepEqual(next.plan.weeks[0],old.weeks[0]);assert.deepEqual(next.plan.weeks[1],old.weeks[1]);assert.deepEqual(next.state.progress,before.progress);assert.deepEqual(s,before);assert.equal(next.plan.method,'local');assert.equal(generatePlan(s,c,3,old).method,'local');
});
test('unrecognized directories must be checked before local generation',()=>{const s=setup(),m=s.materials[0];m.units=detectCourseUnits([{number:1,text:'A paragraph with no recognizable lesson structure.',bold:[]}]);m.pages=[{number:1,text:'A paragraph with no recognizable lesson structure.',bold:[]}];assert.throws(()=>prepareLocalCoursePlan(s,s.classes[0].id,m.id,'2026-09-01'),/目录尚未识别/);});
test('fallback excerpts stay traceable and absent objectives are not invented',()=>{const s=setup(),m=s.materials[0],u=m.units[1];m.pages[5].text='An ordinary paragraph without structured objectives.';const result=extractLessonContent(m,u,u.periods[0]);assert.equal(result.goals.length,0);assert.equal(result.steps.length,0);assert.match(result.content,/单元语法参考/);assert.match(result.content,/An ordinary paragraph/);assert(!result.content.includes('AI goal'));});
