const key='xiaobao-ai-access';
export function readAccessCode(){
 try{
  const saved=localStorage.getItem(key);
  if(saved!==null){try{sessionStorage.removeItem(key);}catch{}return saved;}
  const legacy=sessionStorage.getItem(key)||'';
  if(legacy){localStorage.setItem(key,legacy);sessionStorage.removeItem(key);}
  return legacy;
 }catch{return '';}
}
export function saveAccessCode(value){localStorage.setItem(key,value);try{sessionStorage.removeItem(key);}catch{}}
export function clearAccessCode(){localStorage.removeItem(key);sessionStorage.removeItem(key);}
