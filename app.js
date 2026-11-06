/* 识陷 · 公考政治理论挖坑点训练 —— 应用逻辑（无依赖，可离线运行） */
'use strict';

/* ============ 基础引用 ============ */
const $ = s => document.querySelector(s);
const content = $('#content');

/* ============ 状态与持久化 ============
 * 学习记录 KEY v2：{records:{id:{ok,wronged,streak}}, saved:[id]}
 *   ok      最近一次作答是否正确
 *   wronged 是否曾经答错（决定是否进入错题本语境）
 *   streak  当前连续答对次数（连续 2 次 → 稳定掌握、移出错题本）
 * 迁移自 v1 {correct}，旧记录自动转换。
 */
const KEY = 'shixian-progress-v2';
const OLD_KEY = 'shixian-progress-v1';
const PREF_KEY = 'shixian-prefs-v1';

let state = { records: {}, saved: [] };

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') {
      state.records = s.records || {};
      state.saved = Array.isArray(s.saved) ? s.saved : [];
      return;
    }
    const o = JSON.parse(localStorage.getItem(OLD_KEY));
    if (o && typeof o === 'object') {
      for (const [id, r] of Object.entries(o.records || {})) {
        const ok = !!(r && r.correct);
        state.records[id] = { ok, wronged: !ok, streak: ok ? 1 : 0 };
      }
      state.saved = Array.isArray(o.saved) ? o.saved : [];
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch (e) { /* 隐私模式等场景忽略 */ }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

/* 界面偏好：theme light|dark（空=跟随系统），font std|lg */
let prefs = { theme: '', font: '' };
try {
  const p = JSON.parse(localStorage.getItem(PREF_KEY));
  if (p && typeof p === 'object') prefs = { ...prefs, ...p };
} catch (e) {}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} }

const mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };
function applyPrefs() {
  const dark = prefs.theme ? prefs.theme === 'dark' : !!mqDark.matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.font = prefs.font || 'std';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#131814' : '#f7f7f3';
  const tb = $('#themeBtn');
  if (tb) { tb.textContent = dark ? '☀' : '☾'; tb.title = dark ? '切换到浅色' : '切换到深色'; tb.setAttribute('aria-label', tb.title); }
  const fb = $('#fontBtn');
  if (fb) { const lg = prefs.font === 'lg'; fb.textContent = lg ? 'A＋' : 'A'; fb.title = lg ? '字号：大（点击恢复标准）' : '字号：标准（点击放大）'; fb.setAttribute('aria-label', fb.title); }
}

/* ============ 九大挖坑点元数据（手册数据源） ============ */
const TRAPS = [
  ['01', '绝对化表述', '“一定、任何、完全、唯一、只要……就、必然”', '回到原理找适用条件与例外，警惕把有条件判断说成无条件。'],
  ['02', '概念偷换', '相近名词互换：“根本/基本”“制度/机关”“国体/政体”', '圈出核心概念，分别复述定义，再逐字比对选项。'],
  ['03', '主次颠倒', '“首要、核心、首位、决定、根本性”安错了对象', '先画箭头（谁决定谁），再问比较的是“矛盾之间”还是“矛盾双方”。'],
  ['04', '范围扩大', '“所有、全部、任何环节”，或悄悄删掉限定条件', '对照题干与原文，核对时间、范围、条件等限定词是否保留。'],
  ['05', '主体错位', '长选项里主语频繁切换，机关、人物、党派换着出现', '拆出每句主语，核对“谁 — 做什么 — 对谁负责”。'],
  ['06', '以偏概全', '“只要……就”“意味着放弃……”“只关注……”', '检查选项是否把局部推成全部、把并存推成互斥。'],
  ['07', '因果倒置', '“决定 / 反作用 / 导致 / 源于”的方向被调换', '用“谁决定谁”重述一遍，再核对教材里的箭头方向。'],
  ['08', '张冠李戴', '会议、文件、人物、机关与论断混搭配对', '建立“会议—成果”“机关—性质”配对表，逐项打勾。'],
  ['09', '数字与时间', '“首次、第一次、届次、年份、2035、本世纪中叶”', '把时间点与目标词配对记忆，错位即排除。']
];

