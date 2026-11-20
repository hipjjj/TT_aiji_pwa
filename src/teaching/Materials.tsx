import {detectPlanSections,materialLocation,teachingMime} from './files.mjs';
import React, { useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { saveMaterial } from './store';
import { detectUnits } from './model.mjs';
import { analyzeUnit } from './ai';
import type { Material, Unit, Analysis, TeachingState } from './types';
import { NumberField } from './Settings';
import { Modal } from '../nutrition/NutritionTab';
export default function Materials({ state, onState, onSave, onManageAI }: {
    state: TeachingState;
    onState: (s: TeachingState) => void;
    onSave: (fn: (s: TeachingState) => TeachingState) => Promise<boolean>;
    onManageAI: () => void;
}) {
    const [role, setRole] = useState<Material['role']>('primary'), [primaryId, setPrimaryId] = useState(state.materials.find(m => m.role === 'primary')?.id || ''),[unitId,setUnitId]=useState(''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [editing, setEditing] = useState<string | null>(null), [analysis, setAnalysis] = useState<{
        materialId: string;
        unitId: string;
        value: Analysis;
    } | null>(null), [attach, setAttach] = useState<Material | null>(null), [page, setPage] = useState<{
        materialId: string;
        page: number;
    } | null>(null);
    const attachInput = useRef<HTMLInputElement>(null), input = useRef<HTMLInputElement>(null), controller = useRef<AbortController | null>(null), alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
    async function importPDF(file?: File) { if (!file || busy)
        return; setError(''); const c = new AbortController(); controller.current = c; setBusy('准备读取资料…'); try {
        const {readTeachingFile}=await import('./documents');
        const {pages,format}=await readTeachingFile(file, c.signal, (n, total) => { if (alive.current)
            setBusy(`读取资料 ${n} / ${total} 页`); });
        if (c.signal.aborted)
            return;
        if(role!=='lessonPlan'&&format!=='pdf')throw Error('主教材和知识清单请使用PDF；Word和TXT请选“教案”');
        const book=state.materials.find(m=>m.id===primaryId&&m.role==='primary');
        const units = role==='lessonPlan'?detectPlanSections(pages,book?.units||[],unitId||book?.units[0]?.id):detectUnits(pages);
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join('');
        const m: Material = { id: crypto.randomUUID(), fingerprint: hash, title: file.name.replace(/\.(pdf|docx|txt)$/i, '').slice(0, 200), role,format, primaryId: role !== 'primary' ? primaryId : '', pages, units: units.length ? units : [{ id: 'unit-1', title: '待确认单元', from: 1, to: pages.length, printedFrom: '', lessons: 8,...(role==='lessonPlan'?{unitId:book?.units[0]?.id,lessonFrom:1,lessonTo:1}:{}) }], createdAt: Date.now() };
        if (role !== 'primary' && !primaryId)
            throw Error('请先选择关联的主教材');
        const next = await saveMaterial(m, file);
        if (alive.current) {
            onState(next);
            setEditing(m.id);
            if (role === 'primary'){setPrimaryId(m.id);setUnitId('');}
        }
    }
    catch (e) {
        if (alive.current)
            setError(c.signal.aborted ? '已取消导入' : e instanceof Error ? e.message : '资料导入失败');
    }
    finally {
        if (alive.current)
            setBusy('');
    } }
    async function analyze(m: Material, u: Unit) { setError(''); setBusy(`正在分析 ${u.title}…`); const c = new AbortController(); controller.current = c; let timedOut=false;const timer = setTimeout(() => {timedOut=true;c.abort();}, 80000); try {
        const materials = [m, ...state.materials.filter(x => x.role !== 'primary' && x.primaryId === m.id)];
        const result = await analyzeUnit(u, materials, c.signal);
        if (alive.current)
            setAnalysis({ materialId: m.id, unitId: u.id, value: result });
    }
    catch (e) {
        if (alive.current)
            setError(c.signal.aborted ? (timedOut?'本次分析等待超时，请重试或缩小单元页码范围；已有内容保留':'已停止本次分析，已有内容保留') : e instanceof Error ? e.message : '分析失败');
    }
    finally {
        clearTimeout(timer);
        if (alive.current)
            setBusy('');
    } }
    async function attachPDF(file?: File) { if (!file || !attach || busy)
        return; setError(''); setBusy('正在核对原文件…'); try {
        if (file.size > 20 * 1024 * 1024)
            throw Error('请选择20MB以内的原文件');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join('');
        if (hash !== attach.fingerprint)
            throw Error('文件与原来导入的资料不同，请选择同一份原文件');
        await db.teachingFiles.put({ id: attach.id, name: file.name, blob: new Blob([file],{type:teachingMime[attach.format||'pdf']}) });
        setAttach(null);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '无法补回原文件');
    }
    finally {
        setBusy('');
    } }
    async function openPage(materialId: string, n: number) { try {
        const f = await db.teachingFiles.get(materialId);
        if (f) {
            const url = URL.createObjectURL(f.blob);
            const a = document.createElement('a');
            const m=state.materials.find(m=>m.id===materialId);a.href=url+((m?.format||'pdf')==='pdf'?`#page=${n}`:'');if(m?.format&&m.format!=='pdf')a.download=f.name;
            a.target = '_blank';
            a.rel = 'noopener';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        else
            setPage({ materialId, page: n });
    }
    catch {
        setPage({ materialId, page: n });
    } }
    return <div className="teach-materials"><section className="teach-card"><div className="teach-row"><h2>上传与整理资料</h2><button onClick={onManageAI}>AI连接</button></div><p className="teach-help">主教材、知识清单和教案收在这里。教案支持PDF、Word（DOCX）和TXT，按单元与课时整理后可交给AI整合。</p><div className="teach-grid"><label>资料类型<select value={role} disabled={!!busy} onChange={e => setRole(e.target.value as typeof role)}><option value="primary">主教材</option><option value="auxiliary">辅助知识清单</option><option value="lessonPlan">教案</option></select></label>{role !== 'primary' && <label>关联教材<select value={primaryId} required onChange={e => {setPrimaryId(e.target.value);setUnitId('');}}><option value="">请选择</option>{state.materials.filter(m => m.role === 'primary').map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>}{role==='lessonPlan'&&<label>默认所属单元<select value={unitId||state.materials.find(m=>m.id===primaryId)?.units[0]?.id||''} onChange={e=>setUnitId(e.target.value)}>{state.materials.find(m=>m.id===primaryId)?.units.map(u=><option value={u.id} key={u.id}>{u.title}</option>)}</select></label>}</div><input hidden type="file" accept=".pdf,.docx,.txt" ref={attachInput} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void attachPDF(f); }}/><input hidden type="file" accept={role==='lessonPlan'?'.pdf,.docx,.txt':'application/pdf,.pdf'} ref={input} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void importPDF(f); }}/><button className="teach-primary" disabled={!!busy || (role !== 'primary' && !primaryId)} onClick={() => input.current?.click()}>＋ 选择文件上传</button>{busy && <div className="teach-status" role="status">{busy}<button onClick={() => controller.current?.abort()}>停止</button></div>}{error && <p className="teach-error" role="alert">{error}</p>}</section>
    {state.materials.map(m => <section className="teach-card" key={m.id}><span className="teach-tag">{m.role === 'primary' ? '主教材' : m.role==='lessonPlan'?'教案':'辅助清单'} · {m.pages.length}{m.format&&m.format!=='pdf'?'段':'页'}</span><h3>{m.title}</h3>{m.role !== 'primary' && <p className="teach-help">关联：{state.materials.find(x => x.id === m.primaryId)?.title || '未关联'}</p>}<div className="teach-actions"><button disabled={!!busy} onClick={() => setEditing(editing === m.id ? null : m.id)}>{editing === m.id ? '收起目录' : '核对／编辑目录'}</button><button onClick={() => void openPage(m.id, 1)}>查看原文件</button><button disabled={!!busy} onClick={() => { setAttach(m); attachInput.current?.click(); }}>补回原文件</button></div>{editing === m.id && <Directory key={m.id} material={m} books={state.materials.filter(x=>x.role==='primary')} onSave={async (value) => { if (await onSave(s => ({ ...s, materials: s.materials.map(x => x.id === value.id ? value : x) })))
            setEditing(null); }}/>}
      {m.units.map(u => <details key={u.id}><summary>{u.title}<span className="teach-unit-status">{u.analysis ? u.analysis.sourceStatus==='pending'||u.analysis.sourceStatus==='partial'?'引用待核对':'已分析' : '待整理'}</span></summary><p className="teach-help">{materialLocation(m,u.from,u.to)}{m.role==='lessonPlan'?` · 第${u.lessonFrom}–${u.lessonTo}课时`:u.printedFrom?'':''}{u.printedFrom ? ` · 印刷起始页 ${u.printedFrom}` : ''}{m.role!=='lessonPlan'&&<> · 建议 {u.lessons} 课时</>}</p><button onClick={() => void openPage(m.id, u.from)}>定位原文</button>{m.role === 'primary' && <><div className="teach-actions"><button disabled={!!busy} onClick={() => void analyze(m, u)}>{state.materials.some(x=>x.role==='lessonPlan'&&x.primaryId===m.id&&x.units.some(s=>s.unitId===u.id))?'AI整合教案':u.analysis?'重新分析':'AI分析本单元'}</button><button disabled={!!busy} onClick={() => setAnalysis({ materialId: m.id, unitId: u.id, value: u.analysis || { goals: [], vocabulary: [], grammar: [], consolidation: [], extension: [], lessons: u.lessons, note: '教师手动整理', sources: [] } })}>手动整理</button></div>{u.analysis && <AnalysisView value={u.analysis} materials={state.materials} openPage={openPage}/>}</>}</details>)}
    </section>)}
    {analysis && <Modal open eyebrow="A LITTLE TEACHING DESK" title="确认单元教学建议" onClose={() => setAnalysis(null)}><>{error && <p className="teach-error" role="alert">{error}</p>}<AnalysisEditor key={analysis.unitId} value={analysis.value} onSave={async (value) => { if (await onSave(s => ({ ...s, materials: s.materials.map(m => m.id === analysis.materialId ? { ...m, units: m.units.map(u => u.id === analysis.unitId ? { ...u, lessons: value.lessons, analysis: value } : u) } : m) })))
        setAnalysis(null);
    else
        setError('教学建议未能保存，请检查各项长度和引用，原内容保留'); }}/></></Modal>}
    {page && <Modal open eyebrow="A LITTLE TEACHING DESK" title={`${materialLocation(state.materials.find(m=>m.id===page.materialId),page.page)} · 文字`} onClose={() => setPage(null)}><p className="teach-help">备份未包含原文件，仍可查阅已保存的文字。可使用“补回原文件”恢复原文件版面。</p><pre className="teach-source">{state.materials.find(m => m.id === page.materialId)?.pages[page.page - 1]?.text || '此页未提取文字'}</pre></Modal>}
  </div>;
}
function Directory({ material, books, onSave }: {
    material: Material;
    books:Material[];
    onSave: (m: Material) => Promise<void>;
}) { const [m, setM] = useState(() => structuredClone(material)), [busy, setBusy] = useState(false); return <form className="teach-directory" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
    await onSave(m);
}
finally {
    setBusy(false);
} }}><label>资料名称<input required maxLength={200} value={m.title} onChange={e => setM({ ...m, title: e.target.value })}/></label><p className="teach-help">请核对识别结果。PDF按实际页码定位；Word与TXT按文字分段定位。教案需确认所属单元和覆盖课时，再到主教材单元点击“AI整合教案”。</p>{m.units.map((u, i) => <fieldset key={u.id}><legend>{m.role==='lessonPlan'?'教案课时范围':u.id}</legend>{m.role==='lessonPlan'&&<><label>所属单元<select required value={u.unitId||''} onChange={e=>setM({...m,units:m.units.map((x,j)=>i===j?{...x,unitId:e.target.value}:x)})}>{books.find(b=>b.id===m.primaryId)?.units.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label><div className="teach-grid"><NumberField label="起始课时" value={u.lessonFrom||1} min={1} max={100} onChange={lessonFrom=>setM({...m,units:m.units.map((x,j)=>i===j?{...x,lessonFrom}:x)})}/><NumberField label="结束课时" value={u.lessonTo||1} min={u.lessonFrom||1} max={100} onChange={lessonTo=>setM({...m,units:m.units.map((x,j)=>i===j?{...x,lessonTo}:x)})}/></div></>}<label>{m.role==='lessonPlan'?'课时标题':'单元名称'}<input required maxLength={200} value={u.title} onChange={e => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, title: e.target.value } : x) })}/></label><div className="teach-grid"><NumberField label={m.format&&m.format!=='pdf'?'资料起始段':'PDF起始页'} value={u.from} min={1} max={m.pages.length} onChange={from => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, from } : x) })}/><NumberField label={m.format&&m.format!=='pdf'?'资料结束段':'PDF结束页'} value={u.to} min={u.from} max={m.pages.length} onChange={to => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, to } : x) })}/>{m.role!=='lessonPlan'&&<><label>印刷起始页<input maxLength={30} value={u.printedFrom} onChange={e => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, printedFrom: e.target.value } : x) })}/></label><NumberField label="建议课时" value={u.lessons} min={1} max={100} onChange={lessons => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, lessons } : x) })}/></>}</div><button type="button" onClick={() => setM({ ...m, units: m.units.filter((_, j) => i !== j) })}>移除此单元</button></fieldset>)}<div className="teach-actions"><button type="button" onClick={() => { let n = 1; while (m.units.some(u => u.id === `unit-${n}`))
    n++; setM({ ...m, units: [...m.units, { id: `unit-${n}`, title: `Unit ${n}`, from: 1, to: 1, printedFrom: '', lessons: 8,...(m.role==='lessonPlan'?{unitId:books.find(b=>b.id===m.primaryId)?.units[0]?.id,lessonFrom:1,lessonTo:1}:{}) }] }); }}>{m.role==='lessonPlan'?'＋ 添加课时范围':'＋ 添加单元'}</button><button className="teach-primary" disabled={busy}>保存目录</button></div></form>; }
