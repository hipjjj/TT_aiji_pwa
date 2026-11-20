export const teachingMime={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'};
export const materialLocation=(m,from,to=from)=>`${m?.format&&m.format!=='pdf'?'资料分段':'PDF'} ${from}${to!==from?'–'+to:''}`;
/** @param {import('./types').Unit} unit @param {import('./types').Material[]} materials */
export function selectTeachingMaterials(unit,materials){
  const course=materials.find(m=>m.planningBasis==='lessonPlan'&&m.role==='lessonPlan'&&!m.deletedAt);
  if(course){
    const lessonRanges=unit.periods.map(p=>({unitId:unit.id,lessonFrom:p.number,lessonTo:p.number,from:p.from,to:p.to,title:p.title}));
    const selected=[{id:course.id,title:course.title,role:course.role,planningBasis:'lessonPlan',format:course.format||'pdf',pages:course.pages.filter(p=>p.number>=unit.from&&p.number<=unit.to),lessonRanges}];
    for(const book of materials.filter(m=>m.role==='primary'&&!m.deletedAt)){
      const refs=unit.periods.map(p=>p.reference).filter(r=>r?.materialId===book.id),numbers=new Set(refs.flatMap(r=>r.vocabulary.map(w=>w.page)));
      const ranges=refs.length?refs:book.units.filter(u=>u.id===unit.id);
      const pages=book.pages.filter(p=>numbers.has(p.number)||ranges.some(r=>p.number>=r.from&&p.number<=r.to));
      if(pages.length)selected.push({id:book.id,title:book.title,role:book.role,format:book.format||'pdf',pages,lessonRanges:[]});
    }
    return selected;
  }
  return materials.filter(m=>!m.deletedAt&&(m.role==='primary'||materials.some(b=>b.id===m.primaryId&&!b.deletedAt))).map(m=>{const ranges=m.role==='primary'?[unit]:m.role==='lessonPlan'?m.units.filter(x=>x.unitId===unit.id):m.units.filter(x=>x.id===unit.id);return {id:m.id,title:m.title,role:m.role,format:m.format||'pdf',pages:m.pages.filter(p=>ranges.some(u=>p.number>=u.from&&p.number<=u.to)),lessonRanges:m.role==='lessonPlan'?ranges.map(u=>({unitId:u.unitId,lessonFrom:u.lessonFrom,lessonTo:u.lessonTo,from:u.from,to:u.to,title:u.title})):[]};}).filter(m=>m.pages.length);
}
export function textPages(text){
  text=text.replace(/\r\n?/g,'\n').replace(/\u0000/g,'').trim();
  if(!text||text.length>1500000)throw Error('资料没有可读文字或文字超过150万字符');
  const pages=[];let start=0;
  while(start<text.length){let end=Math.min(start+5000,text.length);if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>start+2500)end=boundary+1;}pages.push({number:pages.length+1,text:text.slice(start,end),bold:[]});start=end;}
  if(pages.length>300)throw Error('资料过长，请分册上传');return pages;
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// DOCX is a ZIP container. Read only the bounded main document XML through the
// browser's native decompressor; embedded objects and macros are never loaded.
export async function docxXML(bytes,signal){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){eocd=i;break;}
  if(eocd<0||v.getUint16(eocd+4,true)||v.getUint16(eocd+6,true))throw Error('Word文件无法读取，请另存为DOCX或PDF');
  const entries=v.getUint16(eocd+10,true),directory=v.getUint32(eocd+16,true);let offset=directory,entry;
  if(entries===65535||entries>10000||directory>=eocd)throw Error('Word文件过大或格式不受支持');
  for(let i=0;i<entries;i++){
    if(offset+46>eocd||v.getUint32(offset,true)!==0x02014b50)throw Error('Word文件目录损坏');
    const nameSize=v.getUint16(offset+28,true),extra=v.getUint16(offset+30,true),comment=v.getUint16(offset+32,true),next=offset+46+nameSize+extra+comment;
    if(next>eocd)throw Error('Word文件目录损坏');
    const name=new TextDecoder().decode(bytes.subarray(offset+46,offset+46+nameSize));
    if(name==='word/document.xml')entry={flags:v.getUint16(offset+8,true),method:v.getUint16(offset+10,true),crc:v.getUint32(offset+16,true),compressed:v.getUint32(offset+20,true),size:v.getUint32(offset+24,true),local:v.getUint32(offset+42,true)};
    offset=next;
  }
  if(!entry||entry.flags&1||entry.size>4*1024*1024||entry.local+30>directory)throw Error('Word正文无法读取、已加密或过大，请另存PDF');
  if(v.getUint32(entry.local,true)!==0x04034b50)throw Error('Word正文已损坏');
  const start=entry.local+30+v.getUint16(entry.local+26,true)+v.getUint16(entry.local+28,true),end=start+entry.compressed;
  if(end>directory||start>end)throw Error('Word正文已损坏');
  if(signal?.aborted)throw new DOMException('已取消','AbortError');
  let result;
  if(entry.method===0)result=bytes.slice(start,end);
  else if(entry.method===8){
    let decompressor;try{decompressor=new DecompressionStream('deflate-raw');}catch{throw Error('当前浏览器暂无法读取Word，请上传PDF或TXT版本');}
    const reader=new Blob([bytes.slice(start,end)]).stream().pipeThrough(decompressor).getReader(),chunks=[];let size=0;
    try{while(true){if(signal?.aborted)throw new DOMException('已取消','AbortError');const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw Error('Word正文解压后过大，请分册上传');chunks.push(value);}result=new Uint8Array(size);let n=0;for(const c of chunks){result.set(c,n);n+=c.length;}}finally{await reader.cancel().catch(()=>{});}
  }else throw Error('Word压缩格式不受支持，请另存PDF');
  if(result.length!==entry.size||crc32(result)!==entry.crc)throw Error('Word正文校验失败，请重新保存文件');
  return new TextDecoder('utf-8',{fatal:true}).decode(result);
}
export function docxText(xml,Parser=DOMParser){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Word正文包含不受支持的XML声明');
  const doc=new Parser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('Word正文无法解析');
  const named=(root,name)=>Array.from(root.querySelectorAll('*')).filter(n=>n.localName.split(':').at(-1)===name);
  return named(doc,'p').map(p=>named(p,'t').map(t=>t.textContent||'').join('')).filter(Boolean).join('\n');
}
export function detectPlanSections(pages,bookUnits,fallbackId){
  const found=[];let unitId=fallbackId||bookUnits[0]?.id,lesson=1;
  const number=s=>{if(/^\d+$/.test(s))return Number(s);const digits={'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(s==='一百')return 100;if(s.includes('十')){const [a,b]=s.split('十');return (digits[a]||1)*10+(digits[b]||0);}return digits[s]||1;};
  for(const p of pages)for(const line of p.text.split('\n')){
    const unit=line.match(/(?:Unit\s*(\d+)|第\s*([一二三四五六七八九十百两\d]+)\s*单元)/i),period=line.match(/(?:第\s*([一二三四五六七八九十百两\d]+)\s*课时|(?:Lesson|Period)\s*(\d+))/i);
    if(unit){const candidate=`unit-${number(unit[1]||unit[2])}`;if(bookUnits.some(u=>u.id===candidate)){unitId=candidate;lesson=1;}}
    if(period&&unitId){lesson=number(period[1]||period[2]);if(!found.some(x=>x.unitId===unitId&&x.lessonFrom===lesson))found.push({id:`plan-${found.length+1}`,unitId,title:line.trim().slice(0,200),from:p.number,to:pages.length,printedFrom:'',lessons:1,lessonFrom:lesson,lessonTo:lesson});}
  }
  if(!found.length)return [{id:'plan-1',unitId,title:'教案内容',from:1,to:pages.length,printedFrom:'',lessons:1,lessonFrom:1,lessonTo:bookUnits.find(u=>u.id===unitId)?.lessons||1}];
  return found.map((s,i)=>({...s,to:Math.max(s.from,found[i+1]?.from||pages.length)}));
}
