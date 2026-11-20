import {prepGroup,validateTeaching} from './model.mjs';
export function deleteMaterial(state,id,now=Date.now()){
  if(!state.materials.some(m=>m.id===id))throw Error('资料已不存在');
  return {...state,materials:state.materials.map(m=>m.id===id?{...m,deletedAt:now}:m)};
}
export function restoreMaterial(state,id){
  const material=state.materials.find(m=>m.id===id);if(!material)throw Error('资料已被清空');
  if(material.role!=='primary'&&!state.materials.some(m=>m.id===material.primaryId&&!m.deletedAt))throw Error('请先恢复关联的主教材');
  return {...state,materials:state.materials.map(m=>{if(m.id!==id)return m;const {deletedAt,...rest}=m;return rest;})};
}
/** @param {import('./types').TeachingState} state */
export function teachingTrashSummary(state){
  const primary=new Set(state.materials.filter(m=>m.role==='primary'&&m.deletedAt).map(m=>m.id));
  const materials=state.materials.filter(m=>m.deletedAt||m.role!=='primary'&&primary.has(m.primaryId));
  const materialIds=new Set(materials.map(m=>m.id)),terms=state.terms.filter(t=>t.deletedAt),termIds=new Set(terms.map(t=>t.id));
  const classes=state.classes.filter(c=>c.deletedAt||termIds.has(c.termId)||materialIds.has(c.materialId)),classIds=new Set(classes.map(c=>c.id));
  const plans=state.plans.filter(p=>classIds.has(p.classId)),progress=state.progress.filter(p=>classIds.has(p.classId));
  const removedGroups=new Set(classes.map(prepGroup)),keptGroups=new Set(state.classes.filter(c=>!classIds.has(c.id)).map(prepGroup));
  const prepProgress=state.prepProgress.filter(p=>removedGroups.has(p.groupId)&&!keptGroups.has(p.groupId));
  const roots=state.materials.filter(m=>m.deletedAt).length+terms.length+state.classes.filter(c=>c.deletedAt).length;
  const groups={materials,terms,classes,plans,progress,prepProgress};
  const token=JSON.stringify(Object.entries(groups).map(([k,rows])=>[k,rows.map(r=>r.id).sort()]));
  return {...groups,roots,token};
}
// Remove only citations pointing to purged files; preserve confirmed teaching
// content and remap each lesson's citation indices to the remaining sources.
function removeSources(analysis,removed){
  if(!analysis?.sources.some(s=>removed.has(s.materialId)))return analysis;
  const indices=new Map(),sources=[];analysis.sources.forEach((s,i)=>{if(!removed.has(s.materialId)){indices.set(i,sources.length);sources.push(s);}});
  return {...analysis,sources,sourceStatus:sources.length?'partial':'pending',
    note:(analysis.note.slice(0,2850)+'\n部分原始资料已清空，引用需重新核对；教学建议文字保留。').trim(),
    ...(analysis.lessonSuggestions?{lessonSuggestions:analysis.lessonSuggestions.map(l=>({...l,references:(l.references||[]).filter(i=>indices.has(i)).map(i=>indices.get(i))}))}:{}),
  };
}
export function purgeTeachingTrash(state,expectedToken){
  const summary=teachingTrashSummary(state);
  if(expectedToken!==summary.token)throw Error('已删除内容发生变化，请重新查看并确认清空');
  const materials=new Set(summary.materials.map(m=>m.id)),terms=new Set(summary.terms.map(t=>t.id)),classes=new Set(summary.classes.map(c=>c.id)),prep=new Set(summary.prepProgress.map(p=>p.id));
  const next={...state,
    materials:state.materials.filter(m=>!materials.has(m.id)).map(m=>({...m,units:m.units.map(u=>u.analysis?{...u,analysis:removeSources(u.analysis,materials)}:u)})),
    terms:state.terms.filter(t=>!terms.has(t.id)),classes:state.classes.filter(c=>!classes.has(c.id)),
    plans:state.plans.filter(p=>!classes.has(p.classId)),progress:state.progress.filter(p=>!classes.has(p.classId)),prepProgress:state.prepProgress.filter(p=>!prep.has(p.id)),
  };
  return {state:validateTeaching(next),fileIds:[...materials]};
}
