/**
 * backend/services/autoEvaluator.js
 *
 * Auto-evaluation engine for ML / CVPR / RL submissions.
 *
 * Parses stdout for structured metric output and evaluates against
 * admin-defined thresholds to assign automatic scores.
 *
 * Convention (students must print):
 *   METRIC: accuracy=0.9523
 *   METRIC: mse=12.34
 *   METRIC: loss=0.0431
 *   METRIC: reward=245.7
 *   METRIC: f1=0.89
 *
 * Admin thresholds (stored in question JSON, e.g.):
 *   "evaluationRules": {
 *     "accuracy": { "min": 0.80, "weight": 40 },
 *     "mse":      { "max": 10.0, "weight": 30, "lowerIsBetter": true },
 *     "reward":   { "min": 200,  "weight": 30 }
 *   }
 */
'use strict';

const log = require('./logger');

// ─── Metric definitions by domain ────────────────────────────────────────────

const DOMAIN_METRICS = {
  machine_learning: ['accuracy', 'precision', 'recall', 'f1', 'mse', 'rmse', 'r2', 'loss', 'val_accuracy', 'val_loss'],
  data_science:     ['accuracy', 'mse', 'rmse', 'r2', 'mae', 'loss', 'f1', 'precision', 'recall'],
  cvpr:             ['accuracy', 'iou', 'precision', 'recall', 'f1', 'ssim', 'psnr', 'mAP'],
  reinforcement_learning: ['reward', 'total_reward', 'avg_reward', 'episode_count', 'success_rate', 'convergence'],
};

// Default thresholds for common metrics (used when admin hasn't defined custom rules)
const DEFAULT_THRESHOLDS = {
  accuracy:      { min: 0.70, weight: 100, lowerIsBetter: false, label: 'Accuracy' },
  f1:            { min: 0.65, weight: 100, lowerIsBetter: false, label: 'F1 Score' },
  precision:     { min: 0.65, weight: 100, lowerIsBetter: false, label: 'Precision' },
  recall:        { min: 0.65, weight: 100, lowerIsBetter: false, label: 'Recall' },
  mse:           { max: 100,  weight: 100, lowerIsBetter: true,  label: 'MSE' },
  rmse:          { max: 10,   weight: 100, lowerIsBetter: true,  label: 'RMSE' },
  r2:            { min: 0.60, weight: 100, lowerIsBetter: false, label: 'R² Score' },
  loss:          { max: 1.0,  weight: 100, lowerIsBetter: true,  label: 'Loss' },
  reward:        { min: 100,  weight: 100, lowerIsBetter: false, label: 'Total Reward' },
  total_reward:  { min: 100,  weight: 100, lowerIsBetter: false, label: 'Total Reward' },
  avg_reward:    { min: 50,   weight: 100, lowerIsBetter: false, label: 'Avg Reward' },
  iou:           { min: 0.50, weight: 100, lowerIsBetter: false, label: 'IoU' },
  ssim:          { min: 0.70, weight: 100, lowerIsBetter: false, label: 'SSIM' },
  mAP:           { min: 0.40, weight: 100, lowerIsBetter: false, label: 'mAP' },
};

// ─── Metric extraction ────────────────────────────────────────────────────────

function extractMetrics(stdout = '') {
  const metrics = {};
  if (!stdout) return metrics;

  for (const line of stdout.split('\n')) {
    // METRIC: name=value  OR  METRIC: name = value
    const match = line.trim().match(/^METRIC:\s*([a-zA-Z_0-9]+)\s*=\s*([0-9.\-+e]+)/i);
    if (match) {
      const key = match[1].toLowerCase().trim();
      const val = parseFloat(match[2]);
      if (!isNaN(val)) metrics[key] = val;
    }
  }

  return metrics;
}

// ─── Threshold evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate extracted metrics against thresholds.
 *
 * @param {Record<string, number>} metrics   – from extractMetrics()
 * @param {object | null}          rules     – admin-defined rules from question JSON
 * @param {string}                 domain    – ML domain
 *
 * @returns {{
 *   score: number,          // 0–100
 *   maxScore: number,
 *   passed: boolean,
 *   breakdown: Array<{ metric, value, threshold, passed, score, maxScore }>,
 *   summary: string
 * }}
 */
