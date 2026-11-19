import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {pdfByteLimit} from './import-model.mjs';
import {pdfDocumentText} from './pdf-text.mjs';
GlobalWorkerOptions.workerSrc=workerURL;
export async function extractPDF(file:File,signal:AbortSignal,onProgress:(page:number,total:number)=>void){
  if(file.size>pdfByteLimit)throw Error('请选择12MB以内的PDF');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw Error('这个文件不是有效的PDF');
  if(signal.aborted)throw new DOMException('已取消读取','AbortError');
  const task=getDocument({data:bytes,useSystemFonts:true});
  const cancel=()=>{void task.destroy();};signal.addEventListener('abort',cancel,{once:true});
  try{
    const document=await task.promise;
    const result=await pdfDocumentText(document,{signal,onProgress});
    let title=file.name.replace(/\.pdf$/i,'').slice(0,150);
    try{const meta=await document.getMetadata();const value=(meta.info as {Title?:string}).Title;if(value?.trim()&&value.trim().length<=150)title=value.trim();}catch{/* Filename remains a usable title. */}
    return {...result,title};
  }catch(error){
    if(signal.aborted)throw new DOMException('已取消读取','AbortError');
    if(error instanceof Error&&error.name==='PasswordException')throw Error('PDF有密码保护，请先解锁后再导入');
    if(error instanceof Error&&error.name==='InvalidPDFException')throw Error('PDF无法解析，文件可能已损坏，请重新导出后再试');
    throw error;
  }finally{signal.removeEventListener('abort',cancel);await task.destroy();}
}
