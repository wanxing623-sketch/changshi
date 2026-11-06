/* 识陷 · 冒烟测试（Node DOM 桩，无需浏览器）
 * 运行：node test/smoke.js        （完整交互流）
 *       node test/smoke.js migrate（v1 → v2 记录迁移）
 * 黑盒驱动 app.js 的渲染与事件路径，捕获运行时错误。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const mode = process.argv[2] || 'flow';

/* ---- localStorage 桩 ---- */
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};

if (mode === 'migrate') {
  store.set('shixian-progress-v1', JSON.stringify({
    records: { '1': { correct: false }, '2': { correct: true } },
    saved: [2]
  }));
}

/* ---- DOM 桩 ---- */
class Element {
  constructor(sel) { this.sel = sel; this.innerHTML = ''; this.textContent = ''; this.dataset = {}; this.title = ''; }
  setAttribute(k, v) { this[k] = v; }
  getAttribute(k) { return this[k]; }
  closest() { return null; }
  classList = { toggle() {}, add() {}, remove() {} };
}
const elCache = new Map();
const getEl = sel => { if (!elCache.has(sel)) elCache.set(sel, new Element(sel)); return elCache.get(sel); };

const listeners = {};
const document = {
  documentElement: new Element('html'),
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  querySelector: sel => getEl(sel),
  querySelectorAll: () => []
};
const window = {
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener() {},
  scrollTo() {},
  confirm: () => true
};
const location = { protocol: 'file:' };
const navigator = { onLine: true };

function defGlobal(name, value) {
  try { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
  catch (e) { try { globalThis[name] = value; } catch (e2) { /* 保留内建实现 */ } }
}
defGlobal('Element', Element);
defGlobal('document', document);
defGlobal('window', window);
defGlobal('location', location);
defGlobal('navigator', navigator);
defGlobal('localStorage', localStorage);
defGlobal('confirm', window.confirm);

/* ---- 事件模拟 ---- */
function fire(type, spec) {
  const target = new Element('target');
  if (spec) {
    target.closest = sel => {
      if (spec.page && sel === '[data-page]') return { dataset: { page: spec.page } };
      if (spec.filter && sel === '[data-filter]') return { dataset: { filter: spec.filter } };
      if (spec.option != null && sel === '[data-option]') return { dataset: { option: String(spec.option) } };
      if (spec.action && sel === '[data-action]') return { dataset: { action: spec.action } };
      return null;
    };
  }
  const ev = { target, key: spec && spec.key, preventDefault() {}, metaKey: false, ctrlKey: false, altKey: false };
  (listeners[type] || []).forEach(fn => fn(ev));
}
const content = () => getEl('#content').innerHTML;

/* ---- 断言工具 ---- */
let pass = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else fails.push(msg); }
function has(str, msg) { ok(content().includes(str), msg + '（页面未包含：' + str + '）'); }

/* ---- 加载应用（questions + app 同一作用域） ---- */
try {
  const qsrc = fs.readFileSync(path.join(REPO, 'questions.js'), 'utf8');
  const asrc = fs.readFileSync(path.join(REPO, 'app.js'), 'utf8');
  new Function(qsrc + '\n' + asrc)();
} catch (e) {
  console.error('LOAD_ERROR:', e.stack);
  process.exit(1);
}

if (mode === 'migrate') {
  const s = JSON.parse(store.get('shixian-progress-v2'));
  ok(s.records['1'] && s.records['1'].ok === false && s.records['1'].wronged === true, 'v1 迁移：错题保留');
  ok(s.records['2'] && s.records['2'].ok === true && s.records['2'].streak === 1, 'v1 迁移：对题 streak=1');
  ok(JSON.stringify(s.saved) === '[2]', 'v1 迁移：收藏保留');
  console.log(fails.length ? 'FAIL\n' + fails.join('\n') : `MIGRATE_OK pass=${pass}`);
  process.exit(fails.length ? 1 : 0);
}

/* ===== 初始：学习概览 ===== */
ok(getEl('#crumb').textContent === '学习概览', '面包屑为学习概览');
has('把容易错的，变成真正会的。', 'hero 文案');
has('各陷阱掌握度', '掌握度区块');
has('九大挖坑点', '陷阱网格区块');
has('稳定掌握 0 题', '初始掌握数');
has('36 题', '题库总数 36');

/* ===== 开始练习 ===== */
fire('click', { action: 'start' });
has('专项练习', '进入练习页');
has('QUESTION 01', '显示第 1 题');
has('A–D / 1–4', '键盘提示条');
has('确认答案', '未作答显示确认按钮');
ok(content().includes('disabled'), '未作答时确认按钮禁用');

