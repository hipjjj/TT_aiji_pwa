import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {penguins} from '../src/chat/model.mjs';
import {chatViewport} from '../src/chat/viewport.mjs';

test('each single chat renders only the selected penguin portrait, while group chat renders the family',async()=>{
  const result=await build({entryPoints:['src/chat/ChatIdentity.tsx'],bundle:true,platform:'node',format:'cjs',jsx:'automatic',write:false,external:['react','react/jsx-runtime'],loader:{'.webp':'dataurl'}});
  const mod={exports:{}};
  new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
  for(const mode of penguins){
    const html=renderToStaticMarkup(createElement(mod.exports.default,{mode}));
    assert.equal((html.match(/role="img"/g)||[]).length,1);
    assert(html.includes(`data-character="${mode}"`));assert(!html.includes('family-portrait'));
    for(const other of penguins.filter(name=>name!==mode))assert(!html.includes(`aria-label="${other}"`));
  }
  const group=renderToStaticMarkup(createElement(mod.exports.default,{mode:'群聊'}));
  assert(group.includes('family-portrait'));assert(group.includes('企鹅家族'));
});

test('iPhone keyboard compacts chrome even when Safari keeps the layout viewport unchanged',()=>{
  assert.deepEqual(chatViewport({height:382,layoutHeight:844,baselineHeight:844,focused:true}),{keyboard:true,compact:true});
  assert.deepEqual(chatViewport({height:580,layoutHeight:844,baselineHeight:844,focused:true}),{keyboard:true,compact:true});
});

test('Android keyboard and short windows retain compact controls, then expand when space returns',()=>{
  assert.deepEqual(chatViewport({height:390,layoutHeight:390,baselineHeight:820,focused:true}),{keyboard:true,compact:true});
  assert.deepEqual(chatViewport({height:340,layoutHeight:340,baselineHeight:340,focused:false}),{keyboard:false,compact:true});
  assert.deepEqual(chatViewport({height:820,layoutHeight:820,baselineHeight:820,focused:false}),{keyboard:false,compact:false});
  assert.deepEqual(chatViewport({height:780,layoutHeight:820,baselineHeight:820,focused:true}),{keyboard:false,compact:false});
});
