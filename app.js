/* 识陷 · 公考政治理论训练。无依赖、无后端，可离线运行。 */
'use strict';

const $ = selector => document.querySelector(selector);
const content = $('#content');
const questionData = [
  ...(typeof CORE_QUESTIONS !== 'undefined' ? CORE_QUESTIONS : []),
  ...(typeof EXTRA_QUESTIONS !== 'undefined' ? EXTRA_QUESTIONS : []),
  ...(typeof MIX_QUESTIONS !== 'undefined' ? MIX_QUESTIONS : [])
];
const trapData = typeof TRAPS !== 'undefined' ? TRAPS : [];
const trapNames = trapData.map(item => item.name);
const questionCount = questionData.length;

/* 答案位置用固定种子打散：同一题每次打开顺序相同，不形成“答案总在 A”的规律。 */
function seededShuffle(items, seed) {
  const result = items.slice();
  let state = (seed * 2654435761) % 4294967296;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function shuffleQuestion(question) {
  if (!Array.isArray(question.options) || question.type === 'judge' || question.type === 'number') return { ...question };
  const order = seededShuffle(question.options.map((_, i) => i), question.id);
  return {
    ...question,
    options: order.map(i => question.options[i]),
    answer: order.indexOf(question.answer)
  };
}
function interleaveByTrap(items) {
  const buckets = new Map();
  for (const q of items) {
    if (!buckets.has(q.tag)) buckets.set(q.tag, []);
    buckets.get(q.tag).push(q);
  }
  const names = seededShuffle([...buckets.keys()], 20261118);
  for (const [i, name] of names.entries()) buckets.set(name, seededShuffle(buckets.get(name), 9000 + i * 31));
  const result = [];
  let moved = true;
  while (moved) {
    moved = false;
    for (const name of names) {
      const item = buckets.get(name).shift();
      if (item) { result.push(item); moved = true; }
    }
  }
  return result;
}
const questions = interleaveByTrap(questionData.map(shuffleQuestion));

/* 本地学习状态。v1/v2 会无损迁移到扩展后的 v3 结构。 */
const KEY = 'shixian-progress-v3';
const LEGACY_KEYS = ['shixian-progress-v2', 'shixian-progress-v1'];
const PREF_KEY = 'shixian-prefs-v1';
const emptyState = () => ({ records: {}, saved: [], activity: [], cardProgress: {} });
let state = emptyState();
let prefs = { theme: '', font: 'std' };

function normalizeRecord(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const ok = typeof r.ok === 'boolean' ? r.ok : !!r.correct;
  const hasAttempts = Number.isFinite(Number(r.attempts));
  const attempts = Math.max(0, hasAttempts ? Number(r.attempts) : (r.ok !== undefined || r.correct !== undefined ? 1 : 0));
  const now = Date.now();
  return {
    ok,
    wronged: !!r.wronged || !ok,
    streak: Math.max(0, Number.isFinite(Number(r.streak)) ? Number(r.streak) : (ok ? 1 : 0)),
    attempts,
    correctCount: Math.max(0, Number.isFinite(Number(r.correctCount)) ? Number(r.correctCount) : (ok ? 1 : 0)),
    wrongCount: Math.max(0, Number.isFinite(Number(r.wrongCount)) ? Number(r.wrongCount) : (!ok ? 1 : 0)),
    lastSeen: Number(r.lastSeen) || now,
    dueAt: Number(r.dueAt) || now,
    reps: Math.max(0, Number(r.reps) || 0),
    intervalDays: Math.max(0, Number(r.intervalDays) || 0),
    ease: Math.max(1.3, Number(r.ease) || 2.5),
    lastRating: Number.isFinite(Number(r.lastRating)) ? Number(r.lastRating) : null
  };
}
function normalizeState(raw) {
  const next = emptyState();
  if (!raw || typeof raw !== 'object') return next;
  for (const [id, record] of Object.entries(raw.records || {})) next.records[id] = normalizeRecord(record);
  next.saved = Array.isArray(raw.saved) ? [...new Set(raw.saved.map(Number).filter(Number.isFinite))] : [];
  next.activity = Array.isArray(raw.activity) ? raw.activity.filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.day)).slice(-1800) : [];
  next.cardProgress = raw.cardProgress && typeof raw.cardProgress === 'object' ? raw.cardProgress : {};
  return next;
}
function loadState() {
  try {
    const current = localStorage.getItem(KEY);
    if (current) {
      state = normalizeState(JSON.parse(current));
      return;
    }
    for (const legacyKey of LEGACY_KEYS) {
      const legacy = localStorage.getItem(legacyKey);
      if (!legacy) continue;
      state = normalizeState(JSON.parse(legacy));
      saveState();
      return;
    }
  } catch (_) {
    state = emptyState();
  }
}
function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* 存储被禁用时仍可练习 */ }
}
try {
  const storedPrefs = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
  if (storedPrefs && typeof storedPrefs === 'object') prefs = { ...prefs, ...storedPrefs };
} catch (_) { /* 使用默认偏好 */ }
function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (_) { /* 忽略存储异常 */ }
}
const darkMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };
function applyPrefs() {
  const dark = prefs.theme ? prefs.theme === 'dark' : !!darkMedia.matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.font = prefs.font === 'lg' ? 'lg' : 'std';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#171a17' : '#f4f3ed';
  const themeButton = $('#themeBtn');
  if (themeButton) {
    themeButton.title = dark ? '切换浅色模式' : '切换深色模式';
    themeButton.setAttribute('aria-label', themeButton.title);
    themeButton.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2.5 12h2m15 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z"/></svg>';
  }
  const fontButton = $('#fontBtn');
  if (fontButton) {
    fontButton.textContent = prefs.font === 'lg' ? '小' : '字';
    fontButton.title = prefs.font === 'lg' ? '恢复标准字号' : '放大字号';
    fontButton.setAttribute('aria-label', fontButton.title);
  }
}

