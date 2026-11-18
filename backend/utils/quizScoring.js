const { isFuzzyMatch, normalize: fuzzyNormalize } = require('./fuzzyMatch');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function safeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function normalizeAnswer(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function compactAnswer(value) {
  return normalizeAnswer(value).replace(/[^a-z0-9]+/g, '');
}

function stripChoicePrefix(value) {
  return String(value == null ? '' : value)
    .replace(/^\s*(option\s*)?[a-z]\s*[).:-]\s*/i, '')
    .replace(/^\s*(option\s*)?\d+\s*[).:-]\s*/i, '')
    .trim();
}

function getOptions(question) {
  let options = safeJson(question.options, null);
  if (!Array.isArray(options) || options.length === 0) {
    options = [question.option_a, question.option_b, question.option_c, question.option_d];
  }
  return options
    .map((option) => String(option == null ? '' : option).trim())
    .filter((option) => option !== '');
}

function getAcceptedAnswers(question) {
  const parsed = safeJson(question.accepted_answers, null);
  const accepted = Array.isArray(parsed) ? parsed : [];
  if (question.correct_option) accepted.push(question.correct_option);
  return accepted.map((answer) => String(answer == null ? '' : answer).trim()).filter(Boolean);
}

function numericIndex(value, optionCount, { correctKey = false } = {}) {
  if (value == null) return null;
  const raw = String(value).trim();
  const digitsMatch = raw.match(/^(?:option[\s_\-.]*)?(\d+)$/i);
  if (!digitsMatch) return null;
  const n = Number(digitsMatch[1]);

  if (correctKey) {
    if (n >= 1 && n <= optionCount) return n - 1;
    if (n === 0 && optionCount > 0) return 0;
  }
  return n >= 0 && n < optionCount ? n : null;
}

function letterIndex(value, optionCount) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(?:option[\s_\-.]*)?\(?([a-z])\)?[\s._\-)]*$/i) ||
                raw.match(/^([a-z])\s*[).:-]/i) ||
                raw.match(/option[\s_\-.]*([a-z])/i);
  if (!match) return null;
  const index = LETTERS.indexOf(match[1].toUpperCase());
  return index >= 0 && index < optionCount ? index : null;
}

function textIndex(value, options) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  const normalized = compactAnswer(raw);
  const stripped = compactAnswer(stripChoicePrefix(raw));
  const index = options.findIndex((option) => {
    const optionText = compactAnswer(option);
    const strippedOption = compactAnswer(stripChoicePrefix(option));
    return optionText === normalized || optionText === stripped || strippedOption === normalized || strippedOption === stripped;
  });
  return index >= 0 ? index : null;
}

function resolveCorrectIndex(question, options = getOptions(question)) {
  const optionCount = options.length;
  if (optionCount === 0) return null;

  const direct = question.correct_answer_index;
  if (direct != null && direct !== '') {
    const index = Number(direct);
    if (Number.isInteger(index) && index >= 0 && index < optionCount) return index;
  }

  const correct = question.correct_option;
  if (correct != null && String(correct).trim() !== '') {
    const byLetter = letterIndex(correct, optionCount);
    if (byLetter != null) return byLetter;

    const byNumber = numericIndex(correct, optionCount, { correctKey: true });
    if (byNumber != null) return byNumber;

    const byText = textIndex(correct, options);
    if (byText != null) return byText;
  }

  for (const accepted of getAcceptedAnswers(question)) {
    const acceptedIndex = textIndex(accepted, options);
    if (acceptedIndex != null) return acceptedIndex;
    const acceptedLetter = letterIndex(accepted, optionCount);
    if (acceptedLetter != null) return acceptedLetter;
  }

  return null;
}

function studentAnswerIndexes(studentAnswer, options) {
  const optionCount = options.length;
  const indexes = new Set();
  if (studentAnswer == null || String(studentAnswer).trim() === '') return indexes;

  const raw = String(studentAnswer).trim();

  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 0 && n < optionCount) indexes.add(n); // 0-based: 0=A, 1=B, 2=C, 3=D
  }

  const byLetter = letterIndex(studentAnswer, optionCount);
  if (byLetter != null) indexes.add(byLetter);

  const byText = textIndex(studentAnswer, options);
  if (byText != null) indexes.add(byText);

  return indexes;
}

function scoreQuestion(question, studentAnswer) {
  if (studentAnswer == null || String(studentAnswer).trim() === '') return false;

  const type = question.question_type || 'mcq';
  if (type === 'fill_blank') {
    const accepted = getAcceptedAnswers(question);
    return accepted.length > 0 && isFuzzyMatch(studentAnswer, accepted);
  }

  const options = getOptions(question);
  const correctIndex = resolveCorrectIndex(question, options);
  if (correctIndex == null) return false;

  const indexes = studentAnswerIndexes(studentAnswer, options);
  if (indexes.has(correctIndex)) return true;

  const correctText = options[correctIndex];
  if (correctText) {
    const student = compactAnswer(studentAnswer);
    const target = compactAnswer(correctText);
    const targetStripped = compactAnswer(stripChoicePrefix(correctText));
    if (student && (student === target || student === targetStripped)) return true;
  }

  return false;
}

function scoreQuestionSet(questions, answers) {
  if (!Array.isArray(questions) || questions.length === 0) return 0;

  let answerMap = {};
  if (typeof answers === 'string') {
    try { answerMap = JSON.parse(answers); } catch { answerMap = {}; }
  } else if (answers && typeof answers === 'object') {
    answerMap = answers;
  }

  let score = 0;
  for (const question of questions) {
    if (!question) continue;
    const qId = question.id;
    const studentAnswer = answerMap[qId] ?? answerMap[String(qId)] ?? (qId != null ? answerMap[Number(qId)] : undefined);
    if (scoreQuestion(question, studentAnswer)) {
      score += 1;
    }
  }
  return score;
}

module.exports = {
  safeJson,
  normalizeAnswer,
  compactAnswer,
  getOptions,
  getAcceptedAnswers,
  resolveCorrectIndex,
  scoreQuestion,
  scoreQuestionSet,
  fuzzyNormalize,
};