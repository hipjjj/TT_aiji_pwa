export const WORK_MODEL='gpt-6.2-astra';
export const workReasoning={effort:'medium'};
export async function checkWorkRate(env){
  const quota=env.AI_QUOTA.get(env.AI_QUOTA.idFromName('work-ai'));
  const minute=Number(env.PER_MINUTE_WORK_LIMIT)||5;
  return (await quota.fetch('https://quota/check',{method:'POST',body:JSON.stringify({daily:0,minute})})).json();
}
export async function workUpstreamError(response){
  let code='';try{const data=await response.json();code=data.error?.code||data.error?.type||'';}catch{}
  if(code==='model_not_found'||response.status===403)return {error:'当前API账号尚未获准调用工作区配置的旗舰模型，请检查模型权限',code:'WORK_MODEL_ACCESS'};
  if(code==='insufficient_quota'||code==='billing_hard_limit_reached')return {error:'OpenAI API返回余额或项目预算不足，请检查该API项目的账单与限额',code:'API_BILLING'};
  if(response.status===429)return {error:'OpenAI API当前请求过快，请稍后重试',code:'API_RATE_LIMIT'};
  if(response.status===401)return {error:'工作区API密钥不可用，请检查服务配置',code:'API_AUTH'};
  return {error:'工作区AI服务暂时不可用，请稍后重试',code:'WORK_UPSTREAM'};
}
