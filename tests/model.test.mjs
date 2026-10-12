import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, validateBackup, validDate } from '../src/model.mjs';
test('金额使用整数分，拒绝无效输入',()=>{assert.equal(parseAmount('0.29'),29);assert.equal(parseAmount('12.1'),1210);for(const value of ['0','-1','1.001','1e3','NaN','1000001'])assert.throws(()=>parseAmount(value));});
test('日期验证闰年和无效日',()=>{assert.ok(validDate('2024-02-29'));assert.equal(validDate('2025-02-29'),false);assert.equal(validDate('2026-13-01'),false);});
test('备份验证完整记录，拒绝重复编号和损坏数据',()=>{const entry={id:'one',cents:29,category:'餐饮',date:'2026-10-12',note:'午餐'};assert.deepEqual(validateBackup({version:1,expenses:[entry]}),[entry]);assert.throws(()=>validateBackup({version:1,expenses:[entry,entry]}));assert.throws(()=>validateBackup({version:1,expenses:[{...entry,cents:1.5}]}));assert.throws(()=>validateBackup({version:2,expenses:[]}));});
