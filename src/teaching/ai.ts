import {selectTeachingMaterials} from './files.mjs';
import {db} from '../db';
import {readAccessCode} from '../personal/access-code.mjs';
import {validateTeachingAnalysis} from './model.mjs';
import type {Material,Unit,Analysis} from './types';
function wait(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('已停止','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}
export async function analyzeUnit(unit:Unit,materials:Material[],signal:AbortSignal,onWaiting?:(seconds:number)=>void):Promise<Analysis>{
  if(!navigator.onLine)throw Error('教案AI整理需要联网，已保存的分析和计划可离线查看');
  const config=await db.settings.get('ai'),access=readAccessCode(),url=config?.url||import.meta.env.VITE_NUTRITION_API_URL||'';
  if(!url||access.length<16)throw Error('请先在个人页设置AI连接');
  const endpoint=new URL(url);
  if(endpoint.protocol!=='https:'||endpoint.pathname!=='/'||endpoint.search||endpoint.hash||endpoint.username||endpoint.password)throw Error('请在个人页重新设置有效的AI地址');
  const selected=selectTeachingMaterials(unit,materials),textSize=selected.reduce((n,m)=>n+m.pages.reduce((s,p)=>s+p.text.length,0),0);
  if(textSize>120000)throw Error('本单元资料超过12万字符，请缩小页码范围后分段整理');
  for(let attempt=0;attempt<4;attempt++){
    let response:Response;
    try{response=await fetch(endpoint.origin+'/teaching-analyze',{method:'POST',headers:{'Content-Type':'application/json','X-Access-Code':access},body:JSON.stringify({unitTitle:unit.title,materials:selected}),signal:AbortSignal.any([signal,AbortSignal.timeout(120000)])});}
    catch(e){if(signal.aborted)throw e;throw Error(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')?'本单元整理超时，已完成的单元仍保留，请重试':'连接教学AI服务中断，请检查网络后重试；已有分析仍保留');}
    let data;try{data=await response.json();}catch{throw Error('教学AI服务返回异常，请稍后重试；已有分析仍保留');}
    if(response.status===429&&['WORK_RATE_LIMIT','API_RATE_LIMIT'].includes(data.code)&&attempt<3){const seconds=Math.max(1,Math.min(60,Number(data.retryAfter||response.headers.get('Retry-After'))||60));onWaiting?.(seconds);await wait(seconds*1000,signal);continue;}
    if(!response.ok)throw Error(response.status===404?'教学分析服务尚未更新，请稍后重试':data.error||'教案整理暂时不可用');
    return validateTeachingAnalysis(data,materials);
  }
  throw Error('AI请求仍然过快，已完成的单元保留，请稍后继续');
}
