// New courses are independent lesson plans. Legacy textbook-based records keep
// their original shape and IDs so backups and actual progress remain readable.
import {extractLessonContent,extractUnitOverview} from './lesson-content.mjs';
export const isCourse=m=>m?.role==='lessonPlan'&&m.planningBasis==='lessonPlan';
/** @param {import('./types').Unit} u @returns {number[]} */
export const periodNumbers=u=>u.periods?u.periods.map(p=>p.number):Array.from({length:u.lessons},(_,i)=>i+1);
const compact=s=>s.replace(/\s+/g,'');
export function detectCourseUnits(pages){
  const detailed=[],simple=[];let current=1;
  for(const p of pages){
    const header=p.text.slice(0,700),unit=header.match(/\bUnit\s*(\d{1,2})\b/i);
    if(unit)current=Number(unit[1]);
    const fraction=header.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
    if(unit&&fraction&&/Step\s*1|教学目标|备课笔记/i.test(p.text)){
      let title=header.slice(header.indexOf(unit[0])+unit[0].length).split(/Listening|Reading|Writing|Grammar|Integrated|Project\s*Class|\n/i)[0].replace(/^[\s|·]+/,'').trim();
      const range=header.slice(0,Math.max(fraction.index,header.indexOf(unit[0])+100)).match(/\b\d[a-z]\s*[-–—]\s*\d[a-z]\b/i)?.[0];
      if(range&&!title.includes(range))title+=' · '+range;
      detailed.push({unit:current,number:Number(fraction[1]),from:p.number,title:title.slice(0,180),phonetics:/Phonetics|Pronunciation/i.test(header)});
    }
    for(const line of p.text.split('\n')){
      const u=line.match(/^\s*Unit\s*(\d{1,2})\b/i);if(u)current=Number(u[1]);
      const period=line.match(/^\s*(?:Period|Lesson)\s*(\d{1,2})\b(.*)|^\s*第\s*(\d+)\s*课时(.*)/i);
      if(period)simple.push({unit:current,number:Number(period[1]||period[3]),from:p.number,title:(period[2]||period[4]||'教案内容').trim().slice(0,180)});
    }
  }
  const starts=detailed.length?detailed:simple,units=[];
  for(const [i,s] of starts.entries()){
    if(s.number<1||s.number>100)continue;
    let u=units.find(u=>u.id===`unit-${s.unit}`);
    if(!u){const heading=pages.find(p=>p.number===s.from)?.text.match(new RegExp(`Unit\\s*${s.unit}\\s+([^\\n|·]+)`,'i'))?.[1]?.trim().slice(0,100)||'';u={id:`unit-${s.unit}`,title:`Unit ${s.unit}${heading?' · '+heading.replace(/\s*Section\s+[AB].*$/i,''):''}`,from:s.from,to:s.from,printedFrom:'',lessons:0,periods:[]};units.push(u);}
    if(u.periods.some(p=>p.number===s.number))continue;
    const to=Math.max(s.from,starts[i+1]?starts[i+1].from-(starts[i+1].from>s.from?1:0):pages.length);
    u.periods.push({number:s.number,title:(s.title+(s.phonetics&&!/Pronunciation/i.test(s.title)?' · Pronunciation':'')).slice(0,200)||`第${s.number}课时`,from:s.from,to});u.to=Math.max(u.to,to);u.lessons=u.periods.length;
  }
  return units.length?units:[{id:'unit-1',title:'待核对单元',from:1,to:pages.length,printedFrom:'',lessons:1,periods:[{number:1,title:'待核对课时',from:1,to:pages.length}]}];
}
export function textbookPrintedPage(book,page){
  const text=book.pages.find(p=>p.number===page)?.text||'',footer=text.match(/(?:^|\n)(\d{1,3})\s*$/);
  if(footer)return Number(footer[1]);
  const unit=book.units.find(u=>page>=u.from&&page<=u.to);
  return unit&&/^\d+$/.test(unit.printedFrom)?Number(unit.printedFrom)+page-unit.from:null;
}
export function textbookVocabulary(book){
  const words=[];let inList=false;
  for(const p of book.pages){
    if(/^Vocabulary in Each Unit\s*$/im.test(p.text))inList=true;
    if(inList&&/Vocabulary A[–-]Z/i.test(p.text))break;
    if(!inList)continue;
    let start=0;
    for(const end of p.text.matchAll(/p\.\s*(\d{1,3})\b/g)){
      const raw=p.text.slice(start,end.index+end[0].length);start=end.index+end[0].length;
      const quote=raw.replace(/^(?:\s*(?:Vocabulary in Each Unit[^\n]*|Unit\s*\d+|\d+)\s*\n)+/i,'').trim();
      const word=quote.match(/^([A-Za-z][A-Za-z ’‘'().…\/-]*?)(?=\s*\/[^/]+\/|\s+[\u3400-\u9fff])/u)?.[1]?.trim();
      if(!word||word.length>100||quote.length>500)continue;
      const meaning=quote.slice(word.length).replace(/\/[^/]+\//g,'').replace(/p\.\s*\d+\s*$/,'').replace(/\s+/g,' ').trim().slice(0,300);
      words.push({word,meaning,page:p.number,quote,printedPage:Number(end[1])});
    }
  }
  return words;
}
export function makeTextbookReference(book,from,to,locked=false){
  const printedFrom=textbookPrintedPage(book,from),printedTo=textbookPrintedPage(book,to);
  return {materialId:book.id,from,to,printedFrom:printedFrom===null?'':String(printedFrom),printedTo:printedTo===null?'':String(printedTo),locked,vocabulary:printedFrom===null||printedTo===null?[]:textbookVocabulary(book).filter(w=>w.printedPage>=printedFrom&&w.printedPage<=printedTo).slice(0,100)};
}
export function suggestTextbookReferences(course,book){
  return {...course,primaryId:book.id,units:course.units.map(u=>{
    const bookUnit=book.units.find(b=>b.id===u.id);if(!bookUnit)return u;
    let section='';const pages=book.pages.filter(p=>p.number>=bookUnit.from&&p.number<=bookUnit.to).map(p=>{const s=compact(p.text).match(/SECTION([AB])/i);if(s)section=s[1].toUpperCase();return {...p,section};});
    return {...u,periods:u.periods.map(period=>{
      if(period.reference?.locked)return period;
      const section=period.title.match(/Section\s*([AB])/i)?.[1]?.toUpperCase(),within=pages.filter(p=>!section||p.section===section),anchors=[...period.title.matchAll(/\b(\d[a-z])\b/ig)].map(m=>m[1]);
      let candidates=within.filter(p=>anchors.some(a=>new RegExp(`\\b${a}\\b`,'i').test(p.text)));
      if(/Project/i.test(period.title))candidates=within.filter(p=>/Project/i.test(p.text));
      if(/Pronunciation/i.test(period.title)){const pronunciation=within.filter(p=>/Pronunciation/i.test(p.text));candidates=[...candidates,...pronunciation];}
      if(!candidates.length)return period;
      const from=Math.min(...candidates.map(p=>p.number)),to=Math.max(...candidates.map(p=>p.number));
      return {...period,reference:makeTextbookReference(book,from,to)};
    })};
  })};
}
export function courseLessons(material,unit,materials,contentMode='auto'){
  const overview=extractUnitOverview(material,unit);
  return [...unit.periods].sort((a,b)=>a.number-b.number).map(p=>{
    const suggestion=contentMode==='local'?undefined:unit.analysis?.lessonSuggestions?.find(l=>l.lesson===p.number),book=materials.find(m=>m.id===p.reference?.materialId&&!m.deletedAt),ref=book&&p.reference;
    const local=extractLessonContent(material,unit,p,overview);
    const words=ref?.vocabulary.map(w=>`${w.word} ${w.meaning}`).join('；');
    return {id:`${unit.id}:${p.number}`,unitId:unit.id,title:`${unit.title} · 第${p.number}课时 · ${p.title}`.slice(0,300),content:((suggestion?.content||local.content)+(words?'\n教材词表：'+words:'')).slice(0,5000),source:(`${material.title} · 教案${material.format&&material.format!=='pdf'?'分段':'PDF'} ${p.from}–${p.to}`+(!suggestion?' · 按原文提取':'')+(local.overviewPages.length&&!suggestion?`；单元集备 ${local.overviewPages.join('、')}`:'')+(ref?`；${book.title} · 教材PDF ${ref.from}–${ref.to}${ref.printedFrom?' · 印刷页 '+ref.printedFrom+'–'+ref.printedTo:''}${ref.locked?' · 已锁定关联':' · 关联待核对'}`:'')).slice(0,500)};
  });
}