/* ============ 记录查询 ============ */
function rec(id) { return state.records[id]; }
/* 错题本归属：最近一次答错，或曾经答错但尚未连续答对 2 次 */
function inBook(id) {
  const r = state.records[id];
  if (!r) return false;
  if (!r.ok) return true;
  return !!r.wronged && (r.streak || 0) < 2;
}
function stats() {
  let done = 0, correct = 0, stuck = 0, mastered = 0;
  for (const q of questions) {
    const r = state.records[q.id];
    if (!r) continue;
    done++;
    if (r.ok) correct++;
    if (r.streak >= 2) mastered++;
    if (inBook(q.id)) stuck++;
  }
  return { done, correct, stuck, mastered };
}
function tagAgg(tag) {
  let n = 0, attempted = 0, mastered = 0, stuck = 0;
  for (const q of questions) {
    if (q.tag !== tag) continue;
    n++;
    const r = state.records[q.id];
    if (r) { attempted++; if (r.streak >= 2) mastered++; if (inBook(q.id)) stuck++; }
  }
  return { n, attempted, mastered, stuck };
}

/* ============ 视图状态 ============ */
let page = 'home';
let mode = 'all';          // all | wrong
let filter = '全部';
let view = [];             // 当前列表（按 filter/mode 缓存）
let index = 0;
let selection = null;
let revealed = false;
let holdId = null;         // 展示中的题目（即使已移出错题本）

function rebuild() {
  view = questions.filter(q =>
    (filter === '全部' || q.tag === filter) &&
    (mode !== 'wrong' || inBook(q.id) || (revealed && q.id === holdId))
  );
}
function goto(p) {
  page = p;
  if (p === 'practice') { mode = 'all'; resetQ(); }
  if (p === 'mistakes') { mode = 'wrong'; resetQ(); }
  render();
  window.scrollTo(0, 0);
}
function resetQ() { filter = '全部'; index = 0; selection = null; revealed = false; holdId = null; rebuild(); }

