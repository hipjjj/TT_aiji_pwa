import {useEffect,useRef,useState} from 'react';
import {Modal} from '../nutrition/NutritionTab';
import {db} from '../db';
import {readAccessCode} from '../personal/access-code.mjs';
import {articleText,articleURL,pdfByteLimit} from './import-model.mjs';
import type {Article} from './store';
export default function ArticleImport({open,onClose,onSave,onManageAI}:{open:boolean;onClose:()=>void;onSave:(article:Article)=>Promise<boolean>;onManageAI:()=>void}){
  const [mode,setMode]=useState<'text'|'file'|'url'>('text'),[title,setTitle]=useState(''),[text,setText]=useState(''),[url,setUrl]=useState(''),[source,setSource]=useState('我导入的文章'),[sourceUrl,setSourceUrl]=useState<string>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[progress,setProgress]=useState(''),[working,setWorking]=useState(false),[saving,setSaving]=useState(false),[needsSettings,setNeedsSettings]=useState(false);
  const file=useRef<HTMLInputElement>(null),abort=useRef<AbortController|null>(null);
  useEffect(()=>()=>abort.current?.abort(),[]);
  useEffect(()=>{if(!open){abort.current?.abort();setWorking(false);setProgress('');}},[open]);
  const close=()=>{if(saving)return;abort.current?.abort();onClose();};
  const start=()=>{abort.current?.abort();const controller=new AbortController();abort.current=controller;setWorking(true);setError('');setNotice('');setNeedsSettings(false);return controller;};
  const readFile=async(picked:File)=>{
    const controller=start();
    try{
      const isPDF=picked.type==='application/pdf'||/\.pdf$/i.test(picked.name);
      if(isPDF){
        if(picked.size>pdfByteLimit)throw Error('请选择12MB以内的PDF');setProgress('正在打开PDF…');
        const {extractPDF}=await import('./pdf');
        const value=await extractPDF(picked,controller.signal,(page,total)=>setProgress(`正在提取PDF第 ${page} / ${total} 页…`));
        if(controller.signal.aborted)return;setTitle(value.title);setText(value.text);setSource(`PDF · ${picked.name}`.slice(0,200));setSourceUrl(undefined);
        setNotice(value.emptyPages?`已提取文字；有 ${value.emptyPages} 页没有可读取文字，请核对正文。`:'PDF正文已提取，请核对标题、段落后保存。');
      }else{
        if(!/\.txt$/i.test(picked.name)&&picked.type!=='text/plain')throw Error('请选择PDF或TXT文件');
        if(picked.size>500000)throw Error('请选择500KB以内的TXT文件');setProgress('正在读取TXT…');
        const value=articleText(await picked.text());if(controller.signal.aborted)return;
        setTitle(picked.name.replace(/\.txt$/i,'').slice(0,150));setText(value);setSource(`TXT · ${picked.name}`.slice(0,200));setSourceUrl(undefined);setNotice('文字已读取，核对后即可保存。');
      }
    }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'文件读取失败，请换一个文件重试');}
    finally{if(abort.current===controller){setWorking(false);setProgress('');}}
  };
  const readURL=async()=>{
    const controller=start();const timer=setTimeout(()=>controller.abort('timeout'),22000);
    try{
      const target=articleURL(url);setUrl(target);setProgress('正在读取公开网页正文…');
      const config=await db.settings.get('ai'),accessCode=readAccessCode();
      if(!config?.url||!accessCode){setNeedsSettings(true);throw Error('网页读取需要在个人页保存后端地址和访问口令，与已有AI连接共用设置。');}
      const response=await fetch(config.url.replace(/\/$/,'')+'/study-article',{method:'POST',headers:{'Content-Type':'application/json','X-Access-Code':accessCode},body:JSON.stringify({url:target}),signal:controller.signal});
      let value;try{value=await response.json();}catch{throw Error('网页读取服务返回格式无效，请检查连接地址');}
      if(!response.ok){if(response.status===404)throw Error('此后端尚未提供文章读取接口，请检查个人页连接地址');throw Error(value.error||'网页暂时无法读取，请粘贴正文');}
      const content=articleText(value.text),original=articleURL(value.sourceUrl||target);
      if(controller.signal.aborted)return;setTitle(String(value.title||new URL(original).hostname).slice(0,150));setText(content);setSource(`网页 · ${new URL(original).hostname}`.slice(0,200));setSourceUrl(original);setNotice('网页正文已提取，请核对后保存；需要登录或依赖脚本的页面可能无法读取。');
    }catch(err){if(controller.signal.reason==='timeout')setError('网页读取超时，请稍后重试或粘贴正文');else if(!controller.signal.aborted)setError(err instanceof Error?err.message:'网页暂时无法读取，请检查连接或粘贴正文');}
    finally{clearTimeout(timer);if(abort.current===controller){setWorking(false);setProgress('');}}
  };
  const save=async()=>{
    setError('');setSaving(true);
    try{
      const row={id:crypto.randomUUID(),title:title.trim(),text:articleText(text),source,...(sourceUrl?{sourceUrl}:{}),updatedAt:Date.now()};
      if(!row.title)throw Error('请填写文章标题');
      if(await onSave(row)){setTitle('');setText('');setUrl('');setSource('我导入的文章');setSourceUrl(undefined);setNotice('');onClose();}
      else setError('文章暂时未保存成功，请检查本地存储后重试');
    }catch(err){setError(err instanceof Error?err.message:'保存失败，请重试');}finally{setSaving(false);}
  };
  return <Modal open={open} onClose={close} title="收进一篇英文文章" eyebrow="Dudu Gao’s English Room" className="article-import-dialog"><form onSubmit={e=>{e.preventDefault();if(!working&&!saving)void save();}}>
    <div className="room-tabs import-modes" role="group" aria-label="文章导入方式">{([['text','粘贴文字'],['file','PDF / TXT文件'],['url','网页 URL']] as const).map(([id,label])=><button key={id} type="button" disabled={working||saving} aria-pressed={mode===id} onClick={()=>{setMode(id);setError('');setNeedsSettings(false);}}>{label}</button>)}</div>
    {mode==='text'&&<p className="study-small">把正文粘贴到下方，每篇最多10万字符，保存后可离线阅读。</p>}
    {mode==='file'&&<div className="article-file-import"><button type="button" className="soft-button" disabled={working||saving} onClick={()=>file.current?.click()}>选择 PDF / TXT 文件</button><p className="study-small">PDF在本机提取文字，最多12MB、200页；TXT最多500KB。扫描版PDF需先OCR识别，提取后可编辑再保存。</p><input ref={file} type="file" hidden accept="application/pdf,.pdf,text/plain,.txt" onChange={e=>{const picked=e.currentTarget.files?.[0];e.currentTarget.value='';if(picked)void readFile(picked);}}/></div>}
    {mode==='url'&&<div className="article-url-import"><label>文章网页地址<input type="url" aria-label="文章网页地址" value={url} disabled={working||saving} maxLength={2048} placeholder="https://…" onChange={e=>setUrl(e.target.value)}/></label><button className="soft-button" type="button" disabled={working||saving||!url.trim()} onClick={()=>void readURL()}>读取网页正文</button><p className="study-small">读取公开网页，不登录网站、不调用AI。使用个人页已保存的连接，提取后可核对、编辑再保存。</p></div>}
    {working&&<div className="article-import-progress" role="status">{progress}<button className="soft-button" type="button" onClick={()=>{abort.current?.abort();setWorking(false);setProgress('');setNotice('已取消读取，原有草稿保留。');}}>取消读取</button></div>}
    {notice&&<p className="study-notice" role="status">{notice}</p>}{error&&<p className="nutrition-error" role="alert">{error}</p>}{needsSettings&&<button type="button" className="soft-button" onClick={()=>{close();onManageAI();}}>去个人页设置连接</button>}
    <label>文章标题<input aria-label="文章标题" value={title} disabled={working||saving} maxLength={150} required onChange={e=>setTitle(e.target.value)}/></label><label>英文正文<textarea aria-label="英文正文" value={text} disabled={working||saving} maxLength={100000} required rows={12} onChange={e=>setText(e.target.value)}/></label>
    {text&&<p className="study-small">已读取 {text.length.toLocaleString()} 字符 · {source}</p>}
    <button className="study-next" disabled={working||saving||!text.trim()||!title.trim()}>{saving?'正在保存…':'保存文章'}</button>
  </form></Modal>;
}
