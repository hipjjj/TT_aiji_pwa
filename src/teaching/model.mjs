import {materialLocation,teachingMime} from './files.mjs';
import {isCourse,courseLessons} from './course.mjs';
export const countLabels = { homework: '作业', dictation: '听写', prep: '教案课时' };
export const emptyTeaching = () => ({ version: 1, materials: [], terms: [], classes: [], plans: [], progress: [], prepProgress: [] });
export const zeroCounts = () => ({ homework: 0, dictation: 0, prep: 0 });
export function integer(n, min = 0, max = 10000) { return Number.isInteger(n) && n >= min && n <= max; }
export function isDate(s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s))
    return false; const d = new Date(s + 'T12:00:00Z'); return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s; }
export function addDays(s, n) { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function weekNumber(term, date) { return Math.floor((Date.parse(date + 'T12:00:00Z') - Date.parse(term.startDate + 'T12:00:00Z')) / 86400000 / 7) + 1; }
export const prepGroup = c => c.prepGroupId || (c.sharedPrep ? `shared:${c.termId}:${c.materialId}` : c.id);
const str = (v, max = 2000) => typeof v === 'string' && v.length <= max;
const id = v => typeof v === 'string' && v.length > 0 && v.length <= 200;
const unique = rows => new Set(rows.map(x => x.id)).size === rows.length;
export function validateTeaching(state) {
    if (!state || state.version !== 1)
        throw Error('教学资料版本无效');
    for (const k of ['materials', 'terms', 'classes', 'plans', 'progress', 'prepProgress'])
        if (!Array.isArray(state[k]) || state[k].length > (k === 'progress' || k === 'prepProgress' ? 30000 : k === 'plans' ? 1000 : 500) || !unique(state[k]))
            throw Error('教学资料列表无效或编号重复');
    for (const m of state.materials) {
        if (!id(m.id) || !str(m.title, 200) || !['primary', 'auxiliary','lessonPlan'].includes(m.role) || !Array.isArray(m.pages) || m.pages.length > 300 || !Array.isArray(m.units) || m.units.length > 100 || !unique(m.units))
            throw Error('教材资料格式无效');
        if(m.format!==undefined&&!['pdf','docx','txt'].includes(m.format))throw Error('资料文件类型无效');
        if(m.planningBasis!==undefined&&!isCourse(m))throw Error('教案课程类型无效');
        if(isCourse(m)&&m.primaryId&&!state.materials.some(b=>b.id===m.primaryId&&b.role==='primary'))throw Error('参考教材不存在');
        m.pages.forEach((p, i) => { if (p.number !== i + 1 || !str(p.text, 50000) || !Array.isArray(p.bold) || p.bold.some(x => !str(x, 2000)))
            throw Error('教材页面无效'); });
        if (m.pages.reduce((s, p) => s + p.text.length, 0) > 1500000)
            throw Error('教材文字太长');
        if(m.fingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(m.fingerprint))throw Error('PDF文件指纹无效');
        for (const u of m.units) {
            if (!id(u.id) || !str(u.title, 200) || !integer(u.from, 1, m.pages.length) || !integer(u.to, u.from, m.pages.length) || !str(u.printedFrom, 30) || !integer(u.lessons, 1, 100))
                throw Error('单元页码或建议课时无效');
            if(m.role==='lessonPlan'&&!isCourse(m)&&(!state.materials.some(b=>b.id===m.primaryId&&b.role==='primary'&&b.units.some(x=>x.id===u.unitId))||!integer(u.lessonFrom,1,100)||!integer(u.lessonTo,u.lessonFrom,100)))throw Error('教案所属单元或覆盖课时无效');
            if(isCourse(m)){
                if(!Array.isArray(u.periods)||!u.periods.length||u.periods.length>100||u.lessons!==u.periods.length||new Set(u.periods.map(p=>p.number)).size!==u.periods.length)throw Error('教案课时目录无效');
                for(const p of u.periods){
                    if(!integer(p.number,1,100)||!str(p.title,200)||!integer(p.from,u.from,u.to)||!integer(p.to,p.from,u.to))throw Error('教案课时编号或页码无效');
                    if(p.reference){const r=p.reference,b=state.materials.find(b=>b.id===r.materialId&&b.role==='primary');if(!b||!integer(r.from,1,b.pages.length)||!integer(r.to,r.from,b.pages.length)||typeof r.locked!=='boolean'||!str(r.printedFrom,30)||!str(r.printedTo,30)||!Array.isArray(r.vocabulary)||r.vocabulary.length>100||r.vocabulary.some(w=>!str(w.word,100)||!str(w.meaning,300)||!integer(w.printedPage,1,500)||!integer(w.page,1,b.pages.length)||!str(w.quote,500)||!w.quote.trim()||!b.pages[w.page-1].text.includes(w.quote)))throw Error('教材页码或词表关联无效');}
                }
            }else if(u.periods!==undefined)throw Error('课时目录需关联教案课程');
            if (u.analysis)
                validateTeachingAnalysis(u.analysis, state.materials);
        }
    }
    if([...state.materials,...state.terms,...state.classes].some(x=>x.deletedAt!==undefined&&(!Number.isFinite(x.deletedAt)||x.deletedAt<=0)))throw Error('删除内容状态无效');
    for (const t of state.terms)
        if (!id(t.id) || !str(t.title, 100) || !isDate(t.startDate) || !integer(t.weeks, 1, 60))
            throw Error('学期日期或周数无效');
    for (const c of state.classes) {
        const term = state.terms.find(t => t.id === c.termId), material = state.materials.find(m => m.id === c.materialId && (m.role === 'primary'||isCourse(m)));
        if (!id(c.id) || !str(c.name, 100) || !term || !material || !integer(c.weeklyLessons, 0, 50) || !integer(c.lessonMinutes, 1, 180) || !integer(c.buffer, 0, 20) || typeof c.sharedPrep !== 'boolean')
            throw Error('班级或课表设置无效');
        if(c.prepGroupId!==undefined&&!id(c.prepGroupId))throw Error('原教案统计范围无效');
        if (c.coveredLessons !== undefined && (!Array.isArray(c.coveredLessons) || c.coveredLessons.some(x => !id(x))))
            throw Error('初始已讲授范围无效');
        if (!Array.isArray(c.unitIds) || !c.unitIds.length || new Set(c.unitIds).size !== c.unitIds.length || c.unitIds.some(x => !material.units.some(u => u.id === x)))
            throw Error('请选择有效的学期单元范围');
        if (!Array.isArray(c.schedule) || c.schedule.length > 7 || new Set(c.schedule.map(s => s.weekday)).size !== c.schedule.length || c.schedule.some(s => !integer(s.weekday, 0, 6) || !integer(s.periods, 0, 10) || !str(s.time, 80)))
            throw Error('星期课表无效');
        if (!Array.isArray(c.exceptions) || c.exceptions.length > 500 || new Set(c.exceptions.map(e => e.date)).size !== c.exceptions.length || c.exceptions.some(e => !isDate(e.date) || !integer(e.lessons, 0, 20) || !str(e.note, 200)))
            throw Error('停补课日期重复或格式无效');
        if (!Array.isArray(c.overrides) || new Set(c.overrides.map(e => e.week)).size !== c.overrides.length || c.overrides.some(e => !integer(e.week, 1, term.weeks) || !integer(e.lessons, 0, 50)))
            throw Error('周课时覆盖设置无效');
        if (!Array.isArray(c.exams) || c.exams.length > 20 || !unique(c.exams) || c.exams.some(e => !id(e.id) || !str(e.title, 100) || !isDate(e.date) || weekNumber(term, e.date) < 1 || weekNumber(term, e.date) > term.weeks || !integer(e.review, 0, 100) || !integer(e.occupied, 0, 50) || !str(e.detail) || !Array.isArray(e.unitIds) || e.unitIds.some(x => !c.unitIds.includes(x))))
            throw Error('考试日期、范围或课时无效');
        for (const key of Object.keys(countLabels)) {
            const q = c.quotas?.[key];
            if (!q || !integer(q.target) || !integer(q.initial) || !isDate(q.deadline) || q.deadline < term.startDate || q.deadline > addDays(term.startDate, term.weeks * 7 - 1) || !['minimum', 'exact'].includes(q.mode))
                throw Error('检查数量或截止日期无效');
        }
    }
    for (const p of state.plans) {
        const c = state.classes.find(c => c.id === p.classId), term = c && state.terms.find(t => t.id === c.termId);
        if (!id(p.id) || !c || !Number.isFinite(p.createdAt) || !Array.isArray(p.weeks) || p.weeks.length > 60 || !Array.isArray(p.warnings) || p.warnings.some(x => !str(x)))
            throw Error('教学计划格式无效');
        if(p.materialId!==undefined&&!id(p.materialId))throw Error('计划资料编号无效');
        p.weeks.forEach((w, i) => { if (w.week !== i + 1 || !isDate(w.start) || !isDate(w.end) || !integer(w.capacity, 0, 200) || !integer(w.review, 0, 100) || !integer(w.buffer, 0, 100) || !str(w.note, 5000) || typeof w.locked !== 'boolean' || !Array.isArray(w.lessons) || w.lessons.length > 100 || w.lessons.some(l => !id(l.id) || !id(l.unitId) || !str(l.title, 300) || !str(l.content, 5000) || !str(l.source, 500)) || Object.keys(countLabels).some(k => !integer(w.counts?.[k])))
            throw Error('周计划内容无效'); });
    }
    for (const p of state.progress)
        if (!id(p.id) || !state.classes.some(c => c.id === p.classId) || !integer(p.week, 1, 60) || !integer(p.lessons, 0, 100) || !Array.isArray(p.completed) || p.completed.some(x => !id(x)) || !str(p.consolidation, 5000) || !str(p.note, 5000) || Object.keys(countLabels).some(k => !integer(p.counts?.[k])))
            throw Error('实际进度格式无效');
    for (const p of state.prepProgress)
        if (!id(p.id) || !id(p.groupId) || !integer(p.week, 1, 60) || !integer(p.count))
            throw Error('教案完成记录无效');
    return state;
}
export function validateTeachingAnalysis(value, materials) {
    if(value?.sourceStatus!==undefined&&!['verified','partial','pending'].includes(value.sourceStatus))throw Error('原文引用状态无效');
    if (!value || !integer(value.lessons, 1, 100) || !str(value.note, 3000))
        throw Error('AI教学建议格式无效');
    for (const key of ['goals', 'vocabulary', 'grammar', 'consolidation', 'extension'])
        if (!Array.isArray(value[key]) || value[key].length > 100 || value[key].some(x => !str(x, 1000)))
            throw Error('AI知识点列表无效');
    if (!Array.isArray(value.sources) || value.sources.length > 100)
        throw Error('AI来源格式无效');
    for (const s of value.sources) {
        const m = materials.find(m => m.id === s.materialId);
        if (!m || !integer(s.page, 1, 300) || !m.pages.some(p => p.number === s.page) || !str(s.quote, 500) || !s.quote.trim() || !m.pages.find(p => p.number === s.page).text.replace(/\s+/g, ' ').includes(s.quote.replace(/\s+/g, ' ')))
            throw Error('AI引用无法在所选原文定位，请重试或手动整理');
    }
    if(value.lessonSuggestions!==undefined&&(!Array.isArray(value.lessonSuggestions)||value.lessonSuggestions.length>20||new Set(value.lessonSuggestions.map(l=>l.lesson)).size!==value.lessonSuggestions.length||value.lessonSuggestions.some(l=>!integer(l.lesson,1,100)||!str(l.title,200)||!str(l.content,3000)||l.references!==undefined&&(!Array.isArray(l.references)||l.references.some(n=>!integer(n,0,value.sources.length-1))))))throw Error('教案课时建议无效');
    return value;
}
// Detect body headings rather than TOC entries. Imported page boundaries remain editable.
export function detectUnits(pages) {
    const strong = [], inline = [];
    for (const p of pages) {
        const lines = p.text.split('\n').map(s => s.trim()).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
            if (/^UNIT$/i.test(lines[i]) && /In this unit/i.test(p.text)) {
                const before = lines[i - 1]?.match(/^(\d{1,2})$/);
                const match = lines[i + 1]?.match(/^(\d{1,2})\s*(.*)$/);
                if (before) {
                    const end = lines.at(-1)?.match(/(\d+)\s*$/)?.[1] || '';
                    const footer = lines.slice(-5).reverse().find(x => /^[A-Za-z][A-Za-z ’‘?!,.-]+$/.test(x) && !/^UNIT|^Question/.test(x));
                    strong.push({ n: Number(before[1]), title: footer || `Unit ${before[1]}`, page: p.number, printed: end });
                    break;
                }
                if (!match)
                    continue;
                const more = [];
                for (let j = i + 2; j < Math.min(lines.length, i + 5); j++) {
                    if (/BIG|Question|What |Why |How |In this/i.test(lines[j]))
                        break;
                    more.push(lines[j]);
                }
                strong.push({ n: Number(match[1]), title: [match[2], ...more].join(' ').trim(), page: p.number, printed: lines.at(-1)?.match(/(\d+)\s*$/)?.[1] || '' });
                break;
            }
            const match = lines[i].match(/^Unit\s*(\d{1,2})\s+([A-Za-z].+)$/i);
            if (match && !/\.{3}|…/.test(match[2]))
                inline.push({ n: Number(match[1]), title: match[2], page: p.number, printed: '', mid: lines.slice(0, i).some(x => !/^\d+\s*\/\s*\d+$/.test(x)) });
        }
    }
    const found = [];
    for (const v of strong.length ? strong : inline) {
        if (v.n < 1 || v.n > 30 || found.some(x => x.n === v.n))
            continue;
        found.push(v);
    }
    found.sort((a, b) => a.page - b.page);
    return found.map((v, i) => { let to = found[i + 1] ? found[i + 1].page - (found[i + 1].mid ? 0 : 1) : pages.length; if (i === found.length - 1) {
        const appendix = pages.find(p => p.number > v.page + 3 && /^\s*\*?\s*Reading Plus\s*$/im.test(p.text));
        if (appendix)
            to = appendix.number - 1;
    } return { id: `unit-${v.n}`, title: `Unit ${v.n} · ${v.title}`, from: v.page, to: Math.max(v.page, to), printedFrom: v.printed, lessons: 8 }; });
}
export function weeklyCapacity(term, c, week) {
    const start = addDays(term.startDate, (week - 1) * 7), end = addDays(start, 6), override = c.overrides.find(x => x.week === week);
    if (override)
        return override.lessons;
    if (!c.schedule.length)
        return c.weeklyLessons;
    let total = 0;
    for (let n = 0; n < 7; n++) {
        const date = addDays(start, n), day = new Date(date + 'T12:00:00Z').getUTCDay(), change = c.exceptions.find(e => e.date === date);
        total += change ? change.lessons : (c.schedule.find(s => s.weekday>=1&&s.weekday<=5&&s.weekday === day)?.periods || 0);
    }
    return total;
}
export function latestPlan(state, classId) { return state.plans.filter(p => p.classId === classId).reverse().sort((a, b) => b.createdAt - a.createdAt)[0]; }
export function actualCounts(state, c) { const rows = state.progress.filter(p => p.classId === c.id); return { homework: c.quotas.homework.initial + rows.reduce((s, p) => s + p.counts.homework, 0), dictation: c.quotas.dictation.initial + rows.reduce((s, p) => s + p.counts.dictation, 0), prep: c.quotas.prep.initial + state.prepProgress.filter(p => p.groupId === prepGroup(c)).reduce((s, p) => s + p.count, 0) }; }
// Largest-remainder allocation keeps task counts integral and preserves the required total.
export function distribute(total, weights) { const sum = weights.reduce((s, n) => s + n, 0); if (!sum)
    return weights.map(() => 0); const raw = weights.map(n => total * n / sum), out = raw.map(Math.floor); let remainder = total - out.reduce((s, n) => s + n, 0); raw.map((n, i) => ({ i, f: n - out[i] })).filter(x => weights[x.i] > 0).sort((a, b) => b.f - a.f || a.i - b.i).slice(0, remainder).forEach(x => out[x.i]++); return out; }
