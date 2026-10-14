// Parse arithmetic directly; never execute user input. Exact fractions avoid money rounding errors.
export function calculateAmount(input) {
  if (typeof input !== 'string' || input.length > 120) throw Error('算式最多输入120个字符');
  const text = input.normalize('NFKC').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
  if (!text || !/^[\d.+*/()\-]+$/.test(text)) throw Error('请输入金额，或使用加减乘除和括号');
  let pos = 0;
  const fraction = (n, d = 1n) => {
    if (!d) throw Error('不能除以0');
    if (d < 0n) { n = -n; d = -d; }
    let a = n < 0n ? -n : n, b = d;
    while (b) { const r = a % b; a = b; b = r; }
    return { n: n / a, d: d / a };
  };
  const atom = () => {
    const char = text[pos];
    if (char === '+' || char === '-') {
      pos++; const v = atom(); return char === '-' ? { n: -v.n, d: v.d } : v;
    }
    if (char === '(') {
      pos++; const v = sum(); if (text[pos++] !== ')') throw Error('请补全括号'); return v;
    }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(text.slice(pos));
    if (!match) throw Error('请补全算式');
    pos += match[0].length;
    const [whole, decimals = ''] = match[0].split('.');
    if (whole.length > 12 || decimals.length > 8) throw Error('单个数字最多12位整数、8位小数');
    return fraction(BigInt((whole || '0') + decimals), 10n ** BigInt(decimals.length));
  };
  const product = () => {
    let v = atom();
    while (text[pos] === '*' || text[pos] === '/') {
      const op = text[pos++], w = atom();
      v = op === '*' ? fraction(v.n * w.n, v.d * w.d) : fraction(v.n * w.d, v.d * w.n);
    }
    return v;
  };
  const sum = () => {
    let v = product();
    while (text[pos] === '+' || text[pos] === '-') {
      const op = text[pos++], w = product();
      v = fraction(v.n * w.d + (op === '+' ? w.n : -w.n) * v.d, v.d * w.d);
    }
    return v;
  };
  const value = sum();
  if (pos !== text.length) throw Error('算式格式不正确，请检查运算符和括号');
  if (value.n <= 0n || value.n > 1000000n * value.d) throw Error('计算结果须在0.01至1,000,000元之间');
  const cents = (value.n * 200n + value.d) / (2n * value.d);
  if (cents < 1n) throw Error('计算结果须至少为0.01元');
  return Number(cents);
}
