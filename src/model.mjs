import {recordLimits} from './recordLimits.mjs';
export const categories = ['餐饮', '食品日用', '生活缴费', '交通', '购物', '娱乐', '医疗', '旅行', '人情', '其他'];
export function normalizeCategory(category) {
  return category === '住房' ? '生活缴费' : category;
}
export function parseAmount(value, allowZero = false) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('请输入最多两位小数的有效金额');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < (allowZero ? 0 : 1) || cents > 100000000) throw new Error(`金额须在 ${allowZero ? '0' : '0.01'} 至 1,000,000 元之间`);
  return cents;
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validateExpense(item){
 if (!item || typeof item.id !== 'string' || !item.id || !Number.isSafeInteger(item.cents) || item.cents <= 0 || item.cents > 100000000 || !categories.includes(normalizeCategory(item.category)) || !validDate(item.date) || typeof item.note !== 'string' || item.note.length > recordLimits.note) throw new Error('账单内容无效');
 return {id:item.id,cents:item.cents,category:normalizeCategory(item.category),date:item.date,note:item.note};
}
export function validateBackup(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.expenses) || data.expenses.length > 100000) throw new Error('备份格式无效');
  const ids = new Set();
  return data.expenses.map(item => {
    const saved=validateExpense(item);if(ids.has(saved.id))throw new Error('备份中包含重复的账单');ids.add(saved.id);return saved;
  });
}

export function validateBudgetBackup(data) {
  if (data.budgets === undefined) return [];
  if (!Array.isArray(data.budgets) || data.budgets.length > 10000) throw new Error('预算备份格式无效');
  const months = new Set();
  return data.budgets.map(item => {
    if (!item || typeof item.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.month) || months.has(item.month) || !Number.isSafeInteger(item.cents) || item.cents < 0 || item.cents > 100000000) throw new Error('备份中包含无效或重复的月度预算');
    months.add(item.month);
    return {month:item.month,cents:item.cents};
  });
}