/* 记录与间隔复习 */
function rec(id) { return state.records[String(id)] || null; }
function inBook(id) {
  const r = rec(id);
  if (!r) return false;
  return !r.ok || (!!r.wronged && r.streak < 2);
}
function isDue(record) { return !!record && Number(record.dueAt) <= Date.now(); }
function schedule(record, correct, quality, previous) {
  const prior = previous || { reps: record.reps || 0, intervalDays: record.intervalDays || 0, ease: record.ease || 2.5 };
  const now = Date.now();
  let reps = prior.reps;
  let intervalDays = prior.intervalDays;
  let ease = prior.ease;
  if (!correct || quality < 3) {
    reps = 0;
    intervalDays = 0;
    if (quality < 3) ease = Math.max(1.3, ease - 0.2);
    record.dueAt = now + 60 * 60 * 1000;
  } else {
    reps += 1;
    const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    ease = Math.max(1.3, Math.min(2.8, ease + delta));
    intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(1, Math.round(intervalDays * ease));
    if (quality === 5 && reps >= 2) intervalDays = Math.max(intervalDays, Math.round((prior.intervalDays || 3) * ease * 1.2));
    record.dueAt = now + intervalDays * 24 * 60 * 60 * 1000;
  }
  record.reps = reps;
  record.intervalDays = intervalDays;
  record.ease = Math.round(ease * 100) / 100;
  record.lastRating = quality;
}
function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
let pendingSrs = null;
function saveAttempt(question, correct, quality = 3) {
  const id = String(question.id);
  const previous = rec(id);
  const record = previous ? { ...previous } : normalizeRecord({ ok: true, wronged: false, streak: 0, attempts: 0, correctCount: 0, wrongCount: 0, reps: 0, intervalDays: 0, ease: 2.5 });
  const before = { reps: record.reps || 0, intervalDays: record.intervalDays || 0, ease: record.ease || 2.5 };
  record.attempts += 1;
  record.lastSeen = Date.now();
  record.ok = !!correct;
  if (correct) {
    record.correctCount += 1;
    record.streak = (record.streak || 0) + 1;
  } else {
    record.wrongCount += 1;
    record.streak = 0;
    record.wronged = true;
  }
  schedule(record, !!correct, correct ? quality : 1, before);
  state.records[id] = record;
  state.activity.push({ day: localDay(), correct: !!correct });
  if (state.activity.length > 1800) state.activity.splice(0, state.activity.length - 1800);
  pendingSrs = correct ? { id, before, quality } : null;
  saveState();
}
function applyConfidence(question, quality) {
  if (!pendingSrs || pendingSrs.id !== String(question.id)) return;
  const record = rec(question.id);
  if (!record) return;
  schedule(record, true, quality, pendingSrs.before);
  pendingSrs.quality = quality;
  saveState();
}
function stats() {
  let attempted = 0, stable = 0, wrong = 0, due = 0, totalAttempts = 0, totalCorrect = 0;
  for (const q of questions) {
    const r = rec(q.id);
    if (!r) continue;
    if (r.attempts > 0) attempted++;
    totalAttempts += r.attempts || 0;
    totalCorrect += r.correctCount || 0;
    if (r.streak >= 2) stable++;
    if (inBook(q.id)) wrong++;
    if (isDue(r)) due++;
  }
  return { attempted, stable, wrong, due, totalAttempts, totalCorrect, accuracy: totalAttempts ? Math.round(totalCorrect / totalAttempts * 100) : 0 };
}
function tagStats(tag) {
  let count = 0, attempted = 0, stable = 0, wrong = 0;
  for (const q of questions) {
    if (q.tag !== tag) continue;
    count++;
    const r = rec(q.id);
    if (r && r.attempts > 0) attempted++;
    if (r && r.streak >= 2) stable++;
    if (inBook(q.id)) wrong++;
  }
  return { count, attempted, stable, wrong };
}
function weeklyActivity() {
  const byDay = new Map();
  for (const item of state.activity) {
    if (!byDay.has(item.day)) byDay.set(item.day, { correct: 0, wrong: 0 });
    byDay.get(item.day)[item.correct ? 'correct' : 'wrong']++;
  }
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  const days = [];
  for (let ago = 6; ago >= 0; ago--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - ago);
    const key = localDay(day);
    days.push({ label: labels[day.getDay()], ...(byDay.get(key) || { correct: 0, wrong: 0 }) });
  }
  return days;
}

/* 页面与练习状态 */
let page = 'home';
let materialTab = 'traps';
let mode = 'all';
let filter = '全部';
let view = [];
let index = 0;
let selection = null;
let numberEntry = '';
let revealed = false;
let holdId = null;
let sessionIds = null;
let examAnswers = {};
let examEndAt = 0;
let examTimer = null;
let examResult = null;
let cardGroup = '全部';
let cardIndex = 0;
let cardRevealed = false;

function mixDaily(items, seed) { return seededShuffle(items, seed); }
function dailyQueue() {
  const due = questions.filter(q => isDue(rec(q.id))).sort((a, b) => (rec(a.id).dueAt || 0) - (rec(b.id).dueAt || 0));
  const unseen = questions.filter(q => !rec(q.id));
  const later = questions.filter(q => rec(q.id) && !isDue(rec(q.id)));
  const todaySeed = Number(localDay().replaceAll('-', '')) || 1;
  return [...due, ...mixDaily(unseen, todaySeed), ...mixDaily(later, todaySeed + 2)].slice(0, 10).map(q => q.id);
}
function mockQueue() {
  const available = questions.filter(q => q.type !== 'number');
  const byTag = new Map();
  for (const q of available) {
    if (!byTag.has(q.tag)) byTag.set(q.tag, []);
    byTag.get(q.tag).push(q);
  }
  const seed = (Date.now() >>> 0) || 1;
  const tags = seededShuffle([...byTag.keys()], seed);
  for (const [i, tag] of tags.entries()) byTag.set(tag, seededShuffle(byTag.get(tag), seed + 2200 + i));
  const out = [];
  while (out.length < Math.min(20, available.length)) {
    let added = false;
    for (const tag of tags) {
      const q = byTag.get(tag).shift();
      if (q && out.length < 20) { out.push(q); added = true; }
    }
    if (!added) break;
  }
  return out.map(q => q.id);
}
function rebuildView() {
  let base = questions;
  if (filter !== '全部') base = base.filter(q => q.tag === filter);
  if (mode === 'wrong') base = base.filter(q => inBook(q.id) || (revealed && q.id === holdId));
  else if (mode === 'saved') base = base.filter(q => state.saved.includes(q.id));
  else if (mode === 'numbers') base = base.filter(q => q.type === 'number');
  else if (mode === 'daily' || mode === 'mock') {
    const ids = sessionIds || [];
    base = ids.map(id => questions.find(q => q.id === id)).filter(Boolean);
  }
  view = base;
  if (index >= view.length) index = Math.max(0, view.length - 1);
}
function resetQuestion() {
  index = 0;
  selection = null;
  numberEntry = '';
  revealed = false;
  holdId = null;
  pendingSrs = null;
}
function stopExamTimer() {
  if (examTimer != null) {
    if (window.clearInterval) window.clearInterval(examTimer);
    else clearInterval(examTimer);
  }
  examTimer = null;
}
function startMode(nextMode) {
  stopExamTimer();
  page = nextMode === 'wrong' ? 'mistakes' : 'practice';
  mode = nextMode;
  filter = '全部';
  sessionIds = nextMode === 'daily' ? dailyQueue() : nextMode === 'mock' ? mockQueue() : null;
  examAnswers = {};
  examResult = null;
  examEndAt = nextMode === 'mock' ? Date.now() + 20 * 60 * 1000 : 0;
  resetQuestion();
  rebuildView();
  if (nextMode === 'mock') {
    const tick = () => {
      if (page !== 'practice' || mode !== 'mock') return;
      if (Date.now() >= examEndAt) finishExam(true);
      else updateTimer();
    };
    examTimer = window.setInterval ? window.setInterval(tick, 1000) : setInterval(tick, 1000);
  }
  render();
  safeScrollTop();
}
function setPage(nextPage) {
  if (nextPage === 'practice') { startMode('all'); return; }
  if (nextPage === 'mistakes') { startMode('wrong'); return; }
  if (mode === 'mock' && page === 'practice') stopExamTimer();
  page = nextPage;
  if (nextPage === 'guide') materialTab = 'traps';
  render();
  safeScrollTop();
}
function safeScrollTop() {
  if (!window.scrollTo) return;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}

