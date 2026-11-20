// Extract the supplied lesson-plan layout without guessing new teaching content.
const tidy=s=>s.replace(/\r/g,'').replace(/[ \t]+/g,' ').trim();
const cleanPage=s=>s.split('\n').filter(line=>!/^\s*20\s*[-－—]\s*20\s*学年度.*$|^\s*教学设计\s*[（(]续[）)]\s*$|^\s*课\s*题\s+课\s*型\s+课\s*时\s*$/u.test(line)).join('\n');
const clip=(s,n)=>{const text=tidy(s);if(text.length<=n)return text;const part=text.slice(0,n-1),boundary=Math.max(part.lastIndexOf(' '),part.lastIndexOf('\n'),part.lastIndexOf('。'));return part.slice(0,boundary>n*.65?boundary:n-1).trimEnd()+'…';};
const sectionNames='Language skills|Cultural awareness|Thinking quality|Learning ability|Key words and phrases|Key sentences|Key grammar|Allocation of periods';
function section(text,name){
  const start=new RegExp(`(?:^|\\n)\\s*${name}\\s*[:：]\\s*`,'i').exec(text);if(!start)return '';
  return text.slice(start.index+start[0].length).split(new RegExp(`\\n\\s*(?:${sectionNames}|单元[（(]|第[（(])`,'i'))[0].trim();
}
export function extractUnitOverview(material,unit){
  const n=unit.id.match(/^unit-(\d+)$/)?.[1],firstDetail=Math.min(...material.units.map(u=>u.from));
  const pages=material.pages.filter(p=>p.number<firstDetail&&/集备要点/.test(p.text)&&new RegExp(`(?:\\bUnit\\s*${n}\\b|第[（(]\\s*${n}\\s*[）)]\\s*单元)`,'i').test(p.text));
  const text=pages.map(p=>p.text).join('\n');
  return {goals:section(text,'Language skills').split(/\n\s*\d+[.)]\s*/).map(s=>clip(s,500)).filter(Boolean).slice(0,5),vocabulary:section(text,'Key words and phrases').replace(/\n/g,' ').split(/[,，;；]/).map(s=>clip(s,150).replace(/[.。]\s*$/,'')).filter(Boolean).slice(0,100),grammar:clip(section(text,'Key grammar'),600),pages:pages.map(p=>p.number)};
}
export function extractLessonContent(material,unit,period,overview=extractUnitOverview(material,unit)){
  const pages=material.pages.filter(p=>p.number>=period.from&&p.number<=period.to),text=pages.map(p=>cleanPage(p.text)).join('\n');
  const stepStart=text.search(/(?:^|\n)\s*Step\s*1\b/i),prefix=text.slice(0,stepStart<0?1500:stepStart);
  const fraction=/\b\d{1,2}\s*\/\s*\d{1,2}\b/.exec(prefix),goalsText=fraction?prefix.slice(fraction.index+fraction[0].length):prefix.replace(/^.*\bUnit\s*\d+[^\n]*\n/i,'');
  const numbered=[...goalsText.matchAll(/(?:^|\n)\s*\d+[.)]\s*([\s\S]*?)(?=\n\s*\d+[.)]\s*|$)/g)].map(m=>clip(m[1],300));
  const goals=numbered.slice(0,4);
  const steps=[];
  for(const match of text.matchAll(/(?:^|\n)\s*(Step\s*(\d+))\s*\n?([\s\S]*?)(?=\n\s*Step\s*\d+\b|$)/gi)){
    if(steps.some(s=>s.number===Number(match[2])))continue;
    const lines=match[3].split('\n').map(tidy).filter(Boolean),heading=lines[0]&&!/^\d+[.)]|^1\./.test(lines[0])&&lines[0].length<65?lines.shift():'';
    const body=lines.join(' ').split(/Must[- ]do:|Choose to do:|Homework|Bb design|教学设计|备课笔记/i)[0];
    steps.push({number:Number(match[2]),text:clip([heading,body].filter(Boolean).join('：'),220)});
  }
  const assignment=/(?:^|\n)\s*(?:Must[- ]do\s*:|Must do\s*:|Homework\b|Summary\s*&\s*Homework|作业\s*[:：]?)/im.exec(text);
  const homework=assignment?clip(text.slice(assignment.index).split(/\n\s*(?:Bb\s*design|Unit\s*\d+|板书|教学反思|Teaching reflection)\b/i)[0],600):'';
  const explicitWords=/(?:new\s+vocabular(?:y|ies)|(?:key|new|target)\s+words(?:\s+and\s+phrases)?)\s*[:：]\s*([^\n]*(?:\n(?!\s*\d+[.)]|\s*Step\s*\d)[^\n]*)*)/i.exec(text)?.[1]?.split(/\.\s*(?:\n|\d+[.)])/)[0]||'';
  const normalized=explicitWords.toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
  const vocabulary=overview.vocabulary.filter(word=>{const term=word.toLowerCase().replace(/[’‘]/g,"'");return term.length>1&&new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(normalized);}).slice(0,20);
  const parts=[];
  if(goals.length)parts.push('教学目标与重点：\n'+goals.join('\n'));
  if(steps.length)parts.push('课堂流程摘录：\n'+steps.map(s=>`Step ${s.number} ${s.text}`).join('\n'));
  if(vocabulary.length)parts.push('教案明确列出的词汇：'+vocabulary.join('；'));
  if(overview.grammar)parts.push('单元语法参考：'+overview.grammar);
  if(homework)parts.push('教案作业：\n'+homework);
  if(!goals.length&&!steps.length)parts.unshift('教案内容摘录：\n'+clip(text,2500));
  return {goals,vocabulary,steps,homework,content:parts.join('\n\n').slice(0,4800),overviewPages:overview.pages};
}