function evaluateMetrics(metrics, rules = null, domain = 'machine_learning') {
  const metricKeys = Object.keys(metrics);

  if (metricKeys.length === 0) {
    return {
      score: 0,
      maxScore: 0,
      passed: false,
      breakdown: [],
      summary: 'No METRIC: lines found in output. Use `print(f"METRIC: accuracy={acc:.4f}")` to report metrics.',
    };
  }

  // Use admin rules if provided, else fall back to defaults
  const thresholds = rules || {};

  // Auto-add default thresholds for any metric not in admin rules
  for (const key of metricKeys) {
    if (!thresholds[key] && DEFAULT_THRESHOLDS[key]) {
      thresholds[key] = DEFAULT_THRESHOLDS[key];
    }
  }

  let totalScore = 0;
  let totalWeight = 0;
  let allPassed = true;
  const breakdown = [];

  for (const [metricName, value] of Object.entries(metrics)) {
    const rule = thresholds[metricName];
    if (!rule) continue;

    const { weight = 10, lowerIsBetter = false, label } = rule;
    const threshold = lowerIsBetter ? rule.max : rule.min;
    totalWeight += weight;

    let metricPassed = false;
    let metricScore  = 0;

    if (threshold === undefined || threshold === null) {
      // No threshold: give full credit for reporting the metric
      metricPassed = true;
      metricScore  = weight;
    } else if (lowerIsBetter) {
      metricPassed = value <= (rule.max || Infinity);
      // Proportional score: better = more score (capped at 1.0)
      const ratio = rule.max > 0 ? Math.max(0, Math.min(1, rule.max / Math.max(value, 1e-9))) : 1;
      metricScore = Math.round(ratio * weight);
    } else {
      metricPassed = value >= (rule.min || 0);
      const ratio = rule.min > 0 ? Math.max(0, Math.min(1, value / rule.min)) : 1;
      metricScore = Math.round(ratio * weight);
    }

    if (!metricPassed) allPassed = false;
    totalScore += metricScore;

    breakdown.push({
      metric:    metricName,
      label:     label || metricName,
      value:     Math.round(value * 10000) / 10000,
      threshold,
      lowerIsBetter,
      passed:    metricPassed,
      score:     metricScore,
      maxScore:  weight,
    });
  }

  const finalScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;

  // Sort: failed metrics first
  breakdown.sort((a, b) => (a.passed ? 1 : -1));

  const passedCount = breakdown.filter(b => b.passed).length;

  return {
    score:    finalScore,
    maxScore: 100,
    passed:   allPassed,
    breakdown,
    summary:  `${passedCount}/${breakdown.length} metrics passed (score: ${finalScore}/100)`,
  };
}

// ─── Domain-specific evaluation ───────────────────────────────────────────────

/**
 * Full evaluation pipeline for a domain submission.
 *
 * @param {object} opts
 * @param {string}  opts.stdout    – Raw execution stdout
 * @param {string}  opts.domain    – ML domain
 * @param {object}  [opts.rules]   – Admin evaluation rules from question JSON
 * @param {number}  [opts.graphs]  – Number of graphs produced (bonus)
 * @param {number}  [opts.images]  – Number of images produced
 *
 * @returns { metrics, evaluation, finalScore, autoGrade }
 */
function autoEvaluate({ stdout, domain, rules = null, graphs = 0, images = 0 }) {
  const metrics    = extractMetrics(stdout);
  const evaluation = evaluateMetrics(metrics, rules, domain);

  // Small bonus for producing visualizations (up to +5 points)
  let visualBonus = 0;
  if (graphs > 0)  visualBonus += Math.min(3, graphs);
  if (images > 0)  visualBonus += Math.min(2, images);

  const finalScore = Math.min(100, evaluation.score + visualBonus);

  const autoGrade = {
    score:       finalScore,
    passed:      evaluation.passed,
    breakdown:   evaluation.breakdown,
    summary:     evaluation.summary,
    visualBonus,
    metricsFound: Object.keys(metrics).length,
  };

  log.info('Auto-evaluation complete', {
    domain,
    score: finalScore,
    metricsCount: autoGrade.metricsFound,
    passed: evaluation.passed,
  });

  return { metrics, evaluation, finalScore, autoGrade };
}

module.exports = { extractMetrics, evaluateMetrics, autoEvaluate, DOMAIN_METRICS, DEFAULT_THRESHOLDS };