/* 输出编码 */
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function pageIntro(label, title, description) {
  return `<header class="page-intro"><div class="eyebrow">${esc(label)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></header>`;
}
function masteryMessage(question) {
  const r = rec(question.id);
  if (!r) return '';
  if (!r.ok) return '已加入错题，建议间隔一段时间再做。';
  if (r.streak >= 2 && r.wronged) return '连续答对 2 次，已从错题中移出。';
  if (r.streak >= 2) return '连续答对 2 次，已稳定掌握。';
  if (r.wronged) return '答对 1 次，再连续答对 1 次即可移出错题。';
  return '首答正确，再答对 1 次可标记为稳定掌握。';
}
function displayAnswer(question) {
  if (question.type === 'number') return question.answer;
  if (question.type === 'judge') return question.answer === 0 ? '正确' : '错误';
  return `第 ${question.answer + 1} 项：${question.options[question.answer]}`;
}
function optionButton(question, option, optionIndex, selectedValue, isRevealed) {
  let classes = 'option-button';
  if (selectedValue === optionIndex) classes += ' selected';
  const isRight = isRevealed && optionIndex === question.answer;
  const isWrongPick = isRevealed && selectedValue === optionIndex && optionIndex !== question.answer;
  if (isRight) classes += ' correct';
  if (isWrongPick) classes += ' incorrect';
  const mark = isRight ? '<span class="option-mark">正确答案</span>' : isWrongPick ? '<span class="option-mark">本次选择</span>' : '';
  return `<button class="${classes}" type="button" data-option="${optionIndex}" aria-pressed="${selectedValue === optionIndex}" ${isRevealed ? 'disabled' : ''}>
    <span class="option-number">${optionIndex + 1}</span><span>${esc(option)}</span>${mark}</button>`;
}
function quickKeys(question) {
  return `<div class="quick-keys" aria-label="数字快捷选项"><span class="quick-keys-label">数字快捷选项</span>${question.options.map((_, i) =>
    `<button class="quick-key ${selection === i ? 'selected' : ''}" type="button" data-option="${i}" ${revealed ? 'disabled' : ''} aria-label="选择第 ${i + 1} 项">${i + 1}</button>`).join('')}</div>`;
}
function digitPad() {
  const keys = ['1','2','3','4','5','6','7','8','9','clear','0','back'];
  return `<div class="digit-pad" aria-label="数字键盘">${keys.map(key => {
    const isUtility = key === 'clear' || key === 'back';
    const label = key === 'clear' ? '清空' : key === 'back' ? '退格' : key;
    const action = key === 'clear' ? 'clear-number' : key === 'back' ? 'backspace-number' : 'digit';
    return `<button class="digit-key ${isUtility ? 'utility' : ''}" type="button" data-action="${action}" ${key !== 'clear' && key !== 'back' ? `data-digit="${key}"` : ''} ${revealed ? 'disabled' : ''}>${label}</button>`;
  }).join('')}</div>`;
}
function renderQuestionBody(question, selectedValue) {
  if (question.type === 'number') {
    return `<div class="numeric-wrap">
      <div class="numeric-entry"><label for="numberAnswer">输入数字</label><input id="numberAnswer" data-number-input="true" type="text" inputmode="none" pattern="[0-9]*" maxlength="8" autocomplete="off" autocapitalize="off" value="${esc(numberEntry)}" aria-label="输入数字答案" ${revealed ? 'disabled' : ''}></div>
      ${digitPad()}
    </div>`;
  }
  const combo = question.type === 'combo' ? `<ol class="combo-items">${(question.items || []).map(item => `<li>${esc(item)}</li>`).join('')}</ol>` : '';
  const options = question.options.map((option, i) => optionButton(question, option, i, selectedValue, revealed)).join('');
  return `${combo}<div class="option-list">${options}</div>${revealed ? '' : quickKeys(question)}`;
}
function renderFeedback(question, correct, selectedValue) {
  const answer = displayAnswer(question);
  const selectedText = question.type === 'number'
    ? (selectedValue || '未输入')
    : (selectedValue == null ? '未选择' : question.options[selectedValue]);
  const quality = pendingSrs && pendingSrs.id === String(question.id) ? pendingSrs.quality : 3;
  const confidence = correct ? `<div class="confidence"><p>这题你觉得掌握得怎样？</p><div class="confidence-options">
      <button class="confidence-option ${quality === 2 ? 'active' : ''}" type="button" data-action="rate" data-quality="2">还不稳</button>
      <button class="confidence-option ${quality === 4 ? 'active' : ''}" type="button" data-action="rate" data-quality="4">记住了</button>
      <button class="confidence-option ${quality === 5 ? 'active' : ''}" type="button" data-action="rate" data-quality="5">很熟</button>
    </div></div>` : '';
  return `<section class="feedback ${correct ? 'correct' : 'incorrect'}" aria-live="polite">
    <div class="feedback-heading"><span class="result">${correct ? '回答正确' : '回答错误'}</span><small>正确答案：${esc(answer)}</small></div>
    ${!correct ? `<p><strong>你的选择</strong>${esc(selectedText)}</p>` : ''}
    <p><strong>命题陷阱</strong>${esc(question.trap)}</p>
    <p><strong>解析</strong>${esc(question.explain)}</p>
    <div class="feedback-tip"><strong>解题提示</strong> ${esc(question.tip)}</div>
    <div class="mastery-note">${esc(masteryMessage(question))}</div>
    ${confidence}
  </section>`;
}
function renderQuestion(question) {
  const saved = state.saved.includes(question.id);
  const record = rec(question.id);
  const selectedValue = question.type === 'number' ? numberEntry : mode === 'mock' ? (examAnswers[String(question.id)] ?? selection) : selection;
  const topicLine = `${question.topic || ''} · ${question.level || '基础'}`;
  const status = record ? (inBook(question.id) ? '<span class="pill orange">待复习</span>' : record.streak >= 2 ? '<span class="pill green">已掌握</span>' : '<span class="pill">练过</span>') : '<span class="pill">新题</span>';
  const timer = mode === 'mock' ? `<span class="timer" id="examTimer">${formatTimer(Math.max(0, Math.ceil((examEndAt - Date.now()) / 1000)))}</span>` : '';
  const examStrip = mode === 'mock' ? `<div class="session-strip"><span><strong>限时测验</strong> · 20 题，不显示即时解析</span>${timer}</div>` : '';
  const modeHelp = mode === 'daily' ? '<div class="session-strip"><span>每日练习 · 先复习到期题，再加入新题</span><span class="pill">10 题</span></div>'
    : mode === 'numbers' ? '<div class="session-strip"><span>数字填空 · 可点屏幕键盘，也可直接输入</span><span class="pill">数字键盘</span></div>'
    : mode === 'wrong' ? '<div class="session-strip"><span>连续答对 2 次后，题目自动移出错题</span><span class="pill">间隔复习</span></div>'
    : mode === 'saved' ? '<div class="session-strip"><span>集中练习已收藏的题目</span><span class="pill">收藏</span></div>' : '';
  const countLabel = `第 ${String(index + 1).padStart(2, '0')} 题 / ${String(view.length).padStart(2, '0')}`;
  const feedback = revealed && mode !== 'mock' ? renderFeedback(question, selectionCorrect(question, selectedValue), selectedValue) : '';
  const body = renderQuestionBody(question, selectedValue);
  let actions = '';
  if (mode === 'mock') {
    const isLast = index === view.length - 1;
    actions = `<div class="question-actions"><button class="secondary-button" type="button" data-action="exam-prev" ${index === 0 ? 'disabled' : ''}>上一题</button>
      <button class="primary-button" type="button" data-action="${isLast ? 'finish-exam' : 'exam-next'}">${isLast ? '交卷' : '下一题'}</button></div>`;
  } else if (revealed) {
    const isLastInDaily = (mode === 'daily' || mode === 'numbers') && index === view.length - 1;
    actions = `<div class="question-actions"><button class="secondary-button" type="button" data-action="prev" ${index === 0 ? 'disabled' : ''}>上一题</button>
      <button class="primary-button" type="button" data-action="next">${isLastInDaily ? '完成本轮' : '下一题'}</button></div>`;
  } else {
    const canSubmit = question.type === 'number' ? numberEntry.trim().length > 0 : selectedValue !== null && selectedValue !== undefined;
    actions = `<div class="question-actions"><button class="secondary-button" type="button" data-action="prev" ${index === 0 ? 'disabled' : ''}>上一题</button>
      <button class="primary-button" type="button" data-action="submit" ${canSubmit ? '' : 'disabled'}>确认答案</button></div>`;
  }
  const keyboard = question.type === 'number'
    ? '<p class="keyboard-hint"><kbd>0</kbd>–<kbd>9</kbd> 输入 · <kbd>Backspace</kbd> 退格 · <kbd>Esc</kbd> 清空 · <kbd>Enter</kbd> 确认</p>'
    : mode === 'mock'
      ? '<p class="keyboard-hint">键盘可用：<kbd>1</kbd>–<kbd>4</kbd> 选项 · <kbd>←</kbd> <kbd>→</kbd> 切题</p>'
      : '<p class="keyboard-hint"><kbd>1</kbd>–<kbd>4</kbd> 选项 · <kbd>Enter</kbd> 确认 / 下一题 · <kbd>←</kbd> <kbd>→</kbd> 切题 · <kbd>S</kbd> 收藏</p>';
  return `${examStrip}${modeHelp}<article class="question-card" data-question-card>
    <div class="question-meta"><span class="pill green">${esc(question.tag)}</span><span class="topic-meta">${esc(topicLine)}</span>${status}
      <button class="save-button ${saved ? 'saved' : ''}" type="button" data-action="save" aria-pressed="${saved}">${saved ? '已收藏' : '收藏'}</button></div>
    <div class="question-count"><strong>${countLabel}</strong><span>${question.type === 'combo' ? '组合选择' : question.type === 'judge' ? '判断' : question.type === 'number' ? '数字填空' : '单项选择'}</span></div>
    <div class="question-progress" aria-hidden="true"><i style="width:${Math.round((index + 1) / Math.max(1, view.length) * 100)}%"></i></div>
    <h2 class="question-title">${esc(question.q)}</h2>
    ${body}
    ${feedback}
    ${actions}
    ${keyboard}
  </article>`;
}
function selectionCorrect(question, selectedValue) {
  if (question.type === 'number') return String(selectedValue == null ? '' : selectedValue).trim() === String(question.answer).trim();
  return selectedValue === question.answer;
}
function renderEmptyPractice() {
  if (mode === 'wrong') return `<div class="empty-state"><span class="empty-number">${stats().wrong}</span><h2>错题本目前是空的</h2><p>练习中答错的题会自动收录，隔一段时间再答对两次，就会从这里移出。</p><button class="primary-button" type="button" data-mode="all">开始混合练习</button></div>`;
  if (mode === 'saved') return `<div class="empty-state"><span class="empty-number">0</span><h2>还没有收藏题目</h2><p>遇到需要回头记的题，点题目右上角的“收藏”。</p><button class="primary-button" type="button" data-mode="all">去练习</button></div>`;
  if (mode === 'daily') return `<div class="empty-state"><span class="empty-number">10</span><h2>本轮每日练习已完成</h2><p>今天这组题已经做完。可以继续练习数字填空，或开始一组混合题。</p><button class="primary-button" type="button" data-mode="all">继续练习</button></div>`;
  if (mode === 'numbers') return `<div class="empty-state"><span class="empty-number">0</span><h2>数字题暂时为空</h2><p>关键时间线练习暂不可用。</p><button class="primary-button" type="button" data-page="guide">查看时间线</button></div>`;
  return `<div class="empty-state"><span class="empty-number">0</span><h2>这个分类还没有题目</h2><p>换一个陷阱类型，继续练习。</p><button class="primary-button" type="button" data-filter="全部">查看全部题目</button></div>`;
}
function modeButton(label, value, current, note = '') {
  return `<button class="mode-tab ${current === value ? 'active' : ''}" type="button" data-mode="${value}" aria-pressed="${current === value}">${label}${note ? ` <span>${note}</span>` : ''}</button>`;
}
function renderPractice() {
  const wrongMode = mode === 'wrong';
  const title = wrongMode ? '错题回顾' : mode === 'mock' ? '限时测验' : mode === 'numbers' ? '数字填空' : mode === 'daily' ? '每日练习' : mode === 'saved' ? '收藏题目' : '专项练习';
  const intro = pageIntro(wrongMode ? '错题回顾' : '专项练习', title,
    wrongMode ? '答错的题会自动加入这里；连续答对两次后移出。' : '先独立判断，再看题目考查的陷阱。每种题型都能用屏幕数字键操作。');
  const modes = `<div class="practice-controls"><div class="mode-tabs" aria-label="选择练习方式">
    ${modeButton('混合练习', 'all', mode)}${modeButton('每日 10 题', 'daily', mode)}${modeButton('数字填空', 'numbers', mode)}${modeButton('限时测验', 'mock', mode)}${modeButton('错题', 'wrong', mode)}${modeButton('收藏', 'saved', mode)}
  </div>`;
  const filterRow = (mode === 'all' || mode === 'wrong') ? `<div class="filter-row" aria-label="按陷阱类型筛选">${['全部', ...trapNames].map(name =>
    `<button class="filter-chip ${filter === name ? 'active' : ''}" type="button" data-filter="${esc(name)}" aria-pressed="${filter === name}">${esc(name)}</button>`).join('')}</div>` : '';
  const controls = `${modes}${filterRow}</div>`;
  rebuildView();
  const currentQuestion = view[index];
  return `${intro}${controls}${currentQuestion ? renderQuestion(currentQuestion) : renderEmptyPractice()}`;
}
function renderHome() {
  const s = stats();
  const pct = Math.round(s.attempted / Math.max(1, questionCount) * 100);
  const days = weeklyActivity();
  const maxActivity = Math.max(1, ...days.map(day => day.correct + day.wrong));
  const chart = days.map(day => {
    const total = day.correct + day.wrong;
    const totalHeight = total ? Math.max(5, Math.round(total / maxActivity * 100)) : 3;
    const wrongHeight = total ? Math.round(day.wrong / total * 100) : 0;
    return `<div class="day-column"><div class="day-bar-area"><div class="day-bar" style="height:${totalHeight}%"><i class="day-bar-wrong" style="height:${wrongHeight}%"></i></div></div><span class="day-label">${day.label}</span></div>`;
  }).join('');
  const mastery = trapData.map((trap, i) => {
    const a = tagStats(trap.name);
    const progress = a.count ? Math.round(a.stable / a.count * 100) : 0;
    return `<button class="mastery-link" type="button" data-filter="${esc(trap.name)}"><span class="mastery-row">
      <span class="mastery-name">${String(i + 1).padStart(2, '0')} · ${esc(trap.name)}<small>${a.wrong ? `${a.wrong} 题待复习` : a.attempted ? '暂时没有待复习题' : '还未开始'}</small></span>
      <span class="mastery-bars"><i style="width:${progress}%"></i></span><span class="mastery-value">${a.stable}<small> / ${a.count}</small></span>
    </span></button>`;
  }).join('');
  const categories = trapData.map((trap, i) => {
    const a = tagStats(trap.name);
    return `<button class="category-card" type="button" data-filter="${esc(trap.name)}"><span class="cat-num">${String(i + 1).padStart(2, '0')} · ${a.count} 题</span><strong>${esc(trap.name)}</strong><small>${a.wrong ? `${a.wrong} 题待复习` : '进入专项练习'}</small></button>`;
  }).join('');
  return `${pageIntro('学习概览', '把容易错的选项，练到一眼识破。', '从概念、主体、范围和时间等易错点练起。答完马上看解析，错题按间隔复习。')}
    <section class="welcome-panel">
      <div class="welcome-copy"><h2>做题时不只记答案，也要看清它为什么错。</h2><p>练习内容包含单选、组合、判断和数字填空。每题都有陷阱说明、解析与下一次复习时间。</p>
        <div class="welcome-actions"><button class="primary-button" type="button" data-mode="daily">开始每日 10 题</button><button class="secondary-button" type="button" data-mode="all">混合练习</button></div>
      </div>
      <div class="daily-card"><div><h3>今天的复习队列</h3><p>${s.due ? `有 ${s.due} 道题已到复习时间` : '到期题会优先排进每日练习'}</p></div><div class="daily-count">${s.due}<span class="stat-unit"> 题到期</span></div><button class="secondary-button" type="button" data-mode="daily">${s.due ? '开始复习' : '开始每日练习'}</button></div>
    </section>
    <div class="section-head"><div><h2>学习记录</h2><p>保存在当前浏览器，不会上传</p></div><button class="text-button" type="button" data-action="reset">重置记录</button></div>
    <section class="stat-grid" aria-label="学习统计">
      <article class="stat-card"><div class="stat-label">已练习题目</div><div class="stat-value">${s.attempted}<span class="stat-unit">/ ${questionCount} 题</span></div><div class="progress-track"><i style="width:${pct}%"></i></div><div class="stat-detail">题库覆盖 ${pct}%</div></article>
      <article class="stat-card"><div class="stat-label">累计正确率</div><div class="stat-value">${s.totalAttempts ? s.accuracy : '—'}<span class="stat-unit">${s.totalAttempts ? '%' : ''}</span></div><div class="stat-detail">${s.totalAttempts} 次作答</div></article>
      <article class="stat-card"><div class="stat-label">待复习错题</div><div class="stat-value">${s.wrong}<span class="stat-unit">题</span></div><div class="stat-detail">连续答对两次后移出</div></article>
      <article class="stat-card"><div class="stat-label">稳定掌握</div><div class="stat-value">${s.stable}<span class="stat-unit">题</span></div><div class="stat-detail">至少连续答对两次</div></article>
    </section>
    <section class="block" style="margin-top:16px"><div class="block-title"><div><h2>近 7 天练习</h2><p>按每天实际作答记录</p></div><span class="pill">${s.totalAttempts} 次</span></div><div class="week-chart" role="img" aria-label="近七天答题统计">${chart}</div><div class="week-legend"><span><i class="legend-dot"></i>答对</span><span><i class="legend-dot wrong"></i>答错</span></div></section>
    <section class="block"><div class="block-title"><div><h2>九类陷阱掌握度</h2><p>进度按各类题目中稳定掌握的数量计算</p></div><span class="pill green">${s.stable} 题已掌握</span></div><div class="mastery-list">${mastery}</div></section>
    <section><div class="section-head"><div><h2>按陷阱类型练习</h2><p>先判断选项，再核对具体的限定词或逻辑关系</p></div><button class="text-button" type="button" data-page="guide">查看资料</button></div><div class="category-grid">${categories}</div></section>
    <p class="source-note">题目与解析为原创学习内容，非真题。题型、错题复习与本地统计的设计参考公考开源项目的公开实现思路；未复制其题目。理论表述请以权威原文为准。</p>`;
}

