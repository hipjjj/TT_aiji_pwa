import {createDictionary} from './dictionary.mjs';
export const lookupWord=createDictionary(async(key:string)=>{
  const response=await fetch(`${import.meta.env.BASE_URL}study-dictionary/${key}.json`);
  if(!response.ok)throw Error('词库暂时未加载完成，请联网重试；已保存的笔记仍可查看。');
  const value=await response.json();
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('词库格式无效，请联网更新后重试。');
  return value;
});
