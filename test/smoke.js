/* 识陷冒烟测试：Node DOM 桩，覆盖数据校验、答题流程、数字键盘、错题迁移和偏好。 */
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..');
const mode = process.argv[2] || 'flow';

function makeContext(migrate = false) {
  const store = new Map();
  const localStorage = {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  };
  if (migrate === 'v2') {
    store.set('shixian-progress-v2', JSON.stringify({
      records: { '1': { ok: false, wronged: true, streak: 0 }, '2': { ok: true, wronged: false, streak: 2 } },
      saved: [2]
    }));
  } else if (migrate) {
    store.set('shixian-progress-v1', JSON.stringify({
      records: { '1': { correct: false }, '2': { correct: true } },
      saved: [2]
    }));
  }
  class Element {
    constructor(selector = '') {
      this.selector = selector;
      this.innerHTML = '';
      this.textContent = '';
      this.dataset = {};
      this.attributes = {};
      this.className = '';
      this.value = '';
      this.disabled = false;
      this.hidden = false;
      this.tagName = 'DIV';
      this.isContentEditable = false;
      this.focus = () => {};
      this.classList = {
        values: new Set(),
        toggle: (name, force) => {
          const shouldAdd = force === undefined ? !this.classList.values.has(name) : !!force;
          if (shouldAdd) this.classList.values.add(name); else this.classList.values.delete(name);
          return shouldAdd;
        },
        add: name => this.classList.values.add(name),
        remove: name => this.classList.values.delete(name),
        contains: name => this.classList.values.has(name)
      };
    }
    setAttribute(key, value) { this.attributes[key] = String(value); this[key] = String(value); }
    removeAttribute(key) { delete this.attributes[key]; delete this[key]; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    closest() { return null; }
    querySelector() { return null; }
    matches() { return false; }
  }
  const elementCache = new Map();
  const getElement = selector => {
    if (!elementCache.has(selector)) elementCache.set(selector, new Element(selector));
    return elementCache.get(selector);
  };
  const listeners = {};
  const navItems = ['home', 'practice', 'mistakes', 'guide'].map(page => {
    const element = new Element(`nav-${page}`);
    element.dataset.page = page;
    return element;
  });
  const document = {
    documentElement: Object.assign(new Element('html'), { dataset: {} }),
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
    querySelector: getElement,
    querySelectorAll(selector) { return selector === '.nav-item' ? navItems : []; }
  };
  const media = { matches: false, addEventListener() {} };
  const window = {
    matchMedia: () => media,
    addEventListener() {},
    scrollTo() {},
    confirm: () => true,
    setInterval: () => 1,
    clearInterval() {}
  };
  const location = { protocol: 'file:' };
  const navigator = { onLine: true };
  function defineGlobal(name, value) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  defineGlobal('Element', Element);
  defineGlobal('document', document);
  defineGlobal('window', window);
  defineGlobal('location', location);
  defineGlobal('navigator', navigator);
  defineGlobal('localStorage', localStorage);
  defineGlobal('confirm', window.confirm);

  function fire(type, spec = {}) {
    const target = new Element('event-target');
    target.tagName = spec.tagName || 'DIV';
    target.dataset = spec.dataset || (spec.numberInput ? { numberInput: 'true' } : {});
    target.value = spec.value || '';
    target.closest = selector => {
      if (spec.page && selector === '[data-page]') return { dataset: { page: spec.page } };
      if (spec.filter !== undefined && selector === '[data-filter]') return { dataset: { filter: spec.filter } };
      if (spec.option !== undefined && selector === '[data-option]') return { dataset: { option: String(spec.option) } };
      if (spec.action && selector === '[data-action]') return { dataset: { action: spec.action, quality: spec.quality == null ? undefined : String(spec.quality), digit: spec.digit } };
      if (spec.mode && selector === '[data-mode]') return { dataset: { mode: spec.mode } };
      if (spec.material && selector === '[data-material]') return { dataset: { material: spec.material } };
      if (spec.digit !== undefined && selector === '[data-digit]') return { dataset: { digit: String(spec.digit) } };
      if (spec.numberInput && selector === '[data-number-input]') return target;
      if (selector === '[data-question-card]' && spec.questionCard) return target;
      return null;
    };
    const event = {
      type,
      target,
      key: spec.key,
      value: spec.value,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault() { this.defaultPrevented = true; },
      touches: spec.touches,
      changedTouches: spec.changedTouches
    };
    for (const handler of listeners[type] || []) handler(event);
    return event;
  }
  const getContent = () => getElement('#content').innerHTML;
  const scripts = [
    'data/questions.js', 'data/questions-extra.js', 'data/questions-mix.js',
    'data/recite.js', 'data/traps.js', 'data/timeline.js', 'app.js'
  ].map(file => fs.readFileSync(path.join(REPO, file), 'utf8')).join('\n');
  const app = new Function(scripts + `
    return {
      questions,
      trapData,
      reciteData: RECITE,
      timelineData: TIMELINE,
      numberPairs: NUMBER_PAIRS,
      startMode,
      stopExamTimer,
      getState: () => state,
      getView: () => view,
      getIndex: () => index,
      getMode: () => mode,
      getPage: () => page,
      showQuestionById: id => {
        page = 'practice'; mode = 'all'; filter = '全部'; sessionIds = null;
        resetQuestion(); rebuildView(); index = view.findIndex(q => q.id === id); render();
      }
    };
  `)();
  return { app, store, listeners, fire, getContent, getElement, document, window, localStorage };
}

let pass = 0;
const failures = [];
function assert(condition, label) { if (condition) pass++; else failures.push(label); }
function contains(ctx, text, label) { assert(ctx.getContent().includes(text), `${label}（缺少：${text}）`); }

if (mode === 'migrate') {
  const ctx = makeContext(true);
  const migrated = JSON.parse(ctx.store.get('shixian-progress-v3'));
  assert(migrated.records['1'] && migrated.records['1'].ok === false && migrated.records['1'].wronged === true, 'v1 迁移：错题保留');
  assert(migrated.records['2'] && migrated.records['2'].ok === true && migrated.records['2'].streak === 1, 'v1 迁移：正确记录保留');
  assert(JSON.stringify(migrated.saved) === '[2]', 'v1 迁移：收藏保留');
  assert(ctx.getContent().includes('稳定掌握'), '迁移后首页正常渲染');
  const v2ctx = makeContext('v2');
  const migratedV2 = JSON.parse(v2ctx.store.get('shixian-progress-v3'));
  assert(migratedV2.records['1'].ok === false && migratedV2.records['1'].wronged === true, 'v2 迁移：错题与 wronged 状态保留');
  assert(migratedV2.records['2'].ok === true && migratedV2.records['2'].streak === 2, 'v2 迁移：掌握度 streak 保留');
  assert(JSON.stringify(migratedV2.saved) === '[2]', 'v2 迁移：收藏保留');
  console.log(failures.length ? `FAIL\n${failures.join('\n')}` : `MIGRATE_OK pass=${pass}`);
  process.exit(failures.length ? 1 : 0);
}

const ctx = makeContext(false);
const { app } = ctx;

/* 题库结构、题型和答案分布 */
assert(app.questions.length === 141, '题库包含 141 题');
const ids = app.questions.map(q => q.id);
assert(new Set(ids).size === ids.length, '题目 ID 唯一');
assert(app.trapData.length === 9, '九类陷阱元数据齐全');
assert(app.questions.every(q => app.trapData.some(trap => trap.name === q.tag)), '所有题目均对应九类陷阱之一');
assert(new Set(app.questions.map(q => q.topic)).size >= 8, '题目覆盖至少八个知识主题');
assert(app.questions.every(q => {
  const complete = q.q && q.tag && q.topic && q.level && q.trap && q.explain && q.tip;
  if (!complete) return false;
  if (q.type === 'number') return /^\d+$/.test(q.answer);
  if (q.type === 'combo' && (!Array.isArray(q.items) || q.items.length < 2)) return false;
  return Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length;
}), '所有题目字段及答案有效');
const types = app.questions.reduce((result, q) => { const type = q.type || 'single'; result[type] = (result[type] || 0) + 1; return result; }, {});
assert(types.single === 101 && types.combo === 10 && types.judge === 18 && types.number === 12, '四种题型数量正确');
const distribution = [0, 0, 0, 0];
app.questions.filter(q => q.type !== 'judge' && q.type !== 'number').forEach(q => distribution[q.answer]++);
assert(Math.max(...distribution) - Math.min(...distribution) <= 10, `选择题答案位置均衡：${distribution.join('/')}`);
assert(app.reciteData.reduce((sum, group) => sum + group.cards.length, 0) === 75, '背诵卡共 75 张');
assert(app.timelineData.length >= 20, '时间线数据齐全');

/* 首页与功能导航 */
contains(ctx, '把容易错的选项，练到一眼识破。', '首页标题');
contains(ctx, '近 7 天练习', '首页学习趋势');
contains(ctx, '九类陷阱掌握度', '首页掌握度');
contains(ctx, '141 题', '首页题库总数');
const htmlSource = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
assert(htmlSource.includes('class="bottom-nav"'), '移动端底部导航存在');
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'manifest.webmanifest'), 'utf8'));
assert(manifest.start_url === './' && manifest.scope === './', 'PWA 清单使用相对路径');
const scriptPaths = [...htmlSource.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
assert(scriptPaths.length === 7 && scriptPaths.every(file => fs.existsSync(path.join(REPO, file))), '所有本地脚本路径存在');
const swSource = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
assert(swSource.includes("'shixian-v3'") && swSource.includes("'./data/recite.js'"), 'Service Worker 版本与新数据缓存已更新');

/* 普通单选：答错进入错题，确认即时反馈和本地记录 */
const single = app.questions.find(q => !q.type || q.type === 'single');
app.showQuestionById(single.id);
contains(ctx, '数字快捷选项', '屏幕数字快捷选择存在');
contains(ctx, '确认答案', '确认按钮存在');
const wrongChoice = (single.answer + 1) % single.options.length;
ctx.fire('click', { option: wrongChoice });
ctx.fire('click', { action: 'submit' });
contains(ctx, '回答错误', '错答即时反馈');
contains(ctx, '已加入错题', '错题进入复习队列');
const firstWrongRecord = app.getState().records[String(single.id)];
assert(!!firstWrongRecord && firstWrongRecord.wronged, '错答本地记录写入');
assert(firstWrongRecord.attempts === 1 && firstWrongRecord.correctCount === 0 && firstWrongRecord.wrongCount === 1, '新错题统计不虚增正确次数');

/* 键盘选择和提交与点击保持一致 */
const keyboardQuestion = app.questions.find(q => (!q.type || q.type === 'single') && q.id !== single.id);
app.showQuestionById(keyboardQuestion.id);
ctx.fire('keydown', { key: String(keyboardQuestion.answer + 1) });
contains(ctx, 'aria-pressed="true"', '数字快捷键选择选项');
ctx.fire('keydown', { key: 'Enter', tagName: 'BUTTON', dataset: { option: String(keyboardQuestion.answer) } });
contains(ctx, '回答正确', 'Enter 键即时提交选项');
app.showQuestionById(single.id);
const beforeSwipe = app.getIndex();
ctx.fire('touchstart', { questionCard: true, touches: [{ clientX: 180, clientY: 140 }] });
ctx.fire('touchend', { changedTouches: [{ clientX: 90, clientY: 143 }] });
assert(app.getIndex() === (beforeSwipe + 1) % app.getView().length, '左右滑动切换到后一题');

/* 组合选择题与判断题 */
const combo = app.questions.find(q => q.type === 'combo');
app.showQuestionById(combo.id);
contains(ctx, 'combo-items', '组合题渲染题干表述');
ctx.fire('click', { option: combo.answer });
ctx.fire('click', { action: 'submit' });
contains(ctx, '回答正确', '组合题可作答与反馈');
const judge = app.questions.find(q => q.type === 'judge');
app.showQuestionById(judge.id);
contains(ctx, '正确', '判断题选项渲染');
assert((ctx.getContent().match(/data-option=/g) || []).length >= 2, '判断题有两个可选答案');

/* 数字填空：屏幕数字键盘、退格/清空和即时判定 */
const numeric = app.questions.find(q => q.type === 'number');
app.showQuestionById(numeric.id);
contains(ctx, 'aria-label="数字键盘"', '数字填空显示屏幕键盘');
contains(ctx, '0</kbd>–<kbd>9', '数字键盘对应输入说明');
contains(ctx, 'data-digit="0"', '数字键盘含零键');
contains(ctx, 'inputmode="none"', '数字题避免弹出系统键盘，优先屏幕按键');
for (const digit of String(numeric.answer)) ctx.fire('click', { digit });
contains(ctx, `value="${numeric.answer}"`, '数字按键将数字输入框填满');
ctx.fire('click', { action: 'backspace-number' });
contains(ctx, `value="${String(numeric.answer).slice(0, -1)}"`, '退格按键删除末位');
ctx.fire('click', { action: 'clear-number' });
contains(ctx, 'value=""', '清空按键清除输入');
for (const digit of String(numeric.answer)) ctx.fire('click', { digit });
ctx.fire('click', { action: 'submit' });
contains(ctx, '回答正确', '数字输入即时判定');
const numberRecord = app.getState().records[String(numeric.id)];
assert(numberRecord.attempts === 1 && numberRecord.correctCount === 1 && numberRecord.streak === 1, '首次正确作答统计准确');
ctx.fire('click', { action: 'rate', quality: 2 });
assert(numberRecord.lastRating === 2 && numberRecord.intervalDays === 0, '自评还不稳会缩短复习间隔');
const typedNumber = app.questions.find(q => q.type === 'number' && q.id !== numeric.id);
app.showQuestionById(typedNumber.id);
ctx.fire('input', { numberInput: true, tagName: 'INPUT', value: typedNumber.answer });
ctx.fire('keydown', { numberInput: true, tagName: 'INPUT', value: typedNumber.answer, key: 'Enter' });
contains(ctx, '回答正确', '直接输入后可用 Enter 立即提交');

/* 数字题型入口与每日队列 */
ctx.fire('click', { mode: 'numbers' });
contains(ctx, '数字填空', '数字填空专项入口');
assert(app.getMode() === 'numbers' && app.getView().length === 12, '数字专项收录 12 题');
ctx.fire('click', { mode: 'daily' });
contains(ctx, '每日练习', '每日练习入口');
assert(app.getMode() === 'daily' && app.getView().length === 10, '每日练习组出 10 题');

/* 间隔复习：错题连续答对两次后移出错题本 */
ctx.fire('click', { page: 'mistakes' });
assert(app.getMode() === 'wrong', '错题页筛选错题');
const filterTag = app.getView().find(q => q.id === single.id).tag;
ctx.fire('click', { filter: filterTag });
assert(app.getMode() === 'wrong' && app.getView().every(q => q.tag === filterTag), '错题筛选保留错题模式');
/* 返回全部错题后，检查目标题和移出流程。 */
ctx.fire('click', { page: 'mistakes' });
const reviewQuestion = app.getView().find(q => q.id === single.id);
assert(!!reviewQuestion, '错题出现在错题练习列表');
for (let round = 1; round <= 2; round++) {
  const current = app.getView()[0];
  ctx.fire('click', { option: current.answer });
  ctx.fire('click', { action: 'submit' });
  contains(ctx, '回答正确', `错题第 ${round} 次复习答对`);
  if (round === 1) contains(ctx, '答对 1 次', '首次答对仍留在错题本');
  ctx.fire('click', { action: 'next' });
}
assert(!app.getState().records[String(single.id)].wronged || app.getState().records[String(single.id)].streak >= 2, '连续答对两次后标记掌握');

/* 收藏、背诵卡和时间线 */
app.showQuestionById(combo.id);
ctx.fire('click', { action: 'save' });
assert(app.getState().saved.includes(combo.id), '题目可收藏');
ctx.fire('click', { page: 'guide' });
ctx.fire('click', { material: 'cards' });
contains(ctx, '选择分类', '背诵卡分类选择');
contains(ctx, '显示答案', '背诵卡主动回忆流程');
ctx.fire('click', { action: 'card-flip' });
  contains(ctx, '实践是认识的来源', '背诵卡显示内容');
ctx.fire('click', { action: 'card-known' });
assert(Object.keys(app.getState().cardProgress).length === 1, '背诵卡记忆状态保存');
ctx.fire('click', { material: 'timeline' });
contains(ctx, '会议与关键事件', '数字时间线可打开');
contains(ctx, '建党百年', '时间线含数字配对');
ctx.fire('click', { material: 'traps' });
contains(ctx, '常见信号词', '避坑手册含信号词');
contains(ctx, '拆解方法', '避坑手册含拆解方法');
contains(ctx, 'kaogong-shuati', '资料页列出开源设计参考');

/* 深浅色、字号与重置 */
ctx.fire('click', { action: 'theme' });
assert(ctx.document.documentElement.dataset.theme === 'dark', '可切换深色主题');
ctx.fire('click', { action: 'theme' });
assert(ctx.document.documentElement.dataset.theme === 'light', '可切回浅色主题');
ctx.fire('click', { action: 'font' });
assert(ctx.document.documentElement.dataset.font === 'lg', '字号可以放大');
const prefs = JSON.parse(ctx.store.get('shixian-prefs-v1'));
assert(prefs.font === 'lg' && prefs.theme === 'light', '主题与字号偏好持久化');
ctx.fire('click', { page: 'home' });
ctx.fire('click', { action: 'reset' });
assert(Object.keys(app.getState().records).length === 0 && app.getState().saved.length === 0, '重置清空学习记录与收藏');
contains(ctx, '稳定掌握', '重置后首页正常显示');

/* 限时测验：题目暂不即时公布答案，交卷后统计结果 */
ctx.fire('click', { mode: 'mock' });
assert(app.getMode() === 'mock' && app.getView().length === 20, '限时测验组出 20 题');
const mockFirst = app.getView()[0];
ctx.fire('click', { option: mockFirst.answer });
assert(!ctx.getContent().includes('class="feedback'), '测验过程不显示即时解析');
ctx.fire('click', { action: 'finish-exam' });
contains(ctx, '1 / 20', '测验正确题数统计正确');
contains(ctx, '逐题结果', '交卷后显示逐题结果');
assert(app.getPage() === 'results', '交卷后进入测验结果页');
app.stopExamTimer();

console.log(failures.length ? `FAIL pass=${pass} fails=${failures.length}\n${failures.join('\n')}` : `FLOW_OK pass=${pass}`);
process.exit(failures.length ? 1 : 0);
