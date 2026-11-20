import {assignCourse,activeMaterials} from './settings-model.mjs';
import {generatePlan,latestPlan,weekNumber} from './model.mjs';
/**
 * @param {{read:()=>Promise<import('./types').TeachingState>,change:(fn:(s:import('./types').TeachingState)=>import('./types').TeachingState)=>Promise<import('./types').TeachingState>,classId:string,materialId:string,date:string,signal:AbortSignal,analyze:(u:import('./types').Unit,m:import('./types').Material,signal:AbortSignal)=>Promise<import('./types').Analysis>,onProgress:(text:string)=>void}} options
 */
export async function prepareCoursePlan({read,change,classId,materialId,date,signal,analyze,onProgress}){
  const check=()=>{if(signal.aborted)throw new DOMException('已停止，已完成的单元仍保留','AbortError');};
  const initial=assignCourse(await read(),classId,materialId),c=initial.classes.find(c=>c.id===classId),m=initial.materials.find(m=>m.id===materialId);
  const units=m.units.filter(u=>c.unitIds.includes(u.id));
  for(const [i,u] of units.entries()){
    check();onProgress(`正在整理 ${i+1} / ${units.length} · ${u.title}`);
    if(u.analysis?.sourceStatus==='verified')continue;
    const analysis=await analyze(u,m,signal);check();
    await change(s=>{
      const current=activeMaterials(s).find(m=>m.id===materialId),unit=current?.units.find(x=>x.id===u.id);
      if(!unit)throw Error('教案已删除或目录发生变化，已完成的内容保留');
      if(JSON.stringify([unit.from,unit.to,unit.periods])!==JSON.stringify([u.from,u.to,u.periods]))throw Error('教案目录已修改，请重新核对后继续排课');
      return {...s,materials:s.materials.map(m=>m.id===materialId?{...m,units:m.units.map(x=>x.id===u.id?{...x,analysis:{...analysis,lessons:x.lessons}}:x)}:m)};
    });
  }
  check();const state=await change(s=>assignCourse(s,classId,materialId)),target=state.classes.find(c=>c.id===classId),term=state.terms.find(t=>t.id===target.termId),previous=latestPlan(state,classId);
  const from=previous?Math.max(1,Math.min(term.weeks,weekNumber(term,date))):1;
  return {state,plan:generatePlan(state,target,from,previous)};
}
