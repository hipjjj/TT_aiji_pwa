import {prepareCoursePlan} from './batch.mjs';
import {analyzeUnit} from './ai';
import {isCourse,periodNumbers} from './course.mjs';
import {activeClasses} from './settings-model.mjs';
import React, { useEffect, useRef, useState } from 'react';
import { readTeaching, changeTeaching } from './store';
import { emptyTeaching, generatePlan, latestPlan, actualCounts, countLabels, weekNumber, prepGroup } from './model.mjs';
import type { TeachingState, Plan, WeekPlan, Counts } from './types';
import Materials from './Materials';
import Settings from './Settings';
import WeekEditor from './WeekEditor';
import { Modal } from '../nutrition/NutritionTab';
import './style.css';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export default function TeachingRoom({ onManageAI }: {
    onManageAI: () => void;
}) {
    const [state, setState] = useState<TeachingState>(() => emptyTeaching() as TeachingState), [ready, setReady] = useState(false), [selected, setSelected] = useState(''), [view, setView] = useState<'week' | 'term'>('week'), [panel, setPanel] = useState<'materials' | 'settings' | null>(null), [week, setWeek] = useState(1), [error, setError] = useState(''), [message, setMessage] = useState(''), [candidate, setCandidate] = useState<Plan | null>(null), [editor, setEditor] = useState<{
        week: WeekPlan;
        mode: 'actual' | 'plan';
    } | null>(null), [saving, setSaving] = useState(false);
    const [planning,setPlanning]=useState(''),batchController=useRef<AbortController|null>(null);
    useEffect(()=>()=>batchController.current?.abort(),[]);
    async function autoPlan(materialId:string,classId:string){if(planning)return;const controller=new AbortController();batchController.current=controller;setError('');setPlanning('正在准备教案与班级…');try{const result=await prepareCoursePlan({read:readTeaching,change:changeTeaching,classId,materialId,date:today(),signal:controller.signal,onProgress:setPlanning,analyze:(unit,material,signal)=>analyzeUnit(unit,[material],signal,seconds=>setPlanning(`请求较快，等待 ${seconds} 秒后自动继续…`))});acceptState(result.state);setSelected(classId);setCandidate(result.plan as Plan);setPanel(null);}catch(e){setError(controller.signal.aborted?'已停止，已完成的单元仍保留，再次一键排课可继续':e instanceof Error?e.message:'AI排课失败，已完成的内容仍保留');try{acceptState(await readTeaching());}catch{}}finally{setPlanning('');}}
    useEffect(() => { let active = true; readTeaching().then(s => { if (active) {
        setState(s);
        setSelected(activeClasses(s)[0]?.id || '');
        setReady(true);
    } }).catch(() => { if (active)
        setError('教学资料读取失败，请检查浏览器存储后重新进入'); }); return () => { active = false; }; }, []);
    const classes=activeClasses(state);const c = classes.find(c => c.id === selected), term = state.terms.find(t => t.id === c?.termId), plan = c ? latestPlan(state, c.id) as Plan | undefined : undefined;
    useEffect(() => { if (term)
        setWeek(Math.max(1, Math.min(term.weeks, weekNumber(term, today())))); }, [term?.id, term?.startDate]);
    function acceptState(next:TeachingState){setState(next);setSelected(id=>activeClasses(next).some(c=>c.id===id)?id:activeClasses(next)[0]?.id||'');setCandidate(null);setEditor(null);}
    async function save(change: (s: TeachingState) => TeachingState) { if (saving)
        return false; setSaving(true); setError(''); try {
        const next = await changeTeaching(change);
        setState(next);
        if(!activeClasses(next).some(c=>c.id===selected))setSelected(activeClasses(next)[0]?.id||'');
        setMessage('已保存到这台设备');
        return true;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '保存失败，请检查本地空间');
        return false;
    }
    finally {
        setSaving(false);
    } }
    async function adopt() { if (!candidate)
        return; if (await save(s => ({ ...s, plans: [...s.plans, candidate] }))) {
        setCandidate(null);
        setMessage('周计划已保存；实际进度独立保留');
    } }
    const totals = c ? actualCounts(state, c) : { homework: 0, dictation: 0, prep: 0 };
    const progress = c ? state.progress.filter(p => p.classId === c.id) : [];
    function replan() { if(c&&!isCourse(state.materials.find(m=>m.id===c.materialId))){setError('请先在管理设置中为这个班选择教学教案，再安排后续计划；旧计划仍保留');return;} if (!c)
        return; try {
        setError('');
        setCandidate(generatePlan(state, c, week, plan));
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '无法生成计划');
    } }
    function cloneClass() { if (!c)
        return; const copy = { ...structuredClone(c), prepGroupId:c.sharedPrep?c.prepGroupId:undefined, id: crypto.randomUUID(), name: `${c.name}（副本）`, quotas: { homework: { ...c.quotas.homework, initial: 0 }, dictation: { ...c.quotas.dictation, initial: 0 }, prep: { ...c.quotas.prep, initial: c.sharedPrep ? c.quotas.prep.initial : 0 } } }; void save(s => ({ ...s, classes: [...s.classes, copy] })).then(ok => { if (ok) {
        setSelected(copy.id);
        setPanel('settings');
    } }); }
    async function moveLesson(id: string, from: number, to: number) { if (!c || !plan || from === to)
        return; const target = plan.weeks.find(w => w.week === to); if (!target)
        return; if (target.locked || progress.some(p => p.week === to || p.week === from)) {
        setError('有实际记录或锁定的周次请先核对，课程未移动');
        return;
    } const lesson = plan.weeks[from - 1].lessons.find(l => l.id === id); if (!lesson)
        return; const next = { ...structuredClone(plan), id: crypto.randomUUID(), createdAt: Date.now(), weeks: plan.weeks.map(w => w.week === from ? { ...w, lessons: w.lessons.filter(l => l.id !== id) } : w.week === to ? { ...w, lessons: [...w.lessons, lesson] } : w) }; setCandidate(next); }
    if (!ready)
        return <section className="teaching teach-card"><p role="status">正在打开教学手册…</p>{error && <p className="teach-error">{error}</p>}</section>;
    return <section className="teaching" aria-label="教学进度"><div className="teach-heading"><span className="park-label">ONE WEEK, A LITTLE PROGRESS</span><div className="teach-row"><h2>教学进度</h2><div className="teach-actions">{panel ? <button disabled={!!planning} onClick={() => setPanel(null)}>返回教学进度</button> : <><button onClick={() => setPanel('materials')}>添加教案</button><button onClick={() => setPanel('settings')}>管理设置</button></>}</div></div><p>把本周要教的、要练的，慢慢安排好。</p></div>
    {error && <p className="teach-error" role="alert">{error}</p>}{message && <p className="teach-message" role="status">{message}</p>}
    {!panel&&!!classes.length && <label className="teach-class-select">当前班级<select value={selected} onChange={e => { setSelected(e.target.value); setCandidate(null); setEditor(null); }}>{classes.map(c => <option value={c.id} key={c.id}>{state.terms.find(t => t.id === c.termId)?.title} · {c.name}</option>)}</select></label>}
    {!panel&&<div className="teach-tabs" role="group" aria-label="教学视图">{([['week', '本周'], ['term', '学期']] as const).map(([id, title]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{title}</button>)}</div>}
    {panel === 'settings' ? <Settings state={state} selected={selected} onSave={save} onClose={() => setPanel(null)} onSelected={setSelected} onState={acceptState}/> : panel === 'materials' ? <Materials state={state} onState={acceptState} onSave={save} onManageAI={onManageAI} planning={planning} onStop={()=>batchController.current?.abort()} onManageClasses={()=>setPanel('settings')} onAutoPlan={(materialId,classId)=>void autoPlan(materialId,classId)}/> : !c ? <div className="teach-card teach-empty"><span aria-hidden="true">📖</span><h3>从一份教案开始</h3><p>可以先设置学期与班级，也可以先添加教案，再一次安排全部教学课时。</p><div className="teach-actions"><button onClick={() => setPanel('settings')}>设置学期与班级</button><button className="teach-primary" onClick={()=>setPanel('materials')}>添加教案</button></div></div> : <>
      <div className="teach-context"><span>{term?.title}</span><span>{state.materials.find(m => m.id === c.materialId)?.title}</span></div>{plan?.materialId&&plan.materialId!==c.materialId&&<p className="teach-warning">当前显示已保存的历史计划。教案已更换，请预览重排后续安排；历史版本与实际记录保留。</p>}
      {view === 'week' ? <><div className="teach-week-nav"><button disabled={week <= 1} onClick={() => setWeek(week - 1)} aria-label="上一周">‹</button><label>查看周次<select value={week} onChange={e => setWeek(Number(e.target.value))}>{Array.from({ length: term!.weeks }, (_, i) => <option key={i + 1} value={i + 1}>第{i + 1}周</option>)}</select></label><button disabled={week >= term!.weeks} onClick={() => setWeek(week + 1)} aria-label="下一周">›</button></div>{plan?.weeks.find(w => w.week === week) ? renderWeek(plan.weeks.find(w => w.week === week)!, true) : <div className="teach-card teach-empty"><h3>准备好这学期的安排</h3><p>请先确认教案单元与课时、考试范围和检查要求。生成后可先预览再保存。</p><button className="teach-primary" disabled={saving} onClick={()=>setPanel('materials')}>{c.materialId?'AI一键排课':'添加教案并排课'}</button></div>}
      {progress.some(p => p.consolidation) && <details className="teach-card"><summary>收好的待巩固内容</summary>{progress.filter(p => p.consolidation).map(p => <p key={p.id}>第{p.week}周：{p.consolidation}</p>)}</details>}</> : <>
        <section className="teach-card"><div className="teach-row"><h3>学期检查进度</h3><button onClick={cloneClass}>复制班级设置</button></div><p className="teach-help">按实际完成统计，已安排的任务仍需执行后记录。</p>{(Object.keys(countLabels) as (keyof Counts)[]).map(key => { const q = c.quotas[key], planned = plan?.weeks.filter(w => key==='prep'?!state.prepProgress.some(p=>p.groupId===prepGroup(c)&&p.week===w.week):!progress.some(p => p.week === w.week)).reduce((s, w) => s + w.counts[key], 0) || 0; const remaining = Math.max(0, q.target - totals[key]); return <details className="teach-quota" key={key}><summary><span>{countLabels[key]}{key === 'prep' && c.sharedPrep ? ' · 共享' : ''}</span><b>{totals[key]} / {q.target}</b></summary><progress max={q.target || 1} value={Math.min(q.target, totals[key])}/><p>还需完成 {remaining} · 后续已安排 {planned} · 未安排 {Math.max(0, remaining - planned)}</p><p className="teach-help">{q.mode === 'exact' ? '固定数量' : '至少完成'} · 检查截止 {q.deadline}</p>{plan?.weeks.map(w => <div className="teach-quota-week" key={w.week}><span>第{w.week}周</span><span>计划 {w.counts[key]}</span><span>实际 {key === 'prep' ? state.prepProgress.find(p => p.groupId === prepGroup(c) && p.week === w.week)?.count ?? '待记录' : progress.find(p => p.week === w.week)?.counts[key] ?? '待记录'}</span></div>)}</details>; })}</section>
        {c.exams.length > 0 && <section className="teach-card"><h3>考试节点</h3>{c.exams.map(e => { const m = state.materials.find(m => m.id === c.materialId); const lessons = (m?.units||[]).filter(u => e.unitIds.includes(u.id)).reduce((n, u) => n + u.lessons, 0); const done = new Set([...(c.coveredLessons || []), ...progress.flatMap(p => p.completed)]); const covered = (m?.units||[]).filter(u => e.unitIds.includes(u.id)).reduce((n, u) => n + periodNumbers(u).map(n => `${u.id}:${n}`).filter(id => done.has(id)).length, 0); return <div className="teach-exam" key={e.id}><b>{e.title} · {e.date}</b><p>{(m?.units||[]).filter(u => e.unitIds.includes(u.id)).map(u => u.title).join('、') || '尚未勾选单元范围'}</p>{e.detail && <p>{e.detail}</p>}<small>指定单元已讲授 {covered} / {lessons} 节建议内容 · 考前预留 {e.review} 节复习</small></div>; })}</section>}
        <div className="teach-row"><h3>每周安排</h3><button disabled={saving} onClick={replan}>{plan ? '预览重排' : '生成周计划'}</button></div><p className="teach-help">重排从当前选择的第{week}周开始；已记录实际进度或锁定的周保留。可在“本周”切换起始周。</p>{plan && plan.warnings.length > 0 && <details className="teach-card teach-warning"><summary>需要核对的安排（{plan.warnings.length}）</summary>{plan.warnings.map((x, i) => <p key={i}>{x}</p>)}</details>}{plan?.weeks.map(w => <details className="teach-semester-week" key={w.week}><summary>第{w.week}周 · {w.start}<span>{w.lessons.length}节新课{w.locked ? ' · 已锁定' : ''}</span></summary>{renderWeek(w, false)}</details>)}
        {!!state.plans.filter(p => p.classId === c.id).length && <details className="teach-card"><summary>历史计划版本</summary>{state.plans.filter(p => p.classId === c.id).sort((a, b) => b.createdAt - a.createdAt).map(p => <div className="teach-history" key={p.id}><span>{new Date(p.createdAt).toLocaleString('zh-CN')}</span><button disabled={saving || p.id === plan?.id} onClick={() => setCandidate({ ...structuredClone(p), id: crypto.randomUUID(), createdAt: Date.now(), warnings: [...p.warnings, '恢复历史安排将生成新版本，实际完成记录独立保留。'] })}>预览恢复</button></div>)}</details>}
      </>}
    </>}
    {candidate && <Modal open eyebrow="A LITTLE TEACHING DESK" title="核对新的周计划" onClose={() => setCandidate(null)}><div className="teaching">{error && <p className="teach-error">{error}</p>}<p className="teach-help">{state.classes.find(c => c.id === candidate.classId)?.name} · 确认后保存为新版本，旧版本和实际记录保留。</p>{candidate.warnings.map((w, i) => <p className="teach-warning" key={i}>{w}</p>)}<div className="teach-plan-comparison">{candidate.weeks.map(w => { const old = plan?.weeks.find(x => x.week === w.week); return <details key={w.week}><summary>第{w.week}周 · {w.lessons.length}节建议新课{w.locked ? ' · 已锁定' : ''}</summary><p>课时 {w.capacity} · 复习 {w.review} · 机动 {w.buffer}</p>{old && <p className="teach-help">原计划新课 {old.lessons.length} 节；作业 {old.counts.homework}、听写 {old.counts.dictation}、教案 {old.counts.prep}</p>}<p>新计划：作业 {w.counts.homework}、听写 {w.counts.dictation}、教案 {w.counts.prep}</p>{w.lessons.map(l => <p key={l.id}>{l.title}<small>{l.content}</small></p>)}</details>; })}</div><button className="teach-primary" disabled={saving} onClick={() => void adopt()}>确认采用此计划</button></div></Modal>}
    {editor && c && plan && <Modal open eyebrow="A LITTLE TEACHING DESK" title={editor.mode === 'actual' ? '更新本周实际进度' : '调整本周安排'} onClose={() => setEditor(null)}><>{error && <p className="teach-error" role="alert">{error}</p>}<WeekEditor key={`${editor.week.week}:${editor.mode}`} week={editor.week} c={c} state={state} mode={editor.mode} onClose={() => setEditor(null)} onSave={async (w, p, prep) => { const ok = editor.mode === 'actual' ? await save(s => ({ ...s, progress: [...s.progress.filter(x => x.id !== p.id), p], prepProgress: [...s.prepProgress.filter(x => x.id !== prep.id), prep] })) : await save(s => ({ ...s, plans: [...s.plans, { ...plan, id: crypto.randomUUID(), createdAt: Date.now(), weeks: plan.weeks.map(x => x.week === w.week ? w : x) }] })); if (ok) {
        setEditor(null);
        setMessage(editor.mode === 'actual' ? '实际进度已保存，可预览重新安排后续内容' : '周安排已保存为新版本');
    } }}/></></Modal>}
  </section>;
    function renderWeek(w: WeekPlan, full: boolean) {
        const p = progress.find(p => p.week === w.week);
        return <article className="teach-card teach-current" key={w.week}><div className="teach-row"><div><span className="teach-tag">第{w.week}周{w.locked ? ' · 已锁定' : ''}</span><h3>{w.start} — {w.end}</h3></div><span className="teach-capacity">{w.capacity}<small>有效课时</small></span></div><div className="teach-counts"><span>建议新课 <b>{w.lessons.length}</b></span><span>复习 <b>{w.review}</b></span><span>机动 <b>{w.buffer}</b></span></div>{w.lessons.length > w.capacity - w.review - w.buffer && <p className="teach-warning">本周内容超过可用课时，请调整或移至其他周。</p>}<h4>本周教学重点</h4>{!w.lessons.length ? <p className="teach-help">本周以复习、机动或校历安排为主。</p> : <><ul className="teach-goals">{[...new Set(w.lessons.map(l => l.unitId))].map(id => { const m = state.materials.find(m => m.id === (plan?.materialId||c?.materialId)), u = m?.units.find(u => u.id === id); return <li key={id}><b>{u?.title}</b><span>{u?.analysis?.goals.join('；') || '具体重点可由AI整理教案或手动补充'}</span><small>教案 {u?.from}—{u?.to}{state.materials.find(m=>m.id===c?.materialId)?.format==='txt'||state.materials.find(m=>m.id===c?.materialId)?.format==='docx'?'段':'页'}</small></li>; })}</ul><details><summary>每节课建议内容（可灵活调整）</summary>{w.lessons.map(l => <div className="teach-lesson" key={l.id}><b>{l.title}</b><p>{l.content}</p><small>{l.source}</small>{!w.locked && !p && <label>移至其他周<select value={w.week} onChange={e => void moveLesson(l.id, w.week, Number(e.target.value))}>{plan?.weeks.map(x => <option key={x.week} value={x.week}>第{x.week}周{x.locked ? '（锁定）' : ''}</option>)}</select></label>}</div>)}</details></>}
      <div className="teach-check-card"><h4>本周检查任务</h4><div className="teach-counts">{(Object.keys(countLabels) as (keyof Counts)[]).map(key => <span key={key}>{countLabels[key]}<b>{w.counts[key]}</b><small>实际 {key === 'prep' ? state.prepProgress.find(x => x.groupId === prepGroup(c!) && x.week === w.week)?.count ?? '待记录' : p?.counts[key] ?? '待记录'}</small></span>)}</div></div>{w.note && <p className="teach-week-note">{w.note}</p>}{p && <div className="teach-actual"><h4>实际进度</h4><p>实际上课 {p.lessons}节 · 确认讲授 {p.completed.length}项</p>{p.note && <p>{p.note}</p>}{p.consolidation && <p>待巩固：{p.consolidation}</p>}</div>}<div className="teach-actions"><button className="teach-primary" onClick={() => setEditor({ week: w, mode: 'actual' })}>更新进度</button><button onClick={() => setEditor({ week: w, mode: 'plan' })}>调整／锁定本周</button>{full && <button disabled={saving} onClick={replan}>重排后续</button>}</div></article>;
    }
}
