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
    const [role, setRole] = useState<'primary' | 'auxiliary'>('primary'), [primaryId, setPrimaryId] = useState(state.materials.find(m => m.role === 'primary')?.id || ''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [editing, setEditing] = useState<string | null>(null), [analysis, setAnalysis] = useState<{
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
        return; setError(''); const c = new AbortController(); controller.current = c; setBusy('准备读取PDF…'); try {
        const { readTeachingPDF } = await import('./pdf');
        const pages = await readTeachingPDF(file, c.signal, (n, total) => { if (alive.current)
            setBusy(`读取PDF ${n} / ${total} 页`); });
        if (c.signal.aborted)
            return;
        const units = detectUnits(pages);
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join('');
        const m: Material = { id: crypto.randomUUID(), fingerprint: hash, title: file.name.replace(/\.pdf$/i, '').slice(0, 200), role, primaryId: role === 'auxiliary' ? primaryId : '', pages, units: units.length ? units : [{ id: 'unit-1', title: '待确认单元', from: 1, to: pages.length, printedFrom: '', lessons: 8 }], createdAt: Date.now() };
        if (role === 'auxiliary' && !primaryId)
            throw Error('请先选择关联的主教材');
        const next = await saveMaterial(m, file);
        if (alive.current) {
            onState(next);
            setEditing(m.id);
            if (role === 'primary')
                setPrimaryId(m.id);
        }
    }
    catch (e) {
        if (alive.current)
            setError(c.signal.aborted ? '已取消导入' : e instanceof Error ? e.message : 'PDF导入失败');
    }
    finally {
        if (alive.current)
            setBusy('');
    } }
    async function analyze(m: Material, u: Unit) { setError(''); setBusy(`正在分析 ${u.title}…`); const c = new AbortController(); controller.current = c; const timer = setTimeout(() => c.abort(), 80000); try {
        const materials = [m, ...state.materials.filter(x => x.role === 'auxiliary' && x.primaryId === m.id)];
        const result = await analyzeUnit(u, materials, c.signal);
        if (alive.current)
            setAnalysis({ materialId: m.id, unitId: u.id, value: result });
    }
    catch (e) {
        if (alive.current)
            setError(c.signal.aborted ? '分析已停止或超时，已有内容保留' : e instanceof Error ? e.message : '分析失败');
    }
    finally {
        clearTimeout(timer);
        if (alive.current)
            setBusy('');
    } }
    async function attachPDF(file?: File) { if (!file || !attach || busy)
        return; setError(''); setBusy('正在核对原PDF…'); try {
        if (file.size > 20 * 1024 * 1024)
            throw Error('请选择20MB以内的原PDF');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join('');
        if (hash !== attach.fingerprint)
            throw Error('文件与原来导入的PDF不同，请选择同一份原文件');
        await db.teachingFiles.put({ id: attach.id, name: file.name, blob: file });
        setAttach(null);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '无法补回原PDF');
    }
    finally {
        setBusy('');
    } }
    async function openPage(materialId: string, n: number) { try {
        const f = await db.teachingFiles.get(materialId);
        if (f) {
            const url = URL.createObjectURL(f.blob);
            const a = document.createElement('a');
            a.href = url + `#page=${n}`;
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
    return <div className="teach-materials"><section className="teach-card"><div className="teach-row"><h2>教材资料</h2><button onClick={onManageAI}>AI连接</button></div><p className="teach-help">主教材确定教学内容，知识清单作为辅助。文字版PDF最高20MB、300页；先确认单元页码，再逐单元分析。</p><div className="teach-grid"><label>资料类型<select value={role} disabled={!!busy} onChange={e => setRole(e.target.value as typeof role)}><option value="primary">主教材</option><option value="auxiliary">辅助知识清单</option></select></label>{role === 'auxiliary' && <label>关联教材<select value={primaryId} required onChange={e => setPrimaryId(e.target.value)}><option value="">请选择</option>{state.materials.filter(m => m.role === 'primary').map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>}</div><input hidden type="file" accept="application/pdf,.pdf" ref={attachInput} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void attachPDF(f); }}/><input hidden type="file" accept="application/pdf,.pdf" ref={input} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void importPDF(f); }}/><button className="teach-primary" disabled={!!busy || (role === 'auxiliary' && !primaryId)} onClick={() => input.current?.click()}>＋ 导入PDF</button>{busy && <div className="teach-status" role="status">{busy}<button onClick={() => controller.current?.abort()}>停止</button></div>}{error && <p className="teach-error" role="alert">{error}</p>}</section>
    {state.materials.map(m => <section className="teach-card" key={m.id}><span className="teach-tag">{m.role === 'primary' ? '主教材' : '辅助清单'} · {m.pages.length}页</span><h3>{m.title}</h3>{m.role === 'auxiliary' && <p className="teach-help">关联：{state.materials.find(x => x.id === m.primaryId)?.title || '未关联'}</p>}<div className="teach-actions"><button disabled={!!busy} onClick={() => setEditing(editing === m.id ? null : m.id)}>{editing === m.id ? '收起目录' : '核对／编辑目录'}</button><button onClick={() => void openPage(m.id, 1)}>查看原PDF</button><button disabled={!!busy} onClick={() => { setAttach(m); attachInput.current?.click(); }}>补回PDF</button></div>{editing === m.id && <Directory key={m.id} material={m} onSave={async (value) => { if (await onSave(s => ({ ...s, materials: s.materials.map(x => x.id === value.id ? value : x) })))
            setEditing(null); }}/>}
      {m.units.map(u => <details key={u.id}><summary>{u.title}<span className="teach-unit-status">{u.analysis ? '已分析' : '待整理'}</span></summary><p className="teach-help">PDF {u.from}–{u.to} 页{u.printedFrom ? ` · 印刷起始页 ${u.printedFrom}` : ''} · 建议 {u.lessons} 课时</p><button onClick={() => void openPage(m.id, u.from)}>定位原文</button>{m.role === 'primary' && <><div className="teach-actions"><button disabled={!!busy} onClick={() => void analyze(m, u)}>{u.analysis ? '重新分析' : 'AI分析本单元'}</button><button disabled={!!busy} onClick={() => setAnalysis({ materialId: m.id, unitId: u.id, value: u.analysis || { goals: [], vocabulary: [], grammar: [], consolidation: [], extension: [], lessons: u.lessons, note: '教师手动整理', sources: [] } })}>手动整理</button></div>{u.analysis && <AnalysisView value={u.analysis} materials={state.materials} openPage={openPage}/>}</>}</details>)}
    </section>)}
    {analysis && <Modal open eyebrow="A LITTLE TEACHING DESK" title="确认单元教学建议" onClose={() => setAnalysis(null)}><>{error && <p className="teach-error" role="alert">{error}</p>}<AnalysisEditor key={analysis.unitId} value={analysis.value} onSave={async (value) => { if (await onSave(s => ({ ...s, materials: s.materials.map(m => m.id === analysis.materialId ? { ...m, units: m.units.map(u => u.id === analysis.unitId ? { ...u, lessons: value.lessons, analysis: value } : u) } : m) })))
        setAnalysis(null);
    else
        setError('教学建议未能保存，请检查各项长度和引用，原内容保留'); }}/></></Modal>}
    {page && <Modal open eyebrow="A LITTLE TEACHING DESK" title={`PDF第 ${page.page} 页 · 文字`} onClose={() => setPage(null)}><p className="teach-help">备份未包含原PDF，仍可查阅已保存的文字。可使用“补回PDF”恢复原文件版面。</p><pre className="teach-source">{state.materials.find(m => m.id === page.materialId)?.pages[page.page - 1]?.text || '此页未提取文字'}</pre></Modal>}
  </div>;
}
function Directory({ material, onSave }: {
    material: Material;
    onSave: (m: Material) => Promise<void>;
}) { const [m, setM] = useState(() => structuredClone(material)), [busy, setBusy] = useState(false); return <form className="teach-directory" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
    await onSave(m);
}
finally {
    setBusy(false);
} }}><label>资料名称<input required maxLength={200} value={m.title} onChange={e => setM({ ...m, title: e.target.value })}/></label><p className="teach-help">自动识别结果需要核对。PDF页码从文件第一页起算，印刷页码按书上标注填写。课时估算可调整；辅助资料按相同单元编号关联。</p>{m.units.map((u, i) => <fieldset key={u.id}><legend>{u.id}</legend><label>单元名称<input required maxLength={200} value={u.title} onChange={e => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, title: e.target.value } : x) })}/></label><div className="teach-grid"><NumberField label="PDF起始页" value={u.from} min={1} max={m.pages.length} onChange={from => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, from } : x) })}/><NumberField label="PDF结束页" value={u.to} min={u.from} max={m.pages.length} onChange={to => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, to } : x) })}/><label>印刷起始页<input maxLength={30} value={u.printedFrom} onChange={e => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, printedFrom: e.target.value } : x) })}/></label><NumberField label="建议课时" value={u.lessons} min={1} max={100} onChange={lessons => setM({ ...m, units: m.units.map((x, j) => i === j ? { ...x, lessons } : x) })}/></div><button type="button" onClick={() => setM({ ...m, units: m.units.filter((_, j) => i !== j) })}>移除此单元</button></fieldset>)}<div className="teach-actions"><button type="button" onClick={() => { let n = 1; while (m.units.some(u => u.id === `unit-${n}`))
    n++; setM({ ...m, units: [...m.units, { id: `unit-${n}`, title: `Unit ${n}`, from: 1, to: 1, printedFrom: '', lessons: 8 }] }); }}>＋ 添加单元</button><button className="teach-primary" disabled={busy}>保存目录</button></div></form>; }
