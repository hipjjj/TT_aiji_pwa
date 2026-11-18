import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyStudy,validateStudy,validateStudyBackup,mergeStudy,sampleArticle} from '../src/study/model.mjs';
import {buildScopedBackup,validateScopedBackup} from '../src/backup/model.mjs';
test('old backups omit study without clearing current data',()=>{assert.equal(validateStudyBackup({version:1,expenses:[]}),null);});
test('study backups validate and merge without dropping unrelated records',()=>{
  const old={...emptyStudy(),articles:[{...sampleArticle,updatedAt:1}]};
  const incoming={...emptyStudy(),words:[{id:'warm',word:'warm',meaning:'温暖',context:'Keep warm.',articleId:sampleArticle.id,mastered:false,updatedAt:2}]};
  const out=mergeStudy(old,incoming);assert.equal(out.articles[0].text,sampleArticle.text);assert.equal(out.words[0].word,'warm');
  const backup=buildScopedBackup({study:out},'study',false);validateScopedBackup(backup);assert.deepEqual(validateStudyBackup(backup),out);assert.deepEqual(backup.expenses,[]);
  assert.throws(()=>validateScopedBackup({...backup,fridge:{}}));assert.throws(()=>validateStudy({...incoming,words:[...incoming.words,...incoming.words]}));
  assert.throws(()=>validateStudy({...emptyStudy(),articles:[{...sampleArticle,text:'a'.repeat(100001),updatedAt:1}]}));
});