export function unitLessons(material,unit,materials=[material]){
    if(isCourse(material))return courseLessons(material,unit,materials);
    const a=unit.analysis,parts=a?[...a.goals.map(x=>`重点：${x}`),...a.vocabulary.map(x=>`词汇：${x}`),...a.grammar.map(x=>`句型／语法：${x}`),...a.consolidation.map(x=>`巩固：${x}`)]:[];
    return Array.from({length:unit.lessons},(_,i)=>{const suggestion=a?.lessonSuggestions?.find(s=>s.lesson===i+1),refs=suggestion?.references?.map(n=>a.sources[n]).filter(Boolean)||[],locations=refs.map(r=>{const m=materials.find(m=>m.id===r.materialId);return `${m?.title||'教学资料'} · ${materialLocation(m,r.page)}`;});return {id:`${unit.id}:${i+1}`,unitId:unit.id,title:suggestion?.title?`${unit.title} · 第${i+1}课时 · ${suggestion.title}`:`${unit.title} · 建议第 ${i+1} 课`,content:suggestion?.content||(parts.length?parts.filter((_,n)=>n%unit.lessons===i).join('；')||'复习本单元重点，练习并检查理解；按班级进度调整。':'待补充具体教学内容，可先分析本单元或手动编辑。'),source:(locations.length?[...new Set(locations)].join('；'):`${material.title} · ${materialLocation(material,unit.from,unit.to)}${unit.printedFrom?` · 印刷起始页 ${unit.printedFrom}`:''}`).slice(0,500)};});
}
export function generatePlan(state, c, fromWeek = 1, previous = latestPlan(state, c.id)) {
    if(c.deletedAt||state.terms.find(t=>t.id===c.termId)?.deletedAt||state.materials.find(m=>m.id===c.materialId)?.deletedAt)throw Error('请先恢复已删除的学期、班级或教材');
    const term = state.terms.find(t => t.id === c.termId), m = state.materials.find(m => m.id === c.materialId), warnings = [];
    const actual = state.progress.filter(p => p.classId === c.id), done = new Set([...(c.coveredLessons || []), ...actual.flatMap(p => p.completed)]);
    const weeks = Array.from({ length: term.weeks }, (_, i) => { const week = i + 1, start = addDays(term.startDate, i * 7), old = previous?.weeks[i]; if (old && (old.locked || week < fromWeek || actual.some(p => p.week === week)))
        return structuredClone(old); const capacity = weeklyCapacity(term, c, week); return { week, start, end: addDays(start, 6), capacity, review: 0, buffer: Math.min(capacity, c.buffer), lessons: [], counts: zeroCounts(), note: '', locked: false }; });
    const fixed = w => w.locked || w.week < fromWeek || actual.some(p => p.week === w.week);
    const occupied = new Set(weeks.filter(w => fixed(w) && !actual.some(p => p.week === w.week)).flatMap(w => w.lessons.map(l => l.id)));
    for (const e of [...c.exams].sort((a, b) => a.date.localeCompare(b.date))) {
        const index = weekNumber(term, e.date) - 1, w = weeks[index];
        if (w && !fixed(w)) {
            if (e.occupied > w.capacity)
                warnings.push(`${e.title}占课超过该周课时，请核对。`);
            w.capacity = Math.max(0, w.capacity - e.occupied);
            w.buffer = Math.min(w.buffer, w.capacity);
        }
        let review = e.review;
        for (let i = index - 1; i >= 0 && review > 0; i--) {
            const w = weeks[i];
            if (fixed(w))
                continue;
            const n = Math.min(review, Math.max(0, w.capacity - w.review - w.buffer));
            w.review += n;
            review -= n;
        }
        if (review)
            warnings.push(`${e.title}仍有 ${review} 节复习课未能预留。`);
    }
    const deadlines = new Map();
    for (const e of c.exams)
        for (const unit of e.unitIds)
            deadlines.set(unit, Math.min(deadlines.get(unit) || Infinity, weekNumber(term, e.date) - 1));
    const tasks = m.units.filter(u => c.unitIds.includes(u.id)).flatMap(u => unitLessons(m, u,state.materials)).filter(l => !done.has(l.id) && !occupied.has(l.id));
    tasks.sort((a, b) => (deadlines.get(a.unitId) ?? Infinity) - (deadlines.get(b.unitId) ?? Infinity));
    for (const w of weeks) {
        if (fixed(w))
            continue;
        const available = Math.max(0, w.capacity - w.review - w.buffer);
        w.lessons = tasks.splice(0, available);
    }
    if (tasks.length)
        warnings.push(`还有 ${tasks.length} 节建议教学内容未排入，请调整课时估算、机动安排或教学范围。`);
    for (const e of c.exams) {
        const cutoff = weekNumber(term, e.date);
        const late = [...tasks, ...weeks.filter(w => w.week >= cutoff).flatMap(w => w.lessons)].filter(l => e.unitIds.includes(l.unitId));
        if (late.length)
            warnings.push(`${e.title}指定范围有 ${late.length} 节建议内容未在考前完整周排完。`);
        if (e.detail)
            warnings.push(`${e.title}补充范围“${e.detail}”需结合单元范围人工核对。`);
    }
    const carry = actual.filter(p => p.week < fromWeek && p.consolidation.trim()).map(p => `第${p.week}周：${p.consolidation}`).join('；');
    const nextWeek = weeks.find(w => !fixed(w));
    if (carry && nextWeek) nextWeek.note = `待巩固：${carry}`.slice(0,5000);
    const totals = actualCounts(state, c);
    for (const key of Object.keys(countLabels)) {
        const q = c.quotas[key], latestWeek = key === 'prep' ? state.prepProgress.filter(p => p.groupId === prepGroup(c)).reduce((n,p)=>Math.max(n,p.week),0) : actual.reduce((n, p) => Math.max(n, p.week), 0), fixedFuture = weeks.filter(w => fixed(w) && w.week > latestWeek && w.week >= fromWeek).reduce((s, w) => s + w.counts[key], 0);
        const weights = weeks.map(w => !fixed(w) && w.week > latestWeek && w.end <= q.deadline ? Math.max(0, w.capacity) : 0);
        const needed = Math.max(0, q.target - totals[key] - fixedFuture), counts = distribute(needed, weights);
        weeks.forEach((w, i) => { if (!fixed(w))
            w.counts[key] = counts[i]; });
        if (needed && !weights.some(Boolean))
            warnings.push(`${countLabels[key]}还差 ${needed}，检查截止前没有可分配的完整教学周。`);
        if (q.mode === 'exact' && totals[key] + fixedFuture > q.target)
            warnings.push(`${countLabels[key]}实际或锁定安排已超过固定要求，请核对。`);
    }
    if (!c.schedule.length && c.exceptions.length)
        warnings.push('当前仅填写每周总课时，请在“周课时覆盖”中确认停补课所在周的有效课时。');
    if (m.units.some(u => c.unitIds.includes(u.id) && !u.analysis))
        warnings.push(isCourse(m)?'部分单元尚未由AI整理，当前按已核对的教案课时与原文排程。':'部分单元尚未分析，具体内容待补充；当前按你确认的建议课时排程。');
    if(m.units.some(u=>c.unitIds.includes(u.id)&&u.analysis&&(u.analysis.sourceStatus==='pending'||u.analysis.sourceStatus==='partial'||u.analysis.sources.some(s=>state.materials.find(x=>x.id===s.materialId)?.deletedAt))))warnings.push('部分单元分析的来源已删除或待核对，请核对已有教学文字，必要时重新分析。');
    return { id: crypto.randomUUID(), classId: c.id, materialId:m.id, createdAt: Date.now(), weeks, warnings };
}
export function mergeTeaching(current, incoming) { const out = structuredClone(current); for (const key of ['materials', 'terms', 'classes', 'plans', 'progress', 'prepProgress']) {
    const rows = new Map(out[key].map(x => [x.id, x]));
    for (const row of incoming[key])
        rows.set(row.id, row);
    out[key] = [...rows.values()];
} return validateTeaching(out); }
export function validateTeachingBackup(data){
    if(data?.teaching===undefined)return null;const t=data.teaching;
    if(!t||typeof t.filesIncluded!=='boolean'||!Array.isArray(t.files)||t.files.length>500)throw Error('教学备份格式无效');validateTeaching(t.state);
    for(const f of t.files){const material=t.state.materials.find(m=>m.id===f.id),mime=teachingMime[material?.format||'pdf'];if(!id(f.id)||!material||!str(f.name,250)||typeof f.dataURL!=='string'||!f.dataURL.startsWith(`data:${mime};base64,`)||!/^data:[^,]+;base64,[A-Za-z0-9+/]+=*$/.test(f.dataURL)||f.dataURL.length>28000000)throw Error('教学原文件备份无效');try{const header=atob(f.dataURL.split(',')[1].slice(0,1368));if((material.format||'pdf')==='pdf'&&!header.includes('%PDF-')||material.format==='docx'&&!header.startsWith('PK'))throw Error('invalid');}catch{throw Error('教学原文件内容无效');}}
    if(!t.filesIncluded&&t.files.length)throw Error('不含原文件的教学备份格式无效');return t;
}
