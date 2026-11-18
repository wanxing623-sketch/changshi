// 识陷 · 选项均衡工具
// 原题库正确答案严重集中在 A（31/36）。本工具按题目 id 做确定性伪随机打乱，
// 保证每次打开顺序一致，同时检查数据完整性和 A/B/C/D 答案分布。
// 判断题的「正确 / 错误」顺序不打乱；数字填空也不参与选项统计。
// 用法：node tools/balance.js（校验）/ node tools/balance.js --apply（输出预览）
'use strict';
const fs = require('fs');
const path = require('path');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const evaluate = new Function(source + '\nreturn {CORE_QUESTIONS: typeof CORE_QUESTIONS!=="undefined"?CORE_QUESTIONS:null, EXTRA_QUESTIONS: typeof EXTRA_QUESTIONS!=="undefined"?EXTRA_QUESTIONS:null, MIX_QUESTIONS: typeof MIX_QUESTIONS!=="undefined"?MIX_QUESTIONS:null};');
  return evaluate();
}

const core = load('data/questions.js');
const extra = load('data/questions-extra.js');
const mix = load('data/questions-mix.js');
const all = [...(core.CORE_QUESTIONS || []), ...(extra.EXTRA_QUESTIONS || []), ...(mix.MIX_QUESTIONS || [])];

function shuffleWithSeed(items, seed) {
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
function balanceQuestion(question) {
  if (!Array.isArray(question.options) || question.type === 'judge' || question.type === 'number') return question;
  const order = shuffleWithSeed(question.options.map((_, i) => i), question.id);
  return { ...question, options: order.map(i => question.options[i]), answer: order.indexOf(question.answer) };
}

const questions = all.map(balanceQuestion);
const errors = [];
const ids = new Set();
for (const question of questions) {
  if (ids.has(question.id)) errors.push(`重复题号：${question.id}`);
  ids.add(question.id);
  if (!question.q || !question.tag || !question.explain || !question.trap || !question.tip) {
    errors.push(`题目 ${question.id} 缺少必要字段`);
  }
  if (question.type === 'number') {
    if (!/^[0-9]+$/.test(String(question.answer))) errors.push(`题目 ${question.id} 的数字答案无效`);
  } else if (!Array.isArray(question.options) || !Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) {
    errors.push(`题目 ${question.id} 的选项或答案无效`);
  }
}

const optionQuestions = questions.filter(question => Array.isArray(question.options) && question.type !== 'judge');
const distribution = [0, 0, 0, 0];
optionQuestions.forEach(question => distribution[question.answer]++);
const tagDistribution = {};
questions.forEach(question => { tagDistribution[question.tag] = (tagDistribution[question.tag] || 0) + 1; });
console.log('总题数:', questions.length);
console.log('单选与组合题答案分布 A/B/C/D:', distribution.join(' / '));
console.log('陷阱分布:', JSON.stringify(tagDistribution));
if (!questions.length || !optionQuestions.length) errors.push('题库为空或没有选择题');
if (errors.length) {
  console.error('数据校验失败');
  errors.forEach(error => console.error(error));
  process.exit(1);
}
console.log('数据校验：通过，答案顺序可复现。');

if (process.argv.includes('--apply')) {
  fs.writeFileSync(path.join(__dirname, 'balanced-preview.json'), JSON.stringify(questions, null, 1));
  console.log('已输出 tools/balanced-preview.json（仅供核对，未覆盖源文件）');
}
