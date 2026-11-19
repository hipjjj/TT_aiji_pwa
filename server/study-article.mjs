import {parseHTML} from 'linkedom';
import {Readability} from '@mozilla/readability';
import {articleURL,articleText} from '../src/study/import-model.mjs';
const maxBytes=2*1024*1024;
async function readHTML(response){
  if(Number(response.headers.get('content-length'))>maxBytes)throw Error('网页内容太大，请复制所需正文后导入');
  if(!response.body)throw Error('网页没有返回正文');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw Error('网页内容太大，请复制所需正文后导入');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  const charset=response.headers.get('content-type')?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||'utf-8';
  try{return new TextDecoder(charset).decode(bytes);}catch{return new TextDecoder().decode(bytes);}
}
function plainText(node){
  if(node.nodeType===3)return node.textContent||'';
  const tag=node.nodeName.toLowerCase();if(['script','style','noscript','iframe','svg','form'].includes(tag))return '';
  if(tag==='br')return '\n';
  const text=Array.from(node.childNodes||[]).map(plainText).join('');
  return ['p','div','section','article','h1','h2','h3','h4','li','blockquote'].includes(tag)?`\n${text}\n`:text;
}
export function extractWebArticle(html,url){
  const {document}=parseHTML(html);
  Object.defineProperty(document,'documentURI',{value:url,configurable:true});
  document.querySelectorAll('script,style,noscript,iframe,svg,form').forEach(node=>node.remove());
  const fallbackTitle=document.title?.trim();
  const result=new Readability(document.cloneNode(true),{charThreshold:80,maxElemsToParse:15000}).parse();
  let text;
  if(result?.content){const content=parseHTML(`<html><body>${result.content}</body></html>`).document;text=plainText(content.body);}
  else{text=plainText(document.querySelector('article,main,[role="main"]')||document.body);}
  const content=articleText(text);
  if(content.length<80)throw Error('没有找到可阅读的文章正文；页面可能需要登录或依赖脚本，请复制正文后导入');
  const title=(result?.title||fallbackTitle||new URL(url).hostname).replace(/\s+/g,' ').trim().slice(0,150);
  return {title,text:content,sourceUrl:url,source:`网页 · ${new URL(url).hostname}`.slice(0,200)};
}
export async function fetchWebArticle(value,{fetchImpl=fetch}={}){
  let url=articleURL(value);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    for(let redirects=0;redirects<=4;redirects++){
      const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'text/html,application/xhtml+xml,text/plain;q=0.9'}});
      if([301,302,303,307,308].includes(response.status)){
        await response.body?.cancel();const location=response.headers.get('location');if(!location||redirects===4)throw Error('网页跳转次数过多或地址无效');url=articleURL(new URL(location,url).href);continue;
      }
      if(!response.ok){await response.body?.cancel();throw Error(`网页读取失败（HTTP ${response.status}），可能需要登录或不允许自动读取`);}
      const type=response.headers.get('content-type')?.toLowerCase()||'';
      if(type.includes('application/pdf')){await response.body?.cancel();throw Error('这个链接指向PDF，请下载文件后使用“PDF / TXT文件”导入');}
      if(!/text\/html|application\/xhtml\+xml|text\/plain/.test(type)){await response.body?.cancel();throw Error('这个地址没有返回可读取的网页正文');}
      const content=await readHTML(response);
      return type.includes('text/plain')?{title:(new URL(url).pathname.split('/').at(-1)||new URL(url).hostname).slice(0,150),text:articleText(content),sourceUrl:url,source:`网页 · ${new URL(url).hostname}`.slice(0,200)}:extractWebArticle(content,url);
    }
    throw Error('网页跳转失败');
  }catch(error){if(controller.signal.aborted)throw Error('网页读取超时，请稍后再试或粘贴正文');if(error instanceof TypeError)throw Error('网页暂时无法读取，请检查链接或粘贴正文');throw error;}finally{clearTimeout(timer);}
}