const sections = { goals: '保底重点', vocabulary: '重点词汇与短语', grammar: '基础句型与语法', consolidation: '补基础与巩固', extension: '选做拓展' } as const;
export function AnalysisView({ value, materials, openPage }: {
    value: Analysis;
    materials: Material[];
    openPage: (id: string, n: number) => void;
}) { return <div className="teach-analysis">{Object.entries(sections).map(([key, label]) => value[key as keyof typeof sections].length > 0 && <div key={key}><h4>{label}</h4><ul>{value[key as keyof typeof sections].map((text, i) => <li key={i}>{text}</li>)}</ul></div>)}<p className="teach-help">{value.note}</p><details><summary>原文出处与核对</summary>{value.sources.map((s, i) => <blockquote key={i}><p>{s.quote}</p><button onClick={() => openPage(s.materialId, s.page)}>{materials.find(m => m.id === s.materialId)?.title} · PDF {s.page}页</button></blockquote>)}{!value.sources.length && <p>教师手动整理，暂无原文引用。</p>}</details></div>; }
function AnalysisEditor({ value, onSave }: {
    value: Analysis;
    onSave: (a: Analysis) => Promise<void>;
}) { const [a, setA] = useState(() => structuredClone(value)), [busy, setBusy] = useState(false); return <form className="teaching" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try {
    await onSave(a);
}
finally {
    setBusy(false);
} }}><p className="teach-help">这是可修改的教学建议。请核对后保存；重点词以原教材为准，建议不表示学生已经掌握。</p>{Object.entries(sections).map(([key, label]) => <label key={key}>{label}（每行一项）<textarea rows={3} maxLength={20000} value={a[key as keyof typeof sections].join('\n')} onChange={e => setA({ ...a, [key]: e.target.value.split('\n') })}/></label>)}<NumberField label="建议课时" value={a.lessons} min={1} max={100} onChange={lessons => setA({ ...a, lessons })}/><label>估算说明／待核对差异<textarea rows={3} maxLength={3000} value={a.note} onChange={e => setA({ ...a, note: e.target.value })}/></label><details><summary>查看本次引用</summary>{a.sources.map((s, i) => <p key={i}>PDF {s.page}页：{s.quote}</p>)}</details><button className="teach-primary" disabled={busy}>确认保存教学建议</button></form>; }
