// Fuzzy match utility for fill-in-the-blank scoring.
// Accepts if student's normalized answer equals any accepted answer,
// is contained in / contains it, or has Levenshtein similarity >= 0.8.

function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const prev = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    let cur = i;
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= bl; j++) {
      const tmp = prev[j];
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + cost
      );
      prev[j - 1] = cur;
      diag = tmp;
    }
    prev[bl] = cur;
  }
  return prev[bl];
}

function similarity(a, b) {
  const x = normalize(a), y = normalize(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  if (x === y) return 1;
  const maxLen = Math.max(x.length, y.length);
  return 1 - levenshtein(x, y) / maxLen;
}

function isFuzzyMatch(studentAnswer, acceptedAnswers) {
  const s = normalize(studentAnswer);
  if (!s) return false;
  const list = Array.isArray(acceptedAnswers) ? acceptedAnswers : [acceptedAnswers];
  return list.some((a) => {
    const t = normalize(a);
    if (!t) return false;
    if (s === t) return true;
    if (s.includes(t) || t.includes(s)) return true;
    return similarity(s, t) >= 0.8;
  });
}

module.exports = { normalize, levenshtein, similarity, isFuzzyMatch };
