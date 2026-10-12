export const categories = ['餐饮', '交通', '购物', '住房', '娱乐', '医疗', '其他'];
export function parseAmount(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('请输入最多两位小数的有效金额');
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000) throw new Error('金额须在 0.01 至 1,000,000 元之间');
  return cents;
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validateBackup(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.expenses) || data.expenses.length > 100000) throw new Error('备份格式无效');
  const ids = new Set();
  return data.expenses.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !Number.isSafeInteger(item.cents) || item.cents <= 0 || item.cents > 100000000 || !categories.includes(item.category) || !validDate(item.date) || typeof item.note !== 'string' || item.note.length > 200) throw new Error('备份中包含无效或重复的账单');
    ids.add(item.id);
    return {id:item.id,cents:item.cents,category:item.category,date:item.date,note:item.note};
  });
}
