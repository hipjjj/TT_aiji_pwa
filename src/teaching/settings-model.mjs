/** @param {import('./types').TeachingState} state */
export const activeTerms=state=>state.terms.filter(t=>!t.deletedAt);
/** @param {import('./types').TeachingState} state */
export const activeMaterials=state=>state.materials.filter(m=>!m.deletedAt&&(m.role==='primary'||m.planningBasis==='lessonPlan'||state.materials.some(b=>b.id===m.primaryId&&!b.deletedAt)));
/** @param {import('./types').TeachingState} state */
export const activeClasses=state=>state.classes.filter(c=>!c.deletedAt&&state.terms.some(t=>t.id===c.termId&&!t.deletedAt)&&(!c.materialId||activeMaterials(state).some(m=>m.id===c.materialId)));
export function deleteSetting(state,kind,id,now=Date.now()){
  const key=kind==='term'?'terms':kind==='class'?'classes':null;
  if(!key||!state[key].some(row=>row.id===id))throw Error('设置已不存在');
  return {...state,[key]:state[key].map(row=>row.id===id?{...row,deletedAt:now}:row)};
}
export function restoreSetting(state,kind,id){
  const key=kind==='term'?'terms':kind==='class'?'classes':null;
  if(!key||!state[key].some(row=>row.id===id))throw Error('设置已不存在');
  const row=state[key].find(row=>row.id===id);
  if(kind==='class'&&!activeTerms(state).some(t=>t.id===row.termId))throw Error('请先恢复所属学期');
  if(kind==='class'&&row.materialId&&!activeMaterials(state).some(m=>m.id===row.materialId))throw Error('请先恢复关联的教案');
  return {...state,[key]:state[key].map(row=>{if(row.id!==id)return row;const {deletedAt,...rest}=row;return rest;})};
}
export function setUnitCovered(covered,unit,checked){
  const ids=new Set((unit.periods?unit.periods.map(p=>p.number):Array.from({length:unit.lessons},(_,i)=>i+1)).map(n=>`${unit.id}:${n}`)),next=new Set(covered||[]);
  for(const id of ids)if(checked)next.add(id);else next.delete(id);
  return [...next];
}
import {prepGroup} from './model.mjs';
import {isCourse} from './course.mjs';
export function assignCourse(state,classId,materialId){
  const c=activeClasses(state).find(c=>c.id===classId),m=activeMaterials(state).find(m=>m.id===materialId&&isCourse(m));
  if(!c||!m||!m.units.length)throw Error('请选择已保存的班级和有效教案');
  if(c.materialId===m.id)return state;
  const next={...c,materialId:m.id,unitIds:m.units.map(u=>u.id),exams:c.exams.map(e=>({...e,unitIds:e.unitIds.filter(id=>m.units.some(u=>u.id===id))})),prepGroupId:prepGroup(c)};
  return {...state,classes:state.classes.map(x=>x.id===c.id?next:x),plans:state.plans.map(p=>p.classId===c.id&&!p.materialId&&c.materialId?{...p,materialId:c.materialId}:p)};
}
