import {articleText,articleTextLimit} from './import-model.mjs';
export function pdfPageText(items){
  const lines=[];let line='',lastY;
  for(const item of items){
    if(typeof item.str!=='string')continue;
    const y=item.transform?.[5];
    if(line&&Number.isFinite(y)&&Number.isFinite(lastY)&&Math.abs(y-lastY)>Math.max(2,(item.height||10)*.35)){lines.push(line.trim());line='';}
    if(item.str){if(line&&!/\s$/.test(line)&&!/^\s/.test(item.str))line+=' ';line+=item.str;}
    if(item.hasEOL){lines.push(line.trim());line='';}lastY=y;
  }
  if(line.trim())lines.push(line.trim());
  return lines.filter(Boolean).join('\n');
}
/** @param {any} document @param {{signal?:AbortSignal,onProgress?:(page:number,total:number)=>void}} options */
export async function pdfDocumentText(document,{signal,onProgress=()=>{}}={}){
  if(!document.numPages||document.numPages>200)throw Error('请选择200页以内的PDF，较长的资料请分段导入');
  const pages=[];let size=0,emptyPages=0;
  for(let number=1;number<=document.numPages;number++){
    if(signal?.aborted)throw new DOMException('已取消读取','AbortError');
    onProgress(number,document.numPages);
    const page=await document.getPage(number);
    try{const text=pdfPageText((await page.getTextContent()).items);if(!text)emptyPages++;size+=text.length+2;if(size>articleTextLimit)throw Error('PDF正文超过10万字符，请分成几篇导入');pages.push(text);}finally{page.cleanup?.();}
  }
  if(!pages.some(Boolean))throw Error('这份PDF没有可提取的文字，可能是扫描件；请先进行OCR识别，再导入文字版PDF或TXT');
  return {text:articleText(pages.join('\n\n')),emptyPages};
}
