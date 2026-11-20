import { db } from '../db';
import { readAccessCode } from '../personal/access-code.mjs';
import { validateTeachingAnalysis } from './model.mjs';
import type { Material, Unit, Analysis } from './types';
export async function analyzeUnit(unit: Unit, materials: Material[], signal: AbortSignal): Promise<Analysis> {
    if (!navigator.onLine)
        throw Error('教材AI分析需要联网，已保存的分析和计划可离线查看');
    const config = await db.settings.get('ai'), access = readAccessCode(), url = config?.url || import.meta.env.VITE_NUTRITION_API_URL || '';
    if (!url || access.length < 16)
        throw Error('请先在个人页设置AI连接');
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || endpoint.pathname !== '/' || endpoint.search || endpoint.hash || endpoint.username || endpoint.password)
        throw Error('请在个人页重新设置有效的AI地址');
    const selected = materials.map(m => { const u = m.role === 'primary' ? unit : m.units.find(x => x.id === unit.id); return { id: m.id, title: m.title, role: m.role, pages: u ? m.pages.filter(p => p.number >= u.from && p.number <= u.to) : [] }; }).filter(m => m.pages.length);
    const textSize = selected.reduce((n, m) => n + m.pages.reduce((s, p) => s + p.text.length, 0), 0);
    if (textSize > 120000)
        throw Error('本单元资料超过12万字符，请缩小页码范围后分段分析');
    let response:Response;
    try{response=await fetch(endpoint.origin + '/teaching-analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Access-Code': access }, body: JSON.stringify({ unitTitle: unit.title, materials: selected }), signal });}
    catch(e){if(signal.aborted)throw e;throw Error('连接教学AI服务中断，请检查网络后重试；已有分析仍保留');}
    let data;
    try{data=await response.json();}catch{throw Error('教学AI服务返回异常，请稍后重试；已有分析仍保留');}
    if (!response.ok)
        throw Error(response.status === 404 ? '教学分析服务尚未更新，请稍后重试；仍可手动设置课时和周计划' : data.error || '教材分析暂时不可用');
    return validateTeachingAnalysis(data, materials);
}
