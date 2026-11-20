import {docxXML,docxText,textPages} from './files.mjs';
import type {Material} from './types';
export async function readTeachingFile(file:File,signal:AbortSignal,progress:(n:number,total:number)=>void):Promise<{pages:Material['pages'];format:'pdf'|'docx'|'txt'}>{
  if(file.size>20*1024*1024)throw Error('请选择20MB以内的文件');
  const extension=file.name.split('.').at(-1)?.toLowerCase();
  if(extension==='pdf'){const {readTeachingPDF}=await import('./pdf');return {pages:await readTeachingPDF(file,signal,progress),format:'pdf'};}
  const bytes=new Uint8Array(await file.arrayBuffer());if(signal.aborted)throw new DOMException('已取消','AbortError');
  if(extension==='docx')return {pages:textPages(docxText(await docxXML(bytes,signal))),format:'docx'};
  if(extension==='txt'){let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('gb18030').decode(bytes);}return {pages:textPages(text),format:'txt'};}
  throw Error(extension==='doc'?'请将旧版DOC另存为DOCX或PDF后上传':'支持PDF、Word（DOCX）和TXT文件');
}
