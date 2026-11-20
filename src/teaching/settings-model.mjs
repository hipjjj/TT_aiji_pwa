/** @param {import('./types').TeachingState} state */
export const activeTerms=state=>state.terms.filter(t=>!t.deletedAt);
/** @param {import('./types').TeachingState} state */
export const activeMaterials=state=>state.materials.filter(m=>!m.deletedAt&&(m.role==='primary'||state.materials.some(b=>b.id===m.primaryId&&!b.deletedAt)));
/** @param {import('./types').TeachingState} state */
export const activeClasses=state=>state.classes.filter(c=>!c.deletedAt&&state.terms.some(t=>t.id===c.termId&&!t.deletedAt)&&state.materials.some(m=>m.id===c.materialId&&!m.deletedAt));
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
  if(kind==='class'&&!activeMaterials(state).some(m=>m.id===row.materialId))throw Error('请先恢复关联的主教材');
  return {...state,[key]:state[key].map(row=>{if(row.id!==id)return row;const {deletedAt,...rest}=row;return rest;})};
}
export function setUnitCovered(covered,unit,checked){
  const ids=new Set(Array.from({length:unit.lessons},(_,i)=>`${unit.id}:${i+1}`)),next=new Set(covered||[]);
  for(const id of ids)if(checked)next.add(id);else next.delete(id);
  return [...next];
}
