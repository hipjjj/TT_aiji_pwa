import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {textPDF} from './helpers/study-pdf.mjs';
import {articleURL,articleText} from '../src/study/import-model.mjs';
import {pdfDocumentText,pdfPageText} from '../src/study/pdf-text.mjs';
import {fetchWebArticle,extractWebArticle} from '../server/study-article.mjs';
import {handle} from '../server/worker.mjs';
import {validateStudy,emptyStudy} from '../src/study/model.mjs';
const paragraph='Penguins keep warm by standing together on the cold ice. Every small step helps their neighbours share the warmth.';
const html=`<html><head><title>Penguins and warmth</title></head><body><nav>PRIVATE NAVIGATION</nav><script>throw new Error('NEVER EXECUTE');</script><article><h1>Penguins and warmth</h1>${Array.from({length:4},()=>`<p>${paragraph}</p>`).join('')}</article></body></html>`;
const htmlResponse=(body=html)=>new Response(body,{headers:{'Content-Type':'text/html; charset=utf-8'}});
test('article URLs normalize safely and reject local, credentialed and non-web targets',()=>{
  assert.equal(articleURL('example.org/story#read'),'https://example.org/story');
  for(const url of ['file:///etc/passwd','javascript:alert(1)','https://u:p@example.org','http://127.0.0.1/x','http://2130706433','http://0x7f000001','http://[::1]','http://localhost.','https://a.local.','https://example.org:8443','http://127.0.0.1.nip.io'])assert.throws(()=>articleURL(url),url);
  assert.equal(articleText('a\r\n\r\n b\t  c'),'a\n\nb c');assert.throws(()=>articleText('a'.repeat(100001)));
});
test('real multi-page PDF text is extracted in order and scan-only or excessive PDFs explain the limit',async()=>{
  const task=getDocument({data:textPDF(['Penguins learn together.','Warmth is shared.']),useSystemFonts:true});
  const document=await task.promise;const progress=[];
  try{const result=await pdfDocumentText(document,{onProgress:(page,total)=>progress.push([page,total])});assert.equal(result.text,'Penguins learn together.\n\nWarmth is shared.');assert.equal(result.emptyPages,0);assert.deepEqual(progress,[[1,2],[2,2]]);}finally{await task.destroy();}
  const scanned=getDocument({data:textPDF(['']),useSystemFonts:true});try{await assert.rejects(pdfDocumentText(await scanned.promise),/OCR/);}finally{await scanned.destroy();}
  await assert.rejects(pdfDocumentText({numPages:201}),/200/);
  assert.equal(pdfPageText([{str:'Hello',transform:[1,0,0,1,0,20],height:10},{str:'world',transform:[1,0,0,1,30,20],height:10,hasEOL:true},{str:'Next line',hasEOL:true}]),'Hello world\nNext line');
});
test('web extraction preserves title and paragraph text, ignores active HTML, and follows bounded public redirects',async()=>{
  const extracted=extractWebArticle(html,'https://example.org/article');assert.equal(extracted.title,'Penguins and warmth');assert.match(extracted.text,/Every small step/);assert(!extracted.text.includes('PRIVATE NAVIGATION'));assert(!extracted.text.includes('NEVER EXECUTE'));assert.match(extracted.text,/\n\n/);
  const calls=[];const result=await fetchWebArticle('https://example.org/start',{fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');assert.equal(options.headers.Cookie,undefined);return calls.length===1?new Response(null,{status:302,headers:{Location:'/article'}}):htmlResponse();}});
  assert.equal(result.sourceUrl,'https://example.org/article');assert.equal(calls.length,2);
  let count=0;await assert.rejects(fetchWebArticle('https://example.org/start',{fetchImpl:async()=>{count++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});}}));assert.equal(count,1);
  await assert.rejects(fetchWebArticle('https://example.org/large',{fetchImpl:async()=>new Response('x',{headers:{'Content-Type':'text/html','Content-Length':3000000}})}),/太大/);
  await assert.rejects(fetchWebArticle('https://example.org/private',{fetchImpl:async()=>new Response(null,{status:403})}),/HTTP 403/);
  await assert.rejects(fetchWebArticle('https://example.org/file.pdf',{fetchImpl:async()=>new Response('pdf',{headers:{'Content-Type':'application/pdf'}})}),/PDF/);
  await assert.rejects(fetchWebArticle('https://example.org/login',{fetchImpl:async()=>htmlResponse('<html><body>Login required</body></html>')}),/没有找到/);
});
test('article endpoint authenticates, uses its own quota and never sends credentials or content to AI',async()=>{
  const origin='https://hipjjj.github.io',names=[];let calls=0;
  const env={ACCESS_CODE:'fixture-access-code',ALLOWED_ORIGINS:origin,AI_QUOTA:{idFromName:name=>{names.push(name);return name;},get:()=>({fetch:async()=>Response.json({allowed:true})})}};
  const make=(url,access='fixture-access-code')=>new Request('https://worker.test/study-article',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Access-Code':access},body:JSON.stringify({url})});
  const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://example.org/article');assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers['X-Access-Code'],undefined);return htmlResponse();};
  assert.equal((await handle(make('https://example.org/article','wrong'),env,{fetchImpl})).status,401);assert.equal(calls,0);
  assert.equal((await handle(make('http://localhost'),env,{fetchImpl})).status,400);assert.equal(names.length,0);
  const response=await handle(make('https://example.org/article'),env,{fetchImpl});assert.equal(response.status,200);assert.match((await response.json()).text,/Penguins/);assert.deepEqual(names,['study-import']);assert.equal(calls,1);
  const limited={...env,AI_QUOTA:{idFromName:()=>1,get:()=>({fetch:async()=>Response.json({allowed:false})})}};assert.equal((await handle(make('https://example.org/article'),limited,{fetchImpl})).status,429);assert.equal(calls,1);
});
test('PDF and URL articles preserve compatible backup records and safe source links',()=>{
  const article={id:'web',title:'Read',text:paragraph,source:'网页 · example.org',sourceUrl:'https://example.org/article',updatedAt:1};const state={...emptyStudy(),articles:[article,{id:'pdf',title:'PDF lesson',text:paragraph,source:'PDF · lesson.pdf',updatedAt:2}]};assert.deepEqual(validateStudy(state),state);assert.throws(()=>validateStudy({...state,articles:[{...article,sourceUrl:'javascript:alert(1)'}]}));
});
