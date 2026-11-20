import React,{useState} from 'react';
import {Modal} from '../nutrition/NutritionTab';
import {emptyTeachingTrash,readTeaching} from './store';
import {teachingTrashSummary,restoreMaterial} from './trash-model.mjs';
import {restoreSetting} from './settings-model.mjs';
import type {TeachingState} from './types';
export default function TrashPanel({state,onSave,onState}:{state:TeachingState;onSave:(change:(s:TeachingState)=>TeachingState)=>Promise<boolean>;onState:(s:TeachingState)=>void}){
  const [token,setToken]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const summary=teachingTrashSummary(state);
  const counts=[['资料与原文件',summary.materials.length],['学期',summary.terms.length],['班级',summary.classes.length],['计划版本',summary.plans.length],['实际进度',summary.progress.length],['教案完成记录',summary.prepProgress.length]] as const;
  async function purge(){if(!token||busy)return;setBusy(true);setError('');try{const next=await emptyTeachingTrash(token);onState(next);setToken(null);setMessage('工作中的已删除内容已清空');}catch(e){setError(e instanceof Error?e.message:'清空失败，内容仍保留');setToken(null);try{onState(await readTeaching());}catch{/* Keep the last readable state and the error. */}}finally{setBusy(false);}}
  return <details className="teach-trash"><summary>已删除内容 · {summary.roots}项</summary><p className="teach-help">这里汇总工作中的已删除资料、学期和班级。恢复主教材或学期后，未单独删除的关联内容会重新显示。</p>
    {state.materials.filter(m=>m.deletedAt).map(m=><div className="teach-setting-item" key={m.id}><span>{m.title}<small>{m.role==='primary'?'主教材':m.role==='lessonPlan'?'教案':'辅助资料'}</small></span><button disabled={busy} onClick={()=>void onSave(s=>restoreMaterial(s,m.id))}>恢复资料</button></div>)}
    {state.terms.filter(t=>t.deletedAt).map(t=><div className="teach-setting-item" key={t.id}><span>{t.title}</span><button disabled={busy} onClick={()=>void onSave(s=>restoreSetting(s,'term',t.id))}>恢复学期</button></div>)}
    {state.classes.filter(c=>c.deletedAt).map(c=><div className="teach-setting-item" key={c.id}><span>{c.name}</span><button disabled={busy} onClick={()=>void onSave(s=>restoreSetting(s,'class',c.id))}>恢复班级</button></div>)}
    {!summary.roots&&<p className="teach-help">暂无已删除内容。</p>}
    {error&&<p className="teach-error" role="alert">{error}</p>}{message&&<p className="teach-message" role="status">{message}</p>}
    <button className="teach-danger" disabled={busy||!summary.roots} onClick={()=>{setError('');setToken(summary.token);}}>一键清空已删除内容</button>
    {token&&<Modal open title="确认清空已删除内容" eyebrow="YOUR TEACHING ARCHIVE" onClose={()=>{if(!busy)setToken(null);}}><div className="teaching"><p>将永久清空工作中的以下已删除内容，包括关联记录及本机原文件。清空后无法在应用内恢复。</p><ul>{counts.filter(([,n])=>n>0).map(([label,n])=><li key={label}>{label}：{n}</li>)}</ul>{summary.materials.length>0&&<p className="teach-help">资料：{summary.materials.map(m=>m.title).join('、')}</p>}{summary.classes.length>0&&<p className="teach-help">关联班级：{summary.classes.map(c=>c.name).join('、')}</p>}<p className="teach-help">其他仍在使用的资料和计划保留。保留内容中指向已清空资料的引用会标记为待核对。</p><div className="teach-actions"><button disabled={busy} onClick={()=>setToken(null)}>取消</button><button className="teach-danger" disabled={busy} onClick={()=>void purge()}>{busy?'正在清空…':'确认永久清空'}</button></div></div></Modal>}
  </details>;
}