const sections = { goals: '保底重点', vocabulary: '重点词汇与短语', grammar: '基础句型与语法', consolidation: '补基础与巩固', extension: '选做拓展' } as const;
export function AnalysisView({ value, materials, openPage }: {
    value: Analysis;
    materials: Material[];
    openPage: (id: string, n: number) => void;
}) { return <div className="teach-analysis">{(value.sourceStatus==='pending'||value.sourceStatus==='partial')&&<p className="teach-warning">{value.sourceStatus==='pending'?'原文引用尚未定位，以下为待核对建议。':'部分引用待核对，已保留可定位的原文。'}</p>}{Object.entries(sections).map(([key, label]) => value[key as keyof typeof sections].length > 0 && <div key={key}><h4>{label}</h4><ul>{value[key as keyof typeof sections].map((text, i) => <li key={i}>{text}</li>)}</ul></div>)}<p className="teach-help">{value.note}</p>{!!value.lessonSuggestions?.length&&<details><summary>按教案整合的课时安排</summary>{value.lessonSuggestions.map(l=><div className="teach-lesson" key={l.lesson}><b>第{l.lesson}课时 · {l.title}</b><p>{l.content}</p></div>)}</details>}<details><summary>原文出处与核对</summary>{value.sources.map((s, i) => <blockquote key={i}><p>{s.quote}</p><button onClick={() => openPage(s.materialId, s.page)}>{materials.find(m => m.id === s.materialId)?.title} · {materialLocation(materials.find(m=>m.id===s.materialId),s.page)}</button></blockquote>)}{!value.sources.length && <p>暂无可定位的原文引用，请对照教材核对。</p>}</details></div>; }
function AnalysisEditor({ value, onSave }: {
    value: Analysis;
    onSave: (a: Analysis) => Promise<void>;
}) { const [a, setA] = useState(() => structuredClone(value)), [busy, setBusy] = useState(false); return <form className="teaching" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
    await onSave(a);
}
finally {
    setBusy(false);
} }}>{(a.sourceStatus==='pending'||a.sourceStatus==='partial')&&<p className="teach-warning">{a.sourceStatus==='pending'?'原文引用尚未定位，请先对照教材核对。结果仍可保存为待核对建议。':'部分原文引用尚未定位，请对照教材核对后保存。'}</p>}<p className="teach-help">这是可修改的教学建议。请核对后保存；重点词以原教材为准，建议不表示学生已经掌握。</p>{Object.entries(sections).map(([key, label]) => <label key={key}>{label}（每行一项）<textarea rows={3} maxLength={20000} value={a[key as keyof typeof sections].join('\n')} onChange={e => setA({ ...a, [key]: e.target.value.split('\n') })}/></label>)}{a.lessonSuggestions?.map((l,i)=><fieldset key={l.lesson}><legend>第{l.lesson}课时 · 教案安排</legend><label>课时标题<input maxLength={200} value={l.title} onChange={e=>setA({...a,lessonSuggestions:a.lessonSuggestions?.map((x,j)=>i===j?{...x,title:e.target.value}:x)})}/></label><label>教学内容<textarea rows={3} maxLength={3000} value={l.content} onChange={e=>setA({...a,lessonSuggestions:a.lessonSuggestions?.map((x,j)=>i===j?{...x,content:e.target.value}:x)})}/></label></fieldset>)}<NumberField label="建议课时" value={a.lessons} min={1} max={100} onChange={lessons => setA({ ...a, lessons })}/><label>估算说明／待核对差异<textarea rows={3} maxLength={3000} value={a.note} onChange={e => setA({ ...a, note: e.target.value })}/></label><details><summary>查看本次引用</summary>{a.sources.map((s, i) => <p key={i}>PDF {s.page}页：{s.quote}</p>)}</details><button className="teach-primary" disabled={busy}>{a.sourceStatus==='pending'||a.sourceStatus==='partial'?'保存待核对建议':'确认保存教学建议'}</button></form>; }
