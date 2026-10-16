import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readAccessCode,saveAccessCode,clearAccessCode} from '../src/personal/access-code.mjs';
test('device access code migrates old sessions, survives their removal, and clears both stores',()=>{
 const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
 const oldLocal=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldSession=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage()});Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage()});
 try{sessionStorage.setItem('xiaobao-ai-access','legacy-fixture-access');assert.equal(readAccessCode(),'legacy-fixture-access');assert.equal(sessionStorage.getItem('xiaobao-ai-access'),null);assert.equal(readAccessCode(),'legacy-fixture-access');saveAccessCode('new-fixture-access');assert.equal(readAccessCode(),'new-fixture-access');clearAccessCode();assert.equal(readAccessCode(),'');sessionStorage.setItem('xiaobao-ai-access','old');saveAccessCode('new');assert.equal(readAccessCode(),'new');assert.equal(sessionStorage.getItem('xiaobao-ai-access'),null);}finally{for(const [key,descriptor] of [['localStorage',oldLocal],['sessionStorage',oldSession]]){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