function renderMaterialsNav() {
  const tabs = [['traps','避坑手册'],['cards','背诵卡'],['timeline','数字时间线']];
  return `<div class="material-tabs" aria-label="资料类型">${tabs.map(([key, label]) =>
    `<button class="material-tab ${materialTab === key ? 'active' : ''}" type="button" data-material="${key}" aria-pressed="${materialTab === key}">${label}</button>`).join('')}</div>`;
}
function renderTraps() {
  const cards = trapData.map((trap, i) => `<details class="trap-card">
    <summary><span class="trap-number">${String(i + 1).padStart(2, '0')}</span><span class="trap-name">${esc(trap.name)}</span><span class="trap-arrow" aria-hidden="true">展开</span></summary>
    <div class="trap-detail"><p>${esc(trap.def)}</p>
      <strong>常见信号词</strong><div class="signal-list">${trap.signals.map(word => `<span class="signal-word">${esc(word)}</span>`).join('')}</div>
      <p><strong>常见出题方式</strong><br>${esc(trap.trick)}</p><p><strong>拆解方法</strong><br>${esc(trap.counter)}</p>
      <strong>易混配对</strong><div class="pair-list">${trap.pairs.map(pair => `<span class="pair-item">${esc(pair)}</span>`).join('')}</div>
      <button class="text-button guide-action" type="button" data-filter="${esc(trap.name)}">练习这一类</button>
    </div></details>`).join('');
  return `<div class="trap-list">${cards}</div><p class="content-caveat">手册用于帮助识别选项结构。遇到理论表述争议，请回到教材、党和国家权威文件核对。</p>`;
}
function allCardsForGroup(group) {
  const sets = typeof RECITE !== 'undefined' ? RECITE : [];
  const groups = group === '全部' ? sets : sets.filter(set => set.group === group);
  return groups.flatMap((set, groupIndex) => set.cards.map((card, cardIndex) => ({
    ...card,
    group: set.group,
    key: `${set.group}:${cardIndex}`,
    groupIndex,
    cardIndex
  })));
}
function renderFlashcards() {
  const groups = (typeof RECITE !== 'undefined' ? RECITE : []).map(set => set.group);
  const cards = allCardsForGroup(cardGroup);
  if (cardIndex >= cards.length) cardIndex = Math.max(0, cards.length - 1);
  const card = cards[cardIndex];
  if (!card) return '<div class="empty-state"><h2>没有可显示的背诵卡</h2><p>暂时没有这个分类的卡片。</p></div>';
  const progress = state.cardProgress[card.key] || {};
  const known = Object.values(state.cardProgress).filter(item => item && item.known).length;
  return `<div class="flash-controls"><label class="small-note" for="cardGroup">选择分类</label><select id="cardGroup" data-card-group><option value="全部" ${cardGroup === '全部' ? 'selected' : ''}>全部分类</option>${groups.map(group => `<option value="${esc(group)}" ${cardGroup === group ? 'selected' : ''}>${esc(group)}</option>`).join('')}</select><span class="pill green">已记住 ${known} 张</span></div>
    <article class="flash-card"><div class="question-count"><strong>${esc(card.group)} · 第 ${cardIndex + 1} / ${cards.length} 张</strong><span>${progress.known ? '已标记记住' : '背诵卡'}</span></div>
      <h2 class="flash-front">${esc(card.front)}</h2>
      ${cardRevealed ? `<div class="flash-back">${esc(card.back)}${card.note ? `<br><span class="flash-note">${esc(card.note)}</span>` : ''}</div>` : `<div class="flash-back"><span class="small-note">先在心里回忆，再显示答案。</span></div>`}
      <div class="question-actions"><button class="secondary-button" type="button" data-action="card-prev" ${cardIndex === 0 ? 'disabled' : ''}>上一张</button><button class="primary-button" type="button" data-action="${cardRevealed ? 'card-known' : 'card-flip'}">${cardRevealed ? '记住了，下一张' : '显示答案'}</button></div>
      ${cardRevealed ? `<div class="flash-review"><button type="button" data-action="card-again">还不熟，再看一次</button><button type="button" data-action="card-known">记住了</button></div>` : ''}
    </article><p class="content-caveat">答题后先尝试主动回忆，再翻看背面；把不确定的卡片多复习几次。</p>`;
}
function renderTimeline() {
  const items = (typeof TIMELINE !== 'undefined' ? TIMELINE : []).map(item => `<article class="timeline-item"><div class="timeline-year">${esc(item.year)}</div><div class="timeline-event">${esc(item.event)}</div><div class="timeline-trap">易混：${esc(item.trap)}</div></article>`).join('');
  const pairs = (typeof NUMBER_PAIRS !== 'undefined' ? NUMBER_PAIRS : []).map(item => `<article class="number-pair"><strong>${esc(item.a)} · ${esc(item.b)}</strong><span>${esc(item.note)}</span></article>`).join('');
  return `<section class="block"><div class="block-title"><div><h2>会议与关键事件</h2><p>把时间点和对应事件放在一起记</p></div><button class="text-button" type="button" data-mode="numbers">做数字填空</button></div><div class="timeline-list">${items}</div></section>
    <section class="block"><div class="block-title"><div><h2>常考数字配对</h2><p>时间点不要脱离目标单独背</p></div></div><div class="number-pairs">${pairs}</div></section>
    <p class="content-caveat">时间线按基础复习需要整理，遇到最新会议、人事和时政表述，请以考试范围及权威发布为准。</p>`;
}
function renderGuide() {
  const label = materialTab === 'traps' ? '避坑手册' : materialTab === 'cards' ? '背诵卡' : '数字时间线';
  const description = materialTab === 'traps' ? '九类常见命题手法，附信号词、易混配对和拆解方法。'
    : materialTab === 'cards' ? '先回忆再翻面，按主题复习核心表述与易混概念。' : '集中梳理党史、会议和现代化目标中的关键数字。';
  const body = materialTab === 'traps' ? renderTraps() : materialTab === 'cards' ? renderFlashcards() : renderTimeline();
  const references = `<p class="source-note">题型、错题复习与离线设计参考了 <a href="https://github.com/ERRRC/kaogong-shuati" target="_blank" rel="noopener noreferrer">kaogong-shuati</a>、<a href="https://github.com/jangviktor-web/GongkaoNaoku" target="_blank" rel="noopener noreferrer">GongkaoNaoku</a> 等开源项目的公开思路；本项目独立实现，未复制其题目或代码。</p>`;
  return `${pageIntro('资料', label, description)}${renderMaterialsNav()}${body}${references}`;
}
function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
function finishExam(timeout = false) {
  if (mode !== 'mock' || page !== 'practice') return;
  stopExamTimer();
  const results = [];
  let correctCount = 0;
  for (const question of view) {
    const key = String(question.id);
    const answer = examAnswers[key];
    const hasAnswer = answer !== undefined && answer !== null;
    const correct = hasAnswer && selectionCorrect(question, answer);
    if (correct) correctCount++;
    saveAttempt(question, correct, correct ? 3 : 1);
    results.push({ question, answer, correct, unanswered: !hasAnswer });
  }
  examResult = { results, correctCount, total: view.length, timeout };
  page = 'results';
  render();
}
function renderExamResults() {
  if (!examResult) return pageIntro('限时测验', '测验已结束', '本次结果保存在本机学习记录中。');
  const pct = examResult.total ? Math.round(examResult.correctCount / examResult.total * 100) : 0;
  const rows = examResult.results.map((item, i) => {
    const selected = item.unanswered ? '未作答' : item.question.type === 'number' ? String(item.answer) : item.question.options[item.answer];
    const correctAnswer = item.question.type === 'number' ? item.question.answer : item.question.options[item.question.answer];
    return `<div class="result-row ${item.correct ? 'correct' : 'incorrect'}"><span class="result-state">${item.correct ? '答对' : item.unanswered ? '未作答' : '答错'}</span><span>${String(i + 1).padStart(2, '0')} · ${esc(item.question.q)}<br><span class="small-note">你的作答：${esc(selected)}；正确答案：${esc(correctAnswer)}</span></span></div>`;
  }).join('');
  return `${pageIntro('限时测验', examResult.timeout ? '时间到，测验结束' : '测验已交卷', '先看正确率，再回顾答错的题。错题已加入复习队列。')}
    <section class="block"><div class="result-summary"><div class="result-cell"><strong>${examResult.correctCount} / ${examResult.total}</strong><span>答对题数</span></div><div class="result-cell"><strong>${pct}%</strong><span>正确率</span></div><div class="result-cell"><strong>${examResult.total - examResult.correctCount}</strong><span>待复习</span></div></div><div class="welcome-actions"><button class="primary-button" type="button" data-mode="wrong">复习错题</button><button class="secondary-button" type="button" data-mode="all">继续练习</button></div></section>
    <section class="block"><div class="block-title"><div><h2>逐题结果</h2><p>答案和选项按本次题目顺序显示</p></div></div><div class="result-list">${rows}</div></section>`;
}

