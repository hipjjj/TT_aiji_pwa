import assert from 'node:assert/strict';
import test from 'node:test';
import {penguins,validateChatRequest,validateChatResult,validateChatBackup} from '../src/chat/model.mjs';
import {chatInstructions,chatSchema} from '../server/chat.mjs';
test('all six penguins support chat while keeping old names valid',()=>{
  assert.equal(penguins.length,6);
  for(const mode of penguins){assert.equal(validateChatRequest({mode,today:'2026-11-18',messages:[{speaker:'用户',text:'你好'}]}).mode,mode);const out=validateChatResult({replies:[{speaker:mode,text:'坐一会儿吧。'}],proposals:[]},mode);assert.equal(out.replies[0].speaker,mode);}
  assert.match(chatInstructions,/只有羊羊包是女生/);
  assert.deepEqual(chatSchema.properties.replies.items.properties.speaker.enum,penguins);
  const backup={version:1,expenses:[],chat:{threads:[{id:'old',mode:'鲍比',title:'旧对话',updatedAt:1}],messages:[{id:'m',threadId:'old',speaker:'鲍比',text:'旧消息',createdAt:1,proposals:[]}],memories:[],growth:null}};
  assert.equal(validateChatBackup(backup).threads[0].mode,'鲍比');
});
