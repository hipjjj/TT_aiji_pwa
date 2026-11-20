import {assignCourse} from './settings-model.mjs';
import {generatePlan,latestPlan,weekNumber} from './model.mjs';
/** @param {import('./types').TeachingState} state */
export function prepareLocalCoursePlan(state,classId,materialId,date){
  const next=assignCourse(state,classId,materialId),c=next.classes.find(c=>c.id===classId),term=next.terms.find(t=>t.id===c.termId),previous=latestPlan(next,classId);
  const material=next.materials.find(m=>m.id===materialId);
  if(material.units.some(u=>c.unitIds.includes(u.id)&&(u.title==='待核对单元'||u.periods?.some(p=>p.title==='待核对课时'))))throw Error('教案目录尚未识别，请先核对单元与课时，再生成计划');
  const from=previous?Math.max(1,Math.min(term.weeks,weekNumber(term,date))):1;
  return {state:next,plan:generatePlan(next,c,from,previous,{contentMode:'local'})};
}
