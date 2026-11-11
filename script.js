(() => {
  'use strict';
  const INITIAL = ['50', '3', '3', '30', '750', '75000', '10'];
  const $ = id => document.getElementById(id);
  const nInput = $('n');
  const stepInput = $('n-step');
  const upBtn = $('n-up');
  const downBtn = $('n-down');
  const valuesInput = $('values');
  const tbody = $('results');
  const errorEl = $('error');
  const statusEl = $('status');
  const resultCopyBtn = $('copy-results');
  const detailsCopyBtn = $('copy-details');
  let resultsRaw = [];
  let detailsRaw = '';

  // 10進文字列を正確に整数 + 小数桁数として取り扱う（Numberへの変換なし）。
  function parseDecimal(input) {
    const s = input.trim();
    if (s.length > 120) throw new Error('数値は120文字以内で入力してください。');
    const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
    if (!match || (!match[2] && !match[3])) throw new Error('数値の形式が正しくありません。例：10000 または 12.5');
    const fraction = match[3] || '';
    const combined = (match[2] || '0') + fraction;
    const sign = match[1] === '-' ? -1n : 1n;
    return { int: BigInt(combined) * sign, scale: fraction.length };
  }

  // 小数部分は末尾の不要な0だけを取り除き、桁区切りは整数部分だけに適用する。
  function decimalString(integer, scale, grouped = false) {
    const negative = integer < 0n;
    let raw = (negative ? -integer : integer).toString();
    if (scale) raw = raw.padStart(scale + 1, '0');
    let whole = scale ? raw.slice(0, -scale) : raw;
    let fractional = scale ? raw.slice(-scale).replace(/0+$/, '') : '';
    if (grouped) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative && integer !== 0n ? '-' : '') + whole + (fractional ? '.' + fractional : '');
  }

  // N は自然数（1以上の整数）だけ。大きい数も BigInt で厳密に扱う。
  function parseNaturalN(input) {
    const s = input.trim();
    if (!/^\d+$/.test(s) || s.length > 120) {
      throw new Error('N は1以上の整数（自然数）を入力してください。小数は使えません。');
    }
    const n = BigInt(s);
    if (n < 1n) throw new Error('N は1以上の整数（自然数）を入力してください。');
    return n;
  }

  function adjustN(direction) {
    let n;
    try { n = parseNaturalN(nInput.value); }
    catch { n = 0n; }
    const step = BigInt(stepInput.value);
    const next = n + BigInt(direction) * step;
    if (next < 1n || next.toString().length > 120) return;
    nInput.value = next.toString();
    render();
  }

  function syncSpinner() {
    try {
      const n = parseNaturalN(nInput.value);
      downBtn.disabled = n <= BigInt(stepInput.value);
    } catch {
      downBtn.disabled = true;
    }
  }

  function render() {
    syncSpinner();
    statusEl.textContent = '';
    tbody.replaceChildren();
    resultsRaw = [];
    detailsRaw = '';
    resultCopyBtn.disabled = true;
    detailsCopyBtn.disabled = true;
    const nText = nInput.value.trim();
    try {
      if (!nText) throw new Error('N を入力してください。');
      const n = parseNaturalN(nText);
      const inputs = valuesInput.value.split(/[\s,、，;；]+/).filter(Boolean);
      if (!inputs.length) throw new Error('掛け算する数値を1個以上入力してください。');
      if (inputs.length > 200) throw new Error('一度に計算できる数値は200個までです。');

      // M = 1 + N/10000 = (10000 + N) / 10000。
      const multScale = 4;
      const multInt = 10000n + n;
      const multiplier = decimalString(multInt, multScale);
      $('multiplier').textContent = decimalString(multInt, multScale, true);
      $('formula').textContent = `1 + ${decimalString(n, 0, true)} × 0.0001 = ${decimalString(multInt, multScale, true)}`;

      const detailLines = [`N = ${n.toString()}`, `M(d) = ${multiplier}`, ''];
      inputs.forEach((item, i) => {
        let v;
        try { v = parseDecimal(item); }
        catch { throw new Error(`${i + 1}番目の数値「${item}」が不正です。`); }
        const output = decimalString(v.int * multInt, v.scale + multScale);
        const tr = document.createElement('tr');
        for (const t of [String(i + 1), decimalString(v.int, v.scale, true), decimalString(v.int * multInt, v.scale + multScale, true)]) {
          const cell = document.createElement('td');
          cell.textContent = t;
          tr.appendChild(cell);
        }
        tbody.appendChild(tr);
        resultsRaw.push(output);
        detailLines.push(`${decimalString(v.int, v.scale)} × ${multiplier} = ${output}`);
      });
      detailsRaw = detailLines.join('\n');
      errorEl.textContent = '';
      resultCopyBtn.disabled = false;
      detailsCopyBtn.disabled = false;
    } catch (e) {
      tbody.replaceChildren();
      resultsRaw = [];
      detailsRaw = '';
      $('multiplier').textContent = '—';
      $('formula').textContent = '入力を確認してください。';
      errorEl.textContent = e.message || '計算できませんでした。';
    }
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        // file:// 環境でクリップボードAPIを使えないブラウザ向け。
        const helper = document.createElement('textarea');
        helper.value = value;
        helper.style.position = 'fixed';
        helper.style.left = '-9999px';
        document.body.appendChild(helper);
        helper.select();
        const success = document.execCommand('copy');
        helper.remove();
        if (!success) throw new Error('copy rejected');
      }
      statusEl.textContent = 'コピーしました。';
    } catch {
      statusEl.textContent = '自動コピーできませんでした。ブラウザのコピー権限を確認してください。';
    }
  }

  nInput.addEventListener('input', render);
  stepInput.addEventListener('change', syncSpinner);
  upBtn.addEventListener('click', () => adjustN(1));
  downBtn.addEventListener('click', () => adjustN(-1));
  valuesInput.addEventListener('input', render);
  $('copy-results').addEventListener('click', () => copyText(resultsRaw.join('\n')));
  $('copy-details').addEventListener('click', () => copyText(detailsRaw));
  $('reset').addEventListener('click', () => { nInput.value = '10000'; valuesInput.value = INITIAL.join('\n'); render(); });
  $('clear').addEventListener('click', () => { nInput.value = ''; render(); nInput.focus(); });
  render();
})();
