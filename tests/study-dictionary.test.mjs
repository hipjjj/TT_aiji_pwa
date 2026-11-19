import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDictionary,dictionaryBucket,normalizeWord,collectWord} from '../src/study/dictionary.mjs';
import {emptyStudy,validateStudy,mergeStudy,sampleArticle} from '../src/study/model.mjs';
const load=async key=>JSON.parse(await readFile(new URL(`../public/study-dictionary/${key}.json`,import.meta.url),'utf8'));

test('real offline data covers common words, technical words, contractions and irregular inflections',async()=>{
  const lookup=createDictionary(load);
  for(const [word,meaning,lemma] of [['that',/那个/,''],['went',/去/,'go'],['studies',/学习/,'study'],['children',/孩子/,'child'],['running',/跑/,'run'],['huddling',/挤/,'huddle'],['photosynthesis',/光合作用/,''],['don’t',/不要/,'']]){
    const result=await lookup(word);assert.match(result.meaning,meaning,word);assert.equal(result.lemma,lemma,word);assert.equal(result.source,'ecdict');assert(!result.meaning.includes('\\n'));
  }
  assert.equal((await lookup('THAT')).word,'that');
  assert.equal(await lookup('zzzznonexistentwordzzzz'),null);
  assert.equal(await lookup('../../secrets'),null);
});

test('all exported words are in their correct shard and fit the offline cache budget',async()=>{
  const meta=await load('manifest');let count=0;
  for(let i=0;i<64;i++){
    const key=String(i).padStart(2,'0'),chunk=await load(key);
    for(const [word,value] of Object.entries(chunk)){
      count++;assert.equal(dictionaryBucket(word),key);
      assert.equal(normalizeWord(word),word);assert.equal(value.length,3);
      assert(value[0].length<=300);assert(value[0]||value[2]);
    }
  }
  assert.equal(count,meta.entries);assert(count>400000);assert(meta.maxChunkBytes<2*1024*1024);
});

test('personal definitions work with no network and take precedence over dictionary data',async()=>{
  let requests=0;const lookup=createDictionary(async()=>{requests++;throw Error('offline');});
  const result=await lookup('THAT',[{word:'That',meaning:'引导宾语从句，在这里不译',updatedAt:1},{word:'that',meaning:'最新的语境笔记',updatedAt:2}]);
  assert.equal(result.meaning,'最新的语境笔记');assert.equal(result.source,'note');assert.equal(requests,0);
});

test('failed loads can be retried and simultaneous requests share the same shard fetch',async()=>{
  let attempts=0;
  const lookup=createDictionary(async key=>{if(++attempts===1)throw Error('temporary offline');return load(key);});
  await assert.rejects(lookup('that'),/temporary offline/);
  const results=await Promise.all([lookup('that'),lookup('that'),lookup('that')]);
  assert.equal(attempts,2);assert(results.every(result=>result.meaning.includes('那个')));
});

test('editing a legacy vocabulary entry preserves its ID, mastery, unrelated records and backup compatibility',()=>{
  const old={...emptyStudy(),articles:[{...sampleArticle,updatedAt:1}],words:[{id:'legacy-custom-id',word:'That',meaning:'原来的笔记',context:'that sentence',articleId:'old-article',mastered:true,updatedAt:1},{id:'other',word:'other',meaning:'别的',context:'',articleId:'',mastered:false,updatedAt:1}],footprints:[{id:'foot',title:'旧阅读',articleId:'old-article',date:'2026-11-18',minutes:3,updatedAt:1}]};
  const snapshot=structuredClone(old);
  const result=collectWord(old,{word:'that',meaning:' 更新后的释义 ',context:'new sentence',articleId:'new-article'},2);
  assert.deepEqual(old,snapshot);assert.equal(result.words.length,2);assert.equal(result.words[0].id,'legacy-custom-id');assert.equal(result.words[0].mastered,true);assert.equal(result.words[0].meaning,'更新后的释义');assert.deepEqual(result.words[1],old.words[1]);assert.deepEqual(result.articles,old.articles);assert.deepEqual(result.footprints,old.footprints);
  assert.deepEqual(validateStudy(result),result);assert.deepEqual(mergeStudy(emptyStudy(),result),result);
  const added=collectWord(result,{word:'went',meaning:'去',context:'He went home.',articleId:'new-article'},3);
  assert.equal(added.words.length,3);assert.equal(added.words[2].mastered,false);
});