/* 错答 q1（answer=1，选 0） */
fire('click', { option: 0 });
fire('click', { action: 'submit' });
has('再记住这个陷阱', '错误反馈标题');
has('命题陷阱', '解析区出现');
has('已收录错题本', '错题提示出现');
has('正确答案 B', '显示正确答案');

/* Enter → 下一题 */
fire('keydown', { key: 'Enter', target: new Element('body') });
has('QUESTION 02', 'Enter 前进到第 2 题');

/* 键盘选择：'1' → index0；提交（q2 answer=2 → 错） */
fire('keydown', { key: '1', target: new Element('body') });
fire('keydown', { key: 'Enter', target: new Element('body') });
has('再记住这个陷阱', '键盘提交生效（q2 错答）');

/* 方向键 */
fire('keydown', { key: 'ArrowLeft', target: new Element('body') });
has('QUESTION 01', '← 返回第 1 题');
fire('keydown', { key: 'ArrowRight', target: new Element('body') });
has('QUESTION 02', '→ 前进第 2 题');

/* q2 键盘答对（'3' → index2 = answer） */
fire('keydown', { key: '3', target: new Element('body') });
fire('keydown', { key: 'Enter', target: new Element('body') });
has('回答正确', 'q2 正确反馈');
has('答对 1 次 · 再连续答对 1 次即可移出错题本', 'q2 streak=1 提示');

/* 收藏 */
fire('click', { action: 'save' });
has('★ 已收藏', '收藏状态');

/* 筛选 */
fire('click', { filter: '张冠李戴' });
has('QUESTION 01', '筛选后从头开始');
has('/ 04', '张冠李戴共 4 题');
has('人民代表大会制度', '筛选到张冠李戴第 1 题');

/* ===== 错题回顾 ===== */
fire('click', { page: 'mistakes' });
has('错题回顾', '进入错题页');
has('/ 02', '错题本 2 题（q1 错；q2 曾错仅对 1 次）');

/* q1 答对一次 → streak1，仍在本 */
fire('click', { option: 1 });
fire('click', { action: 'submit' });
has('答对 1 次 · 再连续答对 1 次即可移出错题本', 'q1 streak=1 提示');
let recs = JSON.parse(store.get('shixian-progress-v2'));
ok(recs.records['1'].streak === 1 && recs.records['1'].ok === true, 'q1 记录 streak=1');
fire('click', { action: 'next' });
has('QUESTION 02', '前进到 q2');

/* q2 再答对 → streak2 → 移出；下一题走“移出后收缩视图”分支 */
fire('click', { option: 2 });
fire('click', { action: 'submit' });
has('已连续答对 2 次 · 移出错题本', 'q2 mastery 提示');
fire('click', { action: 'next' });
has('QUESTION 01', 'q2 移出后视图收缩，停在 q1');
has('/ 01', '错题本只剩 1 题');

/* q1 再答对 → streak2 → 全部移出 → 空态 */
fire('click', { option: 1 });
fire('click', { action: 'submit' });
has('已连续答对 2 次 · 移出错题本', 'q1 mastery 提示');
fire('click', { action: 'next' });
has('这里暂时没有错题', '错题清空后的空态');

recs = JSON.parse(store.get('shixian-progress-v2'));
ok(recs.records['1'].streak === 2 && recs.records['2'].streak === 2, '两题均 streak=2');

/* ===== 手册 ===== */
fire('click', { page: 'guide' });
has('避坑手册', '进入手册');
has('命题信号词', '手册含信号词');
has('拆解方法', '手册含拆解方法');
has('kaogong-shuati', '致谢开源题库');

/* ===== 概览统计 ===== */
fire('click', { page: 'home' });
has('学习进度', '回概览');
has('稳定掌握 2 题', '掌握数为 2');

/* ===== 主题 / 字号 ===== */
fire('click', { action: 'theme' });
ok(document.documentElement.dataset.theme === 'dark', '主题切到 dark');
fire('click', { action: 'theme' });
ok(document.documentElement.dataset.theme === 'light', '主题切回 light');
fire('click', { action: 'font' });
ok(document.documentElement.dataset.font === 'lg', '字号切到 lg');
const pf = JSON.parse(store.get('shixian-prefs-v1'));
ok(pf.theme === 'light' && pf.font === 'lg', '偏好持久化');

/* ===== 重置 ===== */
fire('click', { action: 'reset' });
const after = JSON.parse(store.get('shixian-progress-v2'));
ok(Object.keys(after.records).length === 0, '重置清空记录');
has('稳定掌握 0 题', '重置后掌握数归零');

console.log(fails.length ? `FAIL pass=${pass} fails=${fails.length}\n` + fails.join('\n') : `FLOW_OK pass=${pass}`);
process.exit(fails.length ? 1 : 0);