/* ============ 渲染：公共片段 ============ */
function heading(kicker, title, desc) {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div></div>`;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ============ 渲染：学习概览 ============ */
function renderHome() {
  const s = stats();
  const pct = Math.round(s.done / questions.length * 100);
  const acc = s.done ? Math.round(s.correct / s.done * 100) : 0;

  const masteryRows = TRAPS.map(t => {
    const a = tagAgg(t[1]);
    const attPct = a.n ? Math.round(a.attempted / a.n * 100) : 0;
    const masPct = a.n ? Math.round(a.mastered / a.n * 100) : 0;
    return `<button class="mrow" data-filter="${t[1]}" title="进入「${t[1]}」专项练习">
      <span class="mrow-name"><b>${t[0]}</b> ${t[1]}<small>${a.stuck ? a.stuck + ' 题待攻克' : a.attempted ? '暂无错题' : '未开始'}</small></span>
      <span class="mbar" aria-hidden="true"><i class="att" style="width:${attPct}%"></i><i class="mas" style="width:${masPct}%"></i></span>
      <span class="mrow-num">${a.mastered}<small>/${a.n}</small></span>
    </button>`;
  }).join('');

  const trapCards = TRAPS.map(t => {
    const a = tagAgg(t[1]);
    return `<button class="trap-card" data-filter="${t[1]}">
      <div class="trap-top"><span>${t[0]} / TRAP</span><b>↗</b></div>
      <h3>${t[1]}</h3><p>${t[2]}</p>
      <div class="trap-bottom">${a.n} 题${a.stuck ? ` · <em>${a.stuck} 题待攻克</em>` : ''} <span>→</span></div>
    </button>`;
  }).join('');

  return `${heading('YOUR LEARNING DASHBOARD', '把容易错的，变成真正会的。', '不靠死记答案，练习识别政治理论题中的九大常见挖坑点。')}
  <section class="hero"><div class="hero-copy">
    <div class="hero-label"><span>✳</span> 今日学习建议</div>
    <h2>每一道陷阱，<br>都是一次<span>思维训练。</span></h2>
    <p>从一个小专题开始，读懂选项为什么错。<br>循序渐进，建立更稳固的判断力。</p>
    <button class="primary" data-action="start">开始专项练习 <span>↗</span></button>
    <div class="hero-note">约 5 分钟 &nbsp; · &nbsp; 即时解析 &nbsp; · &nbsp; 无需联网</div>
  </div><div class="hero-art" aria-hidden="true">
    <div class="art-ring ring-one"></div><div class="art-ring ring-two"></div>
    <div class="art-card back-card"><span>NOTE / 02</span><div></div><div></div><div></div></div>
    <div class="art-card front-card"><div class="art-head"><span>思维笔记</span><b>✳</b></div>
      <div class="art-title">看清<br>文字背后的<br><em>陷阱。</em></div><div class="art-line"></div>
      <div class="art-foot">THINK CLEARLY <span>↗</span></div></div>
    <div class="art-badge">✦</div>
  </div></section>

  <div class="section-head"><div><div class="eyebrow">YOUR PROGRESS</div><h2>学习进度 <small>每一点积累都算数</small></h2></div>
    <span class="subtle">保存在当前浏览器 · <button class="text-link" data-action="reset">重置进度</button></span></div>
  <section class="stats">
    <div class="stat"><div class="stat-top">已练习 <span>↗</span></div>
      <div class="stat-value">${s.done}<small> / ${questions.length} 题</small></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="stat-caption">已完成 ${pct}% 的题库</div></div>
    <div class="stat"><div class="stat-top">当前正确率 <span>◎</span></div>
      <div class="stat-value">${s.done ? acc : '—'}<small>${s.done ? '%' : ''}</small></div>
      <div class="stat-caption">按每题最近一次作答统计</div></div>
    <div class="stat"><div class="stat-top">待攻克错题 <span>↻</span></div>
      <div class="stat-value">${s.stuck}<small> 题</small></div>
      <button class="text-link" data-page="mistakes">去复习 <span>→</span></button></div>
  </section>

  <div class="section-head lower"><div><div class="eyebrow">TRAP MASTERY</div><h2>各陷阱掌握度 <small>连续答对 2 次记为稳定掌握</small></h2></div>
    <span class="subtle">稳定掌握 ${s.mastered} 题</span></div>
  <section class="mastery">${masteryRows}</section>

  <div class="section-head lower"><div><div class="eyebrow">EXPLORE BY TRAP</div><h2>九大挖坑点 <small>先识别套路，再拆解选项</small></h2></div>
    <button class="text-link" data-page="guide">查看避坑手册 <span>→</span></button></div>
  <section class="trap-grid">${trapCards}</section>

  <div class="source-note">✳ &nbsp;题目与解析均为原创编写，按九大挖坑点归类训练；分类与功能设计参考了
    <a href="https://github.com/ERRRC/xingcezhenti" target="_blank" rel="noopener noreferrer">ERRRC/xingcezhenti</a> 等
    GitHub 开源题库项目，未复制其题目内容，不冒充真题。理论表述请以权威原文和考试公告为准。</div>`;
}

/* ============ 渲染：练习 / 错题回顾 ============ */
const ASIDES = [
  ['先找题干的限定词', '再判断选项的逻辑关系。'],
  ['遇到绝对化的表述', '放慢一点，想想是否存在例外。'],
  ['拿不准的时候', '先排除明显张冠李戴的选项。'],
  ['答错并不可怕', '把陷阱名称读出声，比记住答案更有用。']
];

function masteryNote(q) {
  const r = rec(q.id);
  if (!r) return '';
  if (!r.ok) return '已收录错题本 · 连续答对 2 次自动移出';
  if (r.streak >= 2) return r.wronged ? '已连续答对 2 次 · 移出错题本' : '已连续答对 2 次 · 稳定掌握';
  if (r.wronged) return '答对 1 次 · 再连续答对 1 次即可移出错题本';
  return '首答正确 · 连续答对 2 次标记为稳定掌握';
}

function renderPractice() {
  const wrongMode = mode === 'wrong';
  if (index >= view.length) index = 0;
  const q = view[index];
  const filters = ['全部', ...TRAPS.map(t => t[1])];

  const head = heading(
    wrongMode ? 'REVIEW YOUR MISTAKES' : 'PRACTICE WITH PURPOSE',
    wrongMode ? '错题回顾' : '专项练习',
    wrongMode ? '重新思考做错的题目；连续答对 2 次自动移出错题本。' : '每次只专注一道题，先独立判断，再查看解析。'
  );
  const chips = `<div class="filters" aria-label="按陷阱类型筛选">${filters.map(f =>
    `<button class="chip ${filter === f ? 'selected' : ''}" data-filter="${f}">${f}</button>`).join('')}</div>`;

  if (!q) {
    return head + chips + `<div class="empty"><div>✳</div>
      <h2>${wrongMode ? '这里暂时没有错题' : '这个分类暂无题目'}</h2>
      <p>${wrongMode ? '继续练习，做错的题目会自动收录在这里。' : '试试其他分类。'}</p>
      <button class="primary" data-action="start">开始练习 →</button></div>`;
  }

  const r = rec(q.id);
  const stateBadge = !r ? '' : inBook(q.id) ? '<span class="mq-state bad">↻ 待攻克</span>'
    : r.streak >= 2 ? '<span class="mq-state good">✔ 稳定掌握</span>' : '<span class="mq-state">已练习</span>';
  const savedOn = state.saved.includes(q.id);

  const options = q.options.map((o, i) => {
    let cls = 'option';
    if (selection === i) cls += ' chosen';
    if (revealed && i === q.answer) cls += ' correct';
    if (revealed && selection === i && i !== q.answer) cls += ' incorrect';
    const mark = revealed && i === q.answer ? '<b>✓</b>' : revealed && selection === i ? '<b>×</b>' : '';
    return `<button class="${cls}" data-option="${i}" ${revealed ? 'disabled' : ''}>
      <span class="option-letter">${'ABCD'[i]}</span><span>${esc(o)}</span>${mark}</button>`;
  }).join('');

  const explanation = revealed ? `<div class="explanation">
      <div class="explain-title">${selection === q.answer ? '✳ 回答正确' : '↗ 再记住这个陷阱'} <span>正确答案 ${'ABCD'[q.answer]}</span></div>
      <p><strong>命题陷阱：</strong>${esc(q.trap)}</p>
      <p><strong>解析：</strong>${esc(q.explain)}</p>
      <div class="tip">💡 解题提示：${esc(q.tip)}</div>
      <div class="mastery-note">↻ ${masteryNote(q)}</div>
    </div>
    <div class="question-actions">
      <button class="secondary" data-action="prev">← 上一题</button>
      <button class="primary" data-action="next">${index === view.length - 1 ? '回到第一题' : '下一题'} →</button>
    </div>`
    : `<div class="question-actions">
      <button class="secondary" data-action="prev">← 上一题</button>
      <button class="primary" data-action="submit" ${selection === null ? 'disabled' : ''}>确认答案 →</button>
    </div>
    <div class="kb-hint" aria-hidden="true"><b>A–D / 1–4</b> 选择 · <b>Enter</b> 确认 · <b>← →</b> 切题 · <b>S</b> 收藏</div>`;

  const aside = ASIDES[index % ASIDES.length];
  const asideBox = `<aside class="practice-aside"><div class="aside-icon">✳</div><h3>答题小提醒</h3>
    <p>${aside[0]}，${aside[1]}</p><div class="aside-line"></div>
    <p>遇到想不起来的题，先回忆它属于哪一类挖坑点。</p>
    <div class="aside-index">${String(index + 1).padStart(2, '0')} <span>/ ${String(view.length).padStart(2, '0')}</span></div></aside>`;

  return head + chips + `<div class="practice-layout"><section class="question-card">
    <div class="question-meta"><span class="tag">${q.tag}</span><span>${q.topic} &nbsp; / &nbsp; ${q.level}</span>${stateBadge}
      <button class="save-btn ${savedOn ? 'is-saved' : ''}" data-action="save" aria-label="${savedOn ? '取消收藏' : '收藏本题'}">${savedOn ? '★ 已收藏' : '☆ 收藏'}</button></div>
    <div class="question-counter">QUESTION ${String(index + 1).padStart(2, '0')} <span>/ ${String(view.length).padStart(2, '0')}</span></div>
    <h2 class="question-title">${esc(q.q)}</h2>
    <div class="options">${options}</div>
    ${explanation}
  </section>${asideBox}</div>`;
}

/* ============ 渲染：避坑手册 ============ */
function renderGuide() {
  const cards = TRAPS.map(t => `<article class="guide-card">
    <div class="guide-number">${t[0]} <span>TRAP TYPE</span></div>
    <h2>${t[1]}</h2>
    <p><b class="g-label">命题信号词</b><br>${t[2]}</p>
    <div class="guide-tip"><b>拆解方法</b><br>${t[3]}</div>
    <button class="text-link" data-filter="${t[1]}">练习此类题目 →</button>
  </article>`).join('');

  return `${heading('A LITTLE FIELD GUIDE', '避坑手册', '九类挖坑点的识别信号与拆解方法，给每一次判断多一道防线。')}
  <div class="guide-grid">${cards}</div>
  <div class="source-note">本应用全部题目与解析为原创编写，依据通行教材与权威公开表述整理，非真题。
    分类体系与功能设计参考开源项目：
    <a href="https://github.com/ERRRC/xingcezhenti" target="_blank" rel="noopener noreferrer">ERRRC/xingcezhenti</a>（真题分类组织）、
    <a href="https://github.com/ERRRC/kaogong-shuati" target="_blank" rel="noopener noreferrer">ERRRC/kaogong-shuati</a>（MIT · 模块化刷题与错题本设计）、
    <a href="https://github.com/jangviktor-web/GongkaoNaoku" target="_blank" rel="noopener noreferrer">jangviktor-web/GongkaoNaoku</a>（Apache-2.0 · 间隔重复与本地优先）、
    <a href="https://github.com/TaiMaBenJi/knowledge-commons" target="_blank" rel="noopener noreferrer">TaiMaBenJi/knowledge-commons</a>（MIT · 完全离线学习站）。
    未复制上述仓库的题目内容；理论表述请结合权威原文核对。</div>`;
}

/* ============ 总渲染 ============ */
const CRUMBS = { home: '学习概览', practice: '专项练习', mistakes: '错题回顾', guide: '避坑手册' };
function render() {
  const s = stats();
  const badge = $('#navMistakes');
  if (badge) badge.textContent = s.stuck;
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const crumb = $('#crumb');
  if (crumb) crumb.textContent = CRUMBS[page] || '';
  content.innerHTML = page === 'home' ? renderHome() : page === 'guide' ? renderGuide() : renderPractice();
}

/* ============ 行为 ============ */
function submit() {
  if (selection === null || revealed) return;
  const q = view[index];
  if (!q) return;
  holdId = q.id;
  revealed = true;
  const ok = selection === q.answer;
  const r = state.records[q.id] || { ok: true, wronged: false, streak: 0 };
  r.ok = ok;
  if (ok) r.streak = (r.streak || 0) + 1;
  else { r.streak = 0; r.wronged = true; }
  state.records[q.id] = r;
  save();
  rebuild(); // 错题本成员变化时保持当前题可见
}
function step(dir) {
  const wasRemoved = mode === 'wrong' && revealed && holdId != null && !inBook(holdId);
  revealed = false;
  holdId = null;
  selection = null;
  rebuild();
  if (view.length) {
    if (wasRemoved) index = Math.min(index, view.length - 1);
    else index = (index + dir + view.length) % view.length;
  } else index = 0;
}
function toggleSave(id) {
  state.saved = state.saved.includes(id) ? state.saved.filter(x => x !== id) : [...state.saved, id];
  save();
}

/* ============ 事件：点击 ============ */
document.addEventListener('click', e => {
  const p = e.target.closest('[data-page]');
  if (p) { goto(p.dataset.page); return; }

  const f = e.target.closest('[data-filter]');
  if (f) {
    if (page !== 'practice' && page !== 'mistakes') { page = 'practice'; mode = 'all'; }
    filter = f.dataset.filter;
    index = 0; selection = null; revealed = false; holdId = null;
    rebuild();
    if (page === 'home' || page === 'guide') { page = 'practice'; }
    render();
    window.scrollTo(0, 0);
    return;
  }

  const opt = e.target.closest('[data-option]');
  if (opt && !revealed) {
    selection = Number(opt.dataset.option);
    render();
    return;
  }

  const a = e.target.closest('[data-action]');
  if (!a) return;
  switch (a.dataset.action) {
    case 'start': goto('practice'); break;
    case 'save': if (view[index]) { toggleSave(view[index].id); render(); } break;
    case 'submit': submit(); render(); break;
    case 'next': step(1); render(); break;
    case 'prev': step(-1); render(); break;
    case 'theme':
      prefs.theme = (prefs.theme ? prefs.theme === 'dark' : !!mqDark.matches) ? 'light' : 'dark';
      savePrefs(); applyPrefs(); break;
    case 'font': prefs.font = prefs.font === 'lg' ? 'std' : 'lg'; savePrefs(); applyPrefs(); break;
    case 'reset':
      if (window.confirm('确定清除本机的全部学习记录与收藏？此操作不可恢复。')) {
        state = { records: {}, saved: [] };
        save();
        resetQ();
        render();
      }
      break;
  }
});

/* ============ 事件：键盘（桌面端人因优化） ============ */
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (page !== 'practice' && page !== 'mistakes') return;
  const el = e.target;
  const inControl = el && el instanceof Element && el.closest('button, a, input, textarea, select');
  const k = e.key;

  if ((k === 'Enter' || k === ' ') && inControl) return; // 交给原生按钮行为，避免双触发

  if (!revealed && /^[1-4a-dA-D]$/.test(k)) {
    const n = '1234abcd'.indexOf(k.toLowerCase());
    if (n >= 0 && n <= 3) { selection = n; render(); e.preventDefault(); }
    return;
  }
  if (k === 'Enter') {
    e.preventDefault();
    if (!revealed) { if (selection !== null) { submit(); render(); } }
    else { step(1); render(); }
    return;
  }
  if (k === 'ArrowRight') { e.preventDefault(); step(1); render(); return; }
  if (k === 'ArrowLeft') { e.preventDefault(); step(-1); render(); return; }
  if ((k === 's' || k === 'S') && !inControl) { if (view[index]) { toggleSave(view[index].id); render(); e.preventDefault(); } }
});

/* ============ 离线状态提示 ============ */
function updateNet() {
  const el = $('#offlineState');
  if (!el) return;
  el.innerHTML = navigator.onLine
    ? '<i></i> 离线可用 · 数据仅存本机'
    : '<i class="warn"></i> 当前已离线 · 练习照常可用';
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);

/* ============ 启动 ============ */
loadState();
applyPrefs();
if (mqDark.addEventListener) mqDark.addEventListener('change', () => { if (!prefs.theme) applyPrefs(); });
updateNet();
rebuild();
render();

/* Service Worker：在线访问后可离线继续使用（file:// 下自动跳过） */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
