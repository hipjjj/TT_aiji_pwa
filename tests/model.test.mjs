import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, validateBackup, validDate, validateBudgetBackup } from '../src/model.mjs';
test('金额使用整数分，拒绝无效输入',()=>{assert.equal(parseAmount('0.29'),29);assert.equal(parseAmount('12.1'),1210);for(const value of ['0','-1','1.001','1e3','NaN','1000001'])assert.throws(()=>parseAmount(value));});
test('日期验证闰年和无效日',()=>{assert.ok(validDate('2024-02-29'));assert.equal(validDate('2025-02-29'),false);assert.equal(validDate('2026-13-01'),false);});
test('备份验证完整记录，拒绝重复编号和损坏数据',()=>{const entry={id:'one',cents:29,category:'餐饮',date:'2026-10-12',note:'午餐'};assert.deepEqual(validateBackup({version:1,expenses:[entry]}),[entry]);assert.throws(()=>validateBackup({version:1,expenses:[entry,entry]}));assert.throws(()=>validateBackup({version:1,expenses:[{...entry,cents:1.5}]}));assert.throws(()=>validateBackup({version:2,expenses:[]}));});
test('新分类备份可完整恢复，旧住房分类兼容转换，未知分类拒绝',()=>{
  const names=['餐饮','食品日用','生活缴费','交通','购物','娱乐','医疗','旅行','人情','其他'];
  const entries=names.map((category,index)=>({id:`new-${index}`,cents:100+index,category,date:'2026-10-12',note:''}));
  assert.deepEqual(validateBackup({version:1,expenses:entries}),entries);
  const legacy={id:'old-home',cents:12345,category:'住房',date:'2026-10-12',note:'房租'};
  assert.deepEqual(validateBackup({version:1,expenses:[legacy]}),[{...legacy,category:'生活缴费'}]);
  assert.throws(()=>validateBackup({version:1,expenses:[{...legacy,category:'未知分类'}]}));
});

test('预算允许零元，账单金额仍须大于零',()=>{
  assert.equal(parseAmount('0.00',true),0);
  assert.equal(parseAmount('1000.29',true),100029);
  assert.throws(()=>parseAmount('0.00'));
  for(const value of ['-1','0.001','1000001'])assert.throws(()=>parseAmount(value,true));
});
test('预算备份兼容旧文件并拒绝损坏或重复月份',()=>{
  assert.deepEqual(validateBudgetBackup({version:1,expenses:[]}),[]);
  const budgets=[{month:'2026-10',cents:100029},{month:'2026-11',cents:0}];
  assert.deepEqual(validateBudgetBackup({budgets}),budgets);
  for(const invalid of [[budgets[0],budgets[0]],[{month:'2026-13',cents:100}],[{month:'2026-10',cents:-1}],[{month:'2026-10',cents:1.5}],null])assert.throws(()=>validateBudgetBackup({budgets:invalid}));
});