/* 统一渲染与导航状态 */
function render() {
  const s = stats();
  const navBadge = $('#navMistakes');
  if (navBadge) {
    navBadge.textContent = String(s.wrong);
    navBadge.hidden = s.wrong === 0;
  }
  document.querySelectorAll('.nav-item').forEach(item => {
    const active = item.dataset.page === page || (page === 'results' && item.dataset.page === 'practice');
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  if (!content) return;
  content.innerHTML = page === 'home' ? renderHome()
    : page === 'guide' ? renderGuide()
    : page === 'results' ? renderExamResults()
    : renderPractice();
  if (page === 'practice' && mode === 'mock') updateTimer();
}
function updateTimer() {
  const timer = $('#examTimer');
  if (!timer || !examEndAt) return;
  timer.textContent = formatTimer(Math.max(0, Math.ceil((examEndAt - Date.now()) / 1000)));
}

/* 快捷操作 */
function submitAnswer() {
  if (revealed || mode === 'mock') return;
  const question = view[index];
  if (!question) return;
  const answer = question.type === 'number' ? numberEntry.trim() : selection;
  if (question.type === 'number' ? !answer : answer === null) return;
  holdId = question.id;
  revealed = true;
  const correct = selectionCorrect(question, answer);
  saveAttempt(question, correct, correct ? 3 : 1);
  rebuildView();
}
function clearQuestionState() {
  selection = null;
  numberEntry = '';
  revealed = false;
  holdId = null;
  pendingSrs = null;
}
function stepQuestion(direction) {
  if (!view.length) return;
  if (mode === 'wrong' && revealed && holdId != null && !inBook(holdId)) {
    rebuildView();
    if (direction > 0) index = Math.min(index, view.length - 1);
    else index = Math.max(0, index - 1);
  } else if (mode === 'all' && view.length > 1) {
    index = (index + direction + view.length) % view.length;
  } else {
    index = Math.max(0, Math.min(view.length - 1, index + direction));
  }
  clearQuestionState();
  rebuildView();
}
function selectOption(optionIndex) {
  const question = view[index];
  if (!question || revealed || mode === 'mock' && !question.options[optionIndex]) return;
  if (!question.options || optionIndex < 0 || optionIndex >= question.options.length) return;
  selection = optionIndex;
  if (mode === 'mock') examAnswers[String(question.id)] = optionIndex;
  render();
  const choice = content && content.querySelector ? content.querySelector(`[data-option="${optionIndex}"]`) : null;
  if (choice && choice.focus) choice.focus({ preventScroll: true });
}
function insertDigit(digit) {
  const question = view[index];
  if (!question || question.type !== 'number' || revealed || numberEntry.length >= 8) return;
  const value = String(digit).replace(/\D/g, '').slice(0, 1);
  if (!value) return;
  numberEntry += value;
  render();
  const key = content && content.querySelector ? content.querySelector(`[data-digit="${value}"]`) : null;
  if (key && key.focus) key.focus({ preventScroll: true });
}
function alterNumber(kind) {
  if (revealed) return;
  numberEntry = kind === 'clear' ? '' : numberEntry.slice(0, -1);
  render();
  const selector = kind === 'clear' ? '[data-action="clear-number"]' : '[data-action="backspace-number"]';
  const key = content && content.querySelector ? content.querySelector(selector) : null;
  if (key && key.focus) key.focus({ preventScroll: true });
}
function saveExamSelectionAndStep(direction) {
  const question = view[index];
  if (question && selection != null) examAnswers[String(question.id)] = selection;
  index = Math.max(0, Math.min(view.length - 1, index + direction));
  selection = view[index] ? examAnswers[String(view[index].id)] ?? null : null;
  render();
}
function toggleSaved() {
  const question = view[index];
  if (!question) return;
  state.saved = state.saved.includes(question.id) ? state.saved.filter(id => id !== question.id) : [...state.saved, question.id];
  saveState();
  rebuildView();
  render();
}
function startCardsAt(indexDelta) {
  const cards = allCardsForGroup(cardGroup);
  cardIndex = Math.max(0, Math.min(cards.length - 1, cardIndex + indexDelta));
  cardRevealed = false;
  render();
}
function rateCard(known) {
  const card = allCardsForGroup(cardGroup)[cardIndex];
  if (!card) return;
  state.cardProgress[card.key] = { known: !!known, reviewedAt: Date.now() };
  saveState();
  const total = allCardsForGroup(cardGroup).length;
  cardIndex = (cardIndex + 1) % Math.max(1, total);
  cardRevealed = false;
  render();
}
function setMaterial(tab) {
  if (!['traps', 'cards', 'timeline'].includes(tab)) return;
  materialTab = tab;
  if (tab === 'cards') { cardIndex = 0; cardRevealed = false; }
  render();
}
function setPracticeMode(nextMode) {
  if (!['all','daily','numbers','mock','wrong','saved'].includes(nextMode)) return;
  startMode(nextMode);
}

/* 点击事件委托 */
document.addEventListener('click', event => {
  const target = event.target;
  if (!target || !target.closest) return;
  const pageTarget = target.closest('[data-page]');
  if (pageTarget) { setPage(pageTarget.dataset.page); return; }
  const materialTarget = target.closest('[data-material]');
  if (materialTarget) { setMaterial(materialTarget.dataset.material); return; }
  const modeTarget = target.closest('[data-mode]');
  if (modeTarget) { setPracticeMode(modeTarget.dataset.mode); return; }
  const filterTarget = target.closest('[data-filter]');
  if (filterTarget) {
    const keepWrongList = page === 'mistakes' && mode === 'wrong';
    page = keepWrongList ? 'mistakes' : 'practice';
    mode = keepWrongList ? 'wrong' : 'all';
    filter = filterTarget.dataset.filter || '全部';
    sessionIds = null;
    resetQuestion();
    rebuildView();
    render();
    safeScrollTop();
    return;
  }
  const optionTarget = target.closest('[data-option]');
  if (optionTarget) { selectOption(Number(optionTarget.dataset.option)); return; }
  const digitTarget = target.closest('[data-digit]');
  if (digitTarget) { insertDigit(digitTarget.dataset.digit); return; }
  const actionTarget = target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  switch (action) {
    case 'theme':
      prefs.theme = (prefs.theme ? prefs.theme === 'dark' : !!darkMedia.matches) ? 'light' : 'dark';
      savePrefs(); applyPrefs(); break;
    case 'font':
      prefs.font = prefs.font === 'lg' ? 'std' : 'lg';
      savePrefs(); applyPrefs(); break;
    case 'reset':
      if (window.confirm('清除本机的学习记录和收藏？此操作无法撤销。')) {
        state = emptyState(); saveState(); resetQuestion(); render();
      }
      break;
    case 'submit': submitAnswer(); render(); break;
    case 'next':
      if ((mode === 'daily' || mode === 'numbers') && index === view.length - 1) {
        page = 'home'; sessionIds = null; render();
      } else { stepQuestion(1); render(); }
      break;
    case 'prev': stepQuestion(-1); render(); break;
    case 'save': toggleSaved(); break;
    case 'rate': {
      const question = view[index];
      if (question) { applyConfidence(question, Number(actionTarget.dataset.quality) || 4); render(); }
      break;
    }
    case 'digit': insertDigit(actionTarget.dataset.digit); break;
    case 'clear-number': alterNumber('clear'); break;
    case 'backspace-number': alterNumber('back'); break;
    case 'exam-next': saveExamSelectionAndStep(1); break;
    case 'exam-prev': saveExamSelectionAndStep(-1); break;
    case 'finish-exam':
      if (window.confirm('现在交卷并查看结果？未作答的题目会按答错计入错题。')) finishExam(false);
      break;
    case 'card-flip': cardRevealed = true; render(); break;
    case 'card-known': rateCard(true); break;
    case 'card-again': rateCard(false); break;
    case 'card-prev': startCardsAt(-1); break;
  }
});

document.addEventListener('change', event => {
  const target = event.target;
  if (target && target.matches && target.matches('[data-card-group]')) {
    cardGroup = target.value;
    cardIndex = 0;
    cardRevealed = false;
    render();
  }
});
document.addEventListener('input', event => {
  const target = event.target;
  if (!target || !target.dataset || !target.dataset.numberInput) return;
  numberEntry = String(target.value || '').replace(/\D/g, '').slice(0, 8);
  if (target.value !== numberEntry) target.value = numberEntry;
  const submit = $('[data-action="submit"]');
  if (submit) submit.disabled = numberEntry.length === 0;
});

/* 键盘快捷键；输入框内保留系统默认输入行为。 */
document.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey || page === 'home' || page === 'guide' || page === 'results') return;
  const target = event.target;
  const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';
  if (tagName === 'input' && target.dataset && target.dataset.numberInput) {
    if (event.key === 'Enter' && !revealed) { event.preventDefault(); submitAnswer(); render(); }
    else if (event.key === 'Escape' && !revealed) { event.preventDefault(); alterNumber('clear'); }
    return;
  }
  if (tagName === 'button' && event.key === 'Enter') {
    const focusedOption = target.dataset && target.dataset.option != null ? Number(target.dataset.option) : null;
    if (focusedOption != null && !revealed && selection === focusedOption) {
      event.preventDefault();
      if (mode === 'mock') {
        if (index === view.length - 1) finishExam(false);
        else saveExamSelectionAndStep(1);
      } else submitAnswer();
      render();
    }
    return; // 其他按钮保留原生 Enter 激活行为
  }
  const editing = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || tagName === 'button' || tagName === 'a' || (target && target.isContentEditable);
  if (editing) return;
  if (page !== 'practice' && page !== 'mistakes') return;
  const question = view[index];
  if (!question) return;
  const key = event.key;
  if (question.type === 'number' && !revealed) {
    if (/^\d$/.test(key)) { insertDigit(key); event.preventDefault(); return; }
    if (key === 'Backspace') { alterNumber('back'); event.preventDefault(); return; }
    if (key === 'Escape') { alterNumber('clear'); event.preventDefault(); return; }
  } else if (!revealed && /^[1-4a-dA-D]$/.test(key)) {
    const optionIndex = /^[1-4]$/.test(key) ? Number(key) - 1 : key.toLowerCase().charCodeAt(0) - 97;
    if (question.options && optionIndex >= 0 && optionIndex < question.options.length) {
      selectOption(optionIndex);
      event.preventDefault();
      return;
    }
  }
  if (key === 'Enter') {
    event.preventDefault();
    if (mode === 'mock') {
      if (index === view.length - 1) finishExam(false);
      else saveExamSelectionAndStep(1);
    } else if (!revealed) submitAnswer();
    else if ((mode === 'daily' || mode === 'numbers') && index === view.length - 1) { page = 'home'; render(); }
    else stepQuestion(1);
    render();
    return;
  }
  if (key === 'ArrowRight') {
    event.preventDefault();
    if (mode === 'mock') saveExamSelectionAndStep(1);
    else stepQuestion(1);
    render(); return;
  }
  if (key === 'ArrowLeft') {
    event.preventDefault();
    if (mode === 'mock') saveExamSelectionAndStep(-1);
    else stepQuestion(-1);
    render(); return;
  }
  if ((key === 's' || key === 'S') && !revealed) { toggleSaved(); event.preventDefault(); }
});

