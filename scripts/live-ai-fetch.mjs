// CI follows the service's retry delay and reports unrelated exhausted daily
// budgets without weakening production limits or bypassing authentication.
export async function fetchLive(url,options={}){
  const {signal:unused,...rest}=options;
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch(url,{...rest,signal:AbortSignal.timeout(120000)});
    if(response.status!==429)return response;
    let data={};try{data=await response.clone().json();}catch{}
    if(/明天|今天.*用完/.test(data.error||''))throw Object.assign(Error('Other-module application daily budget exhausted'),{code:'LOCAL_DAILY_LIMIT'});
    if(['API_BILLING','API_AUTH','WORK_MODEL_ACCESS'].includes(data.code)||attempt===2)return response;
    const seconds=Math.max(1,Math.min(60,Number(response.headers.get('Retry-After'))||60));
    console.log(`AI verification rate limited; retrying in ${seconds} seconds`);
    await new Promise(resolve=>setTimeout(resolve,seconds*1000));
  }
}