/* 触屏左右滑动切题；只在题卡区域触发，避免影响横向筛选条。 */
let touchStart = null;
document.addEventListener('touchstart', event => {
  if (!event.target || !event.target.closest || !event.target.closest('[data-question-card]') || !event.touches || !event.touches.length) return;
  touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchend', event => {
  if (!touchStart || !event.changedTouches || !event.changedTouches.length) { touchStart = null; return; }
  const end = event.changedTouches[0];
  const dx = end.clientX - touchStart.x;
  const dy = end.clientY - touchStart.y;
  if (Math.abs(dx) > 58 && Math.abs(dy) < 55 && (page === 'practice' || page === 'mistakes') && mode !== 'mock') {
    stepQuestion(dx < 0 ? 1 : -1);
    render();
  }
  touchStart = null;
}, { passive: true });

/* 网络状态仅用于提示；所有练习数据仍本地运行。 */
function updateNetwork() {
  const label = $('#offlineState');
  if (!label) return;
  const online = navigator.onLine !== false;
  label.classList.toggle('is-offline', !online);
  label.innerHTML = `<i></i>${online ? '离线可用' : '当前离线，练习照常可用'}`;
}
window.addEventListener('online', updateNetwork);
window.addEventListener('offline', updateNetwork);

/* 启动 */
loadState();
applyPrefs();
if (darkMedia.addEventListener) darkMedia.addEventListener('change', () => { if (!prefs.theme) applyPrefs(); });
updateNetwork();
rebuildView();
render();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
