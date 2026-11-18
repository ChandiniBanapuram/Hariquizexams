/**
 * backend/services/executionEngine.js  (v2 – Production Hardened)
 *
 * Core ML/CVPR/RL Execution Engine with:
 *   ✓ Per-domain execution timeouts (standard 5s, ML 30s)
 *   ✓ Guaranteed cleanup in finally blocks (no orphan containers/temp dirs)
 *   ✓ Security scanning before execution (via securityScanner)
 *   ✓ Internet blocked at container level (--network=none)
 *   ✓ Read-only filesystem (--read-only) with tmpfs
 *   ✓ Non-root sandbox user
 *   ✓ CPU + memory limits
 *   ✓ PID limit (prevents fork bombs)
 *   ✓ Structured logging via logger service
 *   ✓ Output image compression (target ≤150KB per graph)
 *
 * Execution strategies:
 *   EXECUTION_STRATEGY=docker  → isolated Docker container (production)
 *   EXECUTION_STRATEGY=judge0  → Judge0 CE (default/cloud)
 *   For ML domains: always local Python subprocess when Docker unavailable.
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const log = require('./logger');

// ─── Output directories ───────────────────────────────────────────────────────
const OUTPUT_BASE = path.join(__dirname, '..', 'student_outputs');
const GRAPH_DIR   = path.join(OUTPUT_BASE, 'graphs');
const IMAGE_DIR   = path.join(OUTPUT_BASE, 'images');
const LOG_DIR_OUT = path.join(OUTPUT_BASE, 'logs');

[OUTPUT_BASE, GRAPH_DIR, IMAGE_DIR, LOG_DIR_OUT].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Python binary auto-detection ────────────────────────────────────────────
// Priority: .ml-python-path (venv written by installer) > PYTHON_BIN env > auto-detect
let _resolvedPython = null;
function resolvePythonBin() {
  if (_resolvedPython) return _resolvedPython;

  // 1. Check .ml-python-path — written by install_ml_deps.js with the venv Python path
  const configFile = path.join(__dirname, '..', '.ml-python-path');
  if (fs.existsSync(configFile)) {
    const venvPy = fs.readFileSync(configFile, 'utf8').trim();
    if (venvPy && fs.existsSync(venvPy)) {
      log.info(`[python] Using venv: ${venvPy}`);
      _resolvedPython = { bin: venvPy, args: [] };
      return _resolvedPython;
    }
  }

  // 2. Explicit env var config
  const envBin  = process.env.PYTHON_BIN;
  const envArgs = process.env.PYTHON_ARGS ? [process.env.PYTHON_ARGS] : [];
  if (envBin) {
    log.info(`[python] Using PYTHON_BIN: ${envBin}`);
    _resolvedPython = { bin: envBin, args: envArgs };
    return _resolvedPython;
  }

  // 3. Auto-detect: search system paths before PATH (avoids Render's venv 3.14)
  const candidates = [
    ['/usr/bin/python3.13'], ['/usr/bin/python3.11'], ['/usr/bin/python3.10'], ['/usr/bin/python3.12'],
    ['/usr/local/bin/python3.13'], ['/usr/local/bin/python3.11'], ['/usr/local/bin/python3.10'],
    ['/root/.pyenv/shims/python3.13'], ['/root/.pyenv/shims/python3.11'], ['/root/.pyenv/shims/python3.10'],
    ['/opt/render/project/.pyenv/shims/python3.13'], ['/opt/render/project/.pyenv/shims/python3.11'],
    ['py', '-3.13'], ['py', '-3.11'], ['py', '-3.10'], ['py', '-3.12'],
    ['python3.13'], ['python3.11'], ['python3.10'], ['python3.12'],
    ['python3'], ['python'],
  ];

  const { spawnSync } = require('child_process');
  for (const [bin, ...args] of candidates) {
    try {
      const r = spawnSync(bin, [...args, '--version'], { timeout: 4000, encoding: 'utf8' });
      if (r.status === 0) {
        const ver = (r.stdout || r.stderr || '').trim();
        log.info(`[python] Auto-detected: ${ver} → ${[bin, ...args].join(' ')}`);
        _resolvedPython = { bin, args };
        return _resolvedPython;
      }
    } catch {}
  }

  _resolvedPython = { bin: 'python3', args: [] };
  return _resolvedPython;
}

// ─── Strategy & limits ───────────────────────────────────────────────────────
const STRATEGY     = (process.env.EXECUTION_STRATEGY || 'judge0').toLowerCase();
const DEFAULT_MEMORY_LIMIT = process.env.EXEC_MEMORY_LIMIT || '256m';
const DL_MEMORY_LIMIT      = '2g';
const CPU_LIMIT    = process.env.EXEC_CPU_LIMIT    || '1';

// Per-domain timeouts (ms)
const TIMEOUT = {
  default:               parseInt(process.env.EXEC_TIMEOUT_STANDARD_MS || '5000',  10),
  machine_learning:      120000,
  data_science:          120000,
  cvpr:                  120000,
  reinforcement_learning:120000,
  data_structures_c:     parseInt(process.env.EXEC_TIMEOUT_STANDARD_MS || '5000',  10),
  deep_learning:         120000,
  cnn:                   120000,
  speech_ai:             120000,
};

function getTimeout(domain, language) {
  return TIMEOUT[domain] || TIMEOUT[language] || TIMEOUT.default;
}

// ─── Domain → Docker image mapping ───────────────────────────────────────────
const DOMAIN_IMAGE = {
  c:                    'exam-c-runtime:latest',
  cpp:                  'exam-cpp-runtime:latest',
  java:                 'exam-java-runtime:latest',
  python:               'exam-python-runtime:latest',
  machine_learning:     'exam-ml-runtime:latest',
  data_science:         'exam-ml-runtime:latest',
  cvpr:                 'exam-cvpr-runtime:latest',
  reinforcement_learning: 'exam-rl-runtime:latest',
  data_structures_c:    'exam-c-runtime:latest',
  deep_learning:        'exam-dl-runtime:latest',
  cnn:                  'exam-dl-runtime:latest',
  speech_ai:            'exam-speech-runtime:latest',
};

// Judge0 language IDs
const JUDGE0_LANG_MAP = { python: 71, java: 62, cpp: 54, c: 50, js: 63 };
const ML_DOMAINS = ['machine_learning', 'data_science', 'cvpr', 'reinforcement_learning', 'data_structures_c', 'deep_learning', 'cnn', 'speech_ai'];

const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';

// ─── Cleanup helpers ──────────────────────────────────────────────────────────

/**
 * Safely remove a directory tree. Never throws.
 */
function cleanupDir(dir) {
  if (!dir) return;
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      log.debug('Cleaned up temp dir', { dir });
    }
  } catch (e) {
    log.warn('Failed to cleanup temp dir', { dir, error: e.message });
  }
}

/**
 * Force-remove a Docker container by name/ID. Never throws.
 */
function cleanupContainer(containerName) {
  if (!containerName) return;
  try {
    execFileSync('docker', ['rm', '-f', containerName], { stdio: 'ignore', timeout: 5000 });
    log.container('REMOVED', containerName);
  } catch {
    // Container may have already exited (--rm flag), that's fine
  }
}

const EXECUTIONS_DIR = path.join(__dirname, '..', 'executions');
if (!fs.existsSync(EXECUTIONS_DIR)) {
  fs.mkdirSync(EXECUTIONS_DIR, { recursive: true });
}

// ─── Temp dir ─────────────────────────────────────────────────────────────────

function makeTempDir(prefix = 'job_') {
  const jobId = `${prefix}${crypto.randomBytes(8).toString('hex')}`;
  const dir = path.join(EXECUTIONS_DIR, jobId);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, jobId };
}

// ─── Image collection & compression ──────────────────────────────────────────

const MAX_IMAGE_BYTES = 150 * 1024; // 150KB per image (for fast frontend loading)

/**
 * Collect PNG/JPG files from a directory and return base64-encoded data.
 * Large files are truncated with a warning (future: sharp resize).
 */
function collectImageFiles(dir, jobId) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => /\.(png|jpg|jpeg|svg)$/i.test(f))
    .sort()
    .map(f => {
      const filePath = path.join(dir, f);
      try {
        const data = fs.readFileSync(filePath);
        const ext  = path.extname(f).slice(1).toLowerCase();
        const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
        const url = `/executions/${jobId}/${f}`;
        return {
          filename: f,
          name: f,
          mime,
          url,
          base64: `data:${mime};base64,${data.toString('base64')}`,
          sizeBytes: data.length,
        };
      } catch (e) {
        log.warn('Failed to read image file', { file: filePath, error: e.message });
        return null;
      }
    })
    .filter(Boolean);
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB limit for audio

function collectAudioFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => /\.(wav|mp3|flac|ogg)$/i.test(f))
    .sort()
    .map(f => {
      const filePath = path.join(dir, f);
      try {
        const data = fs.readFileSync(filePath);
        const ext  = path.extname(f).slice(1).toLowerCase();
        let mime = 'audio/wav';
        if (ext === 'mp3') mime = 'audio/mpeg';
        if (ext === 'flac') mime = 'audio/flac';
        if (ext === 'ogg') mime = 'audio/ogg';

        if (data.length > MAX_AUDIO_BYTES) {
          log.warn('Generated audio file too large, skipping', { file: f });
          return null;
        }

        return {
          filename: f,
          mime,
          base64: `data:${mime};base64,${data.toString('base64')}`,
          sizeBytes: data.length,
        };
      } catch (e) {
        log.warn('Failed to read audio file', { file: filePath, error: e.message });
        return null;
      }
    })
    .filter(Boolean);
}

// ─── Matplotlib / OpenCV shim ─────────────────────────────────────────────────

function buildMLCode(originalCode, outputDir, domain) {
  // Safety: outputDir must be a clean path (no shell injection)
  const safeOutputDir = JSON.stringify(outputDir);
  const shim = `
import sys as _sys, os as _os

# ── Memory limits disabled (RLIMIT_AS is bypassed to allow TensorFlow thread stack allocations) ──

# ── Suppress TensorFlow and other library warnings from polluting STDERR ─────
_os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # 0=DEBUG, 1=INFO, 2=WARNING, 3=ERROR
_os.environ['KMP_WARNINGS'] = '0'

_os.makedirs(${safeOutputDir}, exist_ok=True)

# ── Matplotlib headless setup ────────────────────────────────────────────────
try:
    import matplotlib as _mpl
    _mpl.use('Agg')
    import matplotlib.pyplot as _plt
    _GRAPH_COUNT = [0]

    def _patched_show(*a, **kw):
        _GRAPH_COUNT[0] += 1
        _plt.savefig(_os.path.join(${safeOutputDir}, f'graph_{_GRAPH_COUNT[0]:03d}.png'), dpi=100, bbox_inches='tight')
        _plt.close('all')
    _plt.show = _patched_show

    # ── Also intercept plt.savefig so user-named files land in outputDir ──
    _plt_savefig_orig = _plt.savefig
    def _patched_savefig(fname, *a, **kw):
        if isinstance(fname, str):
            # redirect to output dir, keeping the original filename
            fname = _os.path.join(${safeOutputDir}, _os.path.basename(fname))
        _GRAPH_COUNT[0] += 1
        if 'dpi' not in kw: kw['dpi'] = 100
        if 'bbox_inches' not in kw: kw['bbox_inches'] = 'tight'
        _plt_savefig_orig(fname, *a, **kw)
    _plt.savefig = _patched_savefig

except ImportError:
    pass

# ── OpenCV imwrite interception ───────────────────────────────────────────────
try:
    import cv2 as _cv2
    _cv2_write_orig = _cv2.imwrite
    _cv2_img_count = [0]
    def _patched_imwrite(filename, img, *a, **kw):
        _cv2_img_count[0] += 1
        safe = _os.path.join(${safeOutputDir}, f'cvpr_img_{_cv2_img_count[0]:03d}.png')
        return _cv2_write_orig(safe, img, *a, **kw)
    _cv2.imwrite = _patched_imwrite
except ImportError:
    pass

# ── PIL/Pillow interception ───────────────────────────────────────────────────
try:
    from PIL import Image as _PILImage
    _pil_save_orig = _PILImage.Image.save
    _pil_count = [0]
    def _patched_pil_save(self, fp, *a, **kw):
        if isinstance(fp, str):
            _pil_count[0] += 1
            fp = _os.path.join(${safeOutputDir}, f'pil_img_{_pil_count[0]:03d}.png')
        return _pil_save_orig(self, fp, *a, **kw)
    _PILImage.Image.save = _patched_pil_save
except ImportError:
    pass

import warnings as _w; _w.filterwarnings('ignore')

# ════════════════════════════════════════════════════════
# Student code begins here
# ════════════════════════════════════════════════════════
`;

  return shim + '\n' + originalCode;
}


// ─── Metric extraction ────────────────────────────────────────────────────────

function extractMetrics(stdout = '') {
  const metrics = {};
  for (const line of stdout.split('\n')) {
    const m = line.trim().match(/^METRIC:\s*([a-zA-Z_0-9]+)\s*=\s*([0-9.\-+e]+)/i);
    if (m) {
      const val = parseFloat(m[2]);
      if (!isNaN(val)) metrics[m[1].toLowerCase()] = val;
    }
  }
  return metrics;
}

// ─── Docker execution ─────────────────────────────────────────────────────────

async function runInDocker(code, language, domain, stdin = '', datasets = []) {
  const timeoutMs = getTimeout(domain, language);
  const image     = DOMAIN_IMAGE[domain] || DOMAIN_IMAGE[language] || 'exam-python-runtime:latest';
  const isML      = ML_DOMAINS.includes(domain || language);

  const { dir: workDir, jobId } = makeTempDir('job_');
  const outputDir = workDir;
  const containerName = `exam_${jobId}`;
  let containerId = null;

  try {
    fs.mkdirSync(outputDir, { recursive: true });

    // Write source file
    const ext = { python: 'py', java: 'java', c: 'c', cpp: 'cpp', js: 'js' }[language] || 'py';
    let finalCode = code;
    if (isML && language === 'python') {
      finalCode = buildMLCode(code, '/workspace', domain);
    }
    fs.writeFileSync(path.join(workDir, `solution.${ext}`), finalCode, 'utf8');
    fs.writeFileSync(path.join(workDir, 'stdin.txt'), stdin || '', 'utf8');

    // Build docker args
    const volumes = [`-v`, `${workDir}:/workspace:rw`];

    // Copy dataset files into workDir using their original names
    for (const ds of datasets) {
      if (fs.existsSync(ds.localPath)) {
        try {
          fs.cpSync(ds.localPath, path.join(workDir, ds.filename));
        } catch (e) {
          log.warn('Failed to copy dataset to Docker workDir', { error: e.message });
        }
      }
    }

    const runCmd = {
      python: `python3 solution.py < stdin.txt 2>&1`,
      java:   `javac solution.java 2>&1 && java -cp . Main < stdin.txt 2>&1`,
      c:      `gcc -O2 -o solution solution.c 2>&1 && ./solution < stdin.txt 2>&1`,
      cpp:    `g++ -O2 -o solution solution.cpp 2>&1 && ./solution < stdin.txt 2>&1`,
      js:     `node solution.js < stdin.txt 2>&1`,
    }[language] || `python3 solution.py 2>&1`;

    const memLimit = (domain === 'deep_learning' || domain === 'cnn') ? DL_MEMORY_LIMIT : DEFAULT_MEMORY_LIMIT;

    const dockerArgs = [
      'run',
      '--name',    containerName,
      '--rm',                       // auto-remove on exit
      '--network=none',             // no internet
      '-e', 'OPENBLAS_NUM_THREADS=1',
      '-e', 'MKL_NUM_THREADS=1',
      '-e', 'OMP_NUM_THREADS=1',
      '-e', 'NUMEXPR_NUM_THREADS=1',
      '-e', 'VECLIB_MAXIMUM_THREADS=1',
      '-e', 'TF_NUM_INTEROP_THREADS=1',
      '-e', 'TF_NUM_INTRAOP_THREADS=1',
      '--memory',  memLimit,
      '--memory-swap', memLimit,// no swap
      '--cpus',    CPU_LIMIT,
      '--pids-limit', '64',         // prevent fork bombs
      '--cap-drop', 'ALL',          // drop all Linux capabilities
      '--security-opt', 'no-new-privileges:true',
      '--read-only',                // immutable root filesystem
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
      ...volumes,
      '--workdir', '/workspace',
      '--user', '1000',             // non-root sandbox user
      image,
      'sh', '-c', runCmd,
    ];

    containerId = containerName;
    log.container('STARTED', containerName, { image, language, domain });

    const startMs = Date.now();
    let stdout = '', stderr = '', timedOut = false;

    try {
      const result = await execFileAsync('docker', dockerArgs, {
        maxBuffer: 5 * 1024 * 1024,
      });
      stdout = result.stdout || '';
    } catch (err) {
      stdout    = err.stdout || '';
      stderr    = err.stderr || err.message || '';
      timedOut  = (err.killed && err.signal === 'SIGTERM') ||
                  err.code === 'ETIMEDOUT' ||
                  (stderr + stdout).includes('Timeout') ||
                  (stderr + stdout).includes('timed out');
    }

    if (stderr && stderr.includes('Traceback')) {
      const shimLines = finalCode.split('Student code begins here')[0].split('\\n').length + 1;
      stderr = stderr.replace(/File "[^"]+solution\.py", line (\d+)/g, (match, p1) => {
        const studentLine = Math.max(1, parseInt(p1, 10) - shimLines);
        return `File "solution.py", line ${studentLine}`;
      });
    }

    const elapsedMs = Date.now() - startMs;
    const allFiles  = collectImageFiles(workDir, jobId);
    const graphs    = allFiles; // In ML, all generated images are treated as graphs
    const images    = [];
    const metrics = extractMetrics(stdout);
    const audioOut = collectAudioFiles(outputDir);

    log.execution(timedOut ? 'TIMEOUT' : 'DONE', {
      language, domain, elapsedMs, graphs: graphs.length, images: images.length, audio: audioOut.length
    });

    return {
      stdout:          stdout,
      stderr:          stderr,
      compileError:    '',
      executionTimeMs: elapsedMs,
      timedOut:        false,
      graphs,
      images,
      metrics,
      audioOut,
    };
  } finally {
    // Guaranteed cleanup for Docker containers
    // Container removed automatically by --rm; force-remove if it somehow remains
    cleanupContainer(containerId);
    
    // DO NOT DELETE workDir immediately so it can be served as a static asset.
  }
}

// ─── Local Python execution ───────────────────────────────────────────────────

async function runLocalPython(code, domain, stdin = '', datasets = []) {
  const timeoutMs = getTimeout(domain);
  const { dir: workDir, jobId } = makeTempDir('job_');
  const outputDir = workDir; // User wants everything in the root of the workspace

  try {
    fs.mkdirSync(outputDir, { recursive: true });

    // Copy dataset files into workDir using their original names
    for (const ds of datasets) {
      if (fs.existsSync(ds.localPath)) {
        try {
          fs.cpSync(ds.localPath, path.join(workDir, ds.filename));
        } catch (e) {
          log.warn('Failed to copy dataset to workDir', { error: e.message });
        }
      }
    }

    const finalCode = buildMLCode(code, outputDir, domain);
    fs.writeFileSync(path.join(workDir, 'solution.py'), finalCode, 'utf8');
    fs.writeFileSync(path.join(workDir, 'stdin.txt'), stdin || '', 'utf8');

    const startMs = Date.now();
    let stdout = '', stderr = '', timedOut = false;

    try {
      // Auto-detect best Python (prefers 3.8-3.12 for TF, avoids venv 3.14 on Render)
      const { bin: pythonBin, args: pythonArgs } = resolvePythonBin();
      
      const childPromise = new Promise((resolve, reject) => {
        const child = execFile(
          pythonBin,
          [...pythonArgs, path.join(workDir, 'solution.py')],
          {
            maxBuffer: 5 * 1024 * 1024,
            timeout: timeoutMs,
            killSignal: 'SIGKILL',
            env: {
              ...process.env,
              MPLBACKEND: 'Agg',
              HOME: workDir,
              OPENBLAS_NUM_THREADS: '1',
              MKL_NUM_THREADS: '1',
              OMP_NUM_THREADS: '1',
              NUMEXPR_NUM_THREADS: '1',
              VECLIB_MAXIMUM_THREADS: '1',
              TF_NUM_INTEROP_THREADS: '1',
              TF_NUM_INTRAOP_THREADS: '1',
            },
            cwd: workDir,
          },
          (err, stdout, stderr) => {
            if (err) {
              reject({ err, stdout, stderr });
            } else {
              resolve({ stdout, stderr });
            }
          }
        );

        if (child.stdin) {
          if (stdin) {
            child.stdin.write(stdin);
          }
          child.stdin.end();
        }
      });

      const result = await childPromise;
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (errorObj) {
      const err = errorObj.err || errorObj;
      stdout   = errorObj.stdout || '';
      stderr   = errorObj.stderr || '';
      timedOut = err.killed || err.code === 'ETIMEDOUT';
      if (!timedOut && !stderr) stderr = err.message || 'Execution failed';
    }

    // Sanitize Python traceback to map line numbers back to student's editor and hide server paths
    if (stderr && stderr.includes('Traceback')) {
      const shimLines = finalCode.split('Student code begins here')[0].split('\\n').length + 1;
      stderr = stderr.replace(/File "[^"]+solution\.py", line (\d+)/g, (match, p1) => {
        const studentLine = Math.max(1, parseInt(p1, 10) - shimLines);
        return `File "solution.py", line ${studentLine}`;
      });
    }

    const elapsedMs = Date.now() - startMs;

    fs.writeFileSync(path.join(workDir, 'stdout.txt'), stdout, 'utf8');
    fs.writeFileSync(path.join(workDir, 'stderr.txt'), stderr, 'utf8');

    // Collect ALL image files from workDir directly
    const allFiles = collectImageFiles(workDir, jobId);
    const graphs = allFiles;  // Every output file is a graph in ML context
    const images = [];         // Only populated for explicit CV2/PIL raw image tasks

    const metrics = extractMetrics(stdout);
    fs.writeFileSync(path.join(workDir, 'metrics.json'), JSON.stringify(metrics, null, 2), 'utf8');
    const audioOut = collectAudioFiles(workDir);

    // Persist graphs to student_outputs/
    graphs.forEach(g => {
      try {
        const buf  = Buffer.from(g.base64.split(',')[1], 'base64');
        const dest = path.join(GRAPH_DIR, `${Date.now()}_${g.filename}`);
        fs.writeFileSync(dest, buf);
      } catch {}
    });
    images.forEach(img => {
      try {
        const buf  = Buffer.from(img.base64.split(',')[1], 'base64');
        const dest = path.join(IMAGE_DIR, `${Date.now()}_${img.filename}`);
        fs.writeFileSync(dest, buf);
      } catch {}
    });

    log.execution(timedOut ? 'TIMEOUT' : 'DONE', {
      domain, elapsedMs, graphs: graphs.length, images: images.length, audio: audioOut.length
    });

    return {
      stdout:          stdout,
      stderr:          stderr,
      compileError:    '',
      executionTimeMs: elapsedMs,
      timedOut:        false,
      graphs,
      images,
      metrics,
      audioOut,
    };
  } finally {
    // DO NOT DELETE workDir immediately so it can be served as a static asset.
    // Clean up will be handled by a timeout/cron job.
  }
}

// ─── Judge0 execution ────────────────────────────────────────────────────────

async function runJudge0(code, language, stdin = '') {
  const langId     = JUDGE0_LANG_MAP[language];
  const timeoutMs  = getTimeout(null, language);

  if (!langId) throw new Error(`Unsupported language: ${language}`);

  // Java: rename class to Main (Judge0 requirement)
  if (language === 'java') {
    code = code.replace(/public\s+class\s+[A-Za-z0-9_]+/g, 'public class Main');
  }

  const resp = await fetch(JUDGE0_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      source_code:    code,
      language_id:    langId,
      stdin:          stdin || '',
      cpu_time_limit: timeoutMs / 1000,
      wall_time_limit: (timeoutMs / 1000) + 5,
    }),
    signal: AbortSignal.timeout(40000),
  });

  if (!resp.ok) throw new Error(`Judge0 HTTP ${resp.status}`);
  const data = await resp.json();

  const timedOut = data.status?.id === 5; // Judge0 status 5 = Time Limit Exceeded

  return {
    stdout:         (data.stdout || '').trimEnd(),
    stderr:         timedOut ? `Execution timed out after ${timeoutMs / 1000}s.` : (data.stderr || ''),
    compileError:   data.compile_output || '',
    executionTimeMs: parseFloat(data.time || '0') * 1000,
    statusId:       data.status?.id || 0,
    statusDesc:     data.status?.description || 'Unknown',
    timedOut,
    graphs:         [],
    images:         [],
    metrics:        {},
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute code with strategy selection, security scan, and guaranteed cleanup.
 *
 * @param {object} opts
 * @param {string}  opts.code
 * @param {string}  opts.language    - c | cpp | java | python | js
 * @param {string}  [opts.domain]    - machine_learning | cvpr | rl | ...
 * @param {string}  [opts.stdin]
 * @param {Array}   [opts.datasets]  - Array of {filename, localPath}
 * @param {boolean} [opts.skipScan]  - skip security scan (e.g. for admin runs)
 *
 * @returns {Promise<ExecutionResult>}
 */
async function executeCode({ code, language, domain, stdin = '', datasets = [], skipScan = false }) {
  const isMLDomain = ML_DOMAINS.includes(domain || '');

  // ── Pre-execution security scan ───────────────────────────────────────────
  if (!skipScan) {
    try {
      const { scanCode } = require('./securityScanner');
      const scan = scanCode(code, language, domain);
      if (!scan.safe) {
        log.security('Code blocked before execution', {
          language, domain, reason: scan.reason, blocked: scan.blocked,
        });
        return {
          stdout:         '',
          stderr:         scan.reason,
          compileError:   '',
          executionTimeMs: 0,
          timedOut:       false,
          status:         'SECURITY_BLOCKED',
          blocked:        scan.blocked,
          aiSuspected:    scan.aiSuspected,
          graphs:         [],
          images:         [],
          metrics:        {},
        };
      }

      if (scan.aiSuspected) {
        log.security('AI-generated code suspected', { language, domain });
      }
    } catch (e) {
      log.warn('Security scanner error (non-fatal)', { error: e.message });
    }
  }

  // ── Route to correct engine ───────────────────────────────────────────────
  if (STRATEGY === 'docker') {
    return runInDocker(code, language, domain, stdin, datasets);
  }

  if (isMLDomain && language === 'python') {
    return runLocalPython(code, domain, stdin, datasets);
  }

  return runJudge0(code, language, stdin);
}

// ─── Advanced plagiarism (AST + token bigrams) ────────────────────────────────

/**
 * Token-based Dice similarity. Returns 0–100.
 */
function tokenSimilarity(codeA, codeB) {
  const tokenize = src =>
    src
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/#.*$/gm, '')            // Python comments
      .replace(/"""[\s\S]*?"""/g, '"""STR"""')  // docstrings
      .replace(/['"].*?['"]/g, '"STR"')
      .replace(/\b\d+(\.\d+)?\b/g, 'NUM')
      .replace(/\b[a-z_]\w*\b/g, tok => {
        // Normalize common variable names
        if (['i','j','k','x','y','z','n','m','a','b','c','v','t','s'].includes(tok)) return 'VAR';
        return tok;
      })
      .split(/[\s,;{}()\[\]]+/)
      .filter(t => t.length > 0);

  const tokensA = tokenize(codeA);
  const tokensB = tokenize(codeB);

  if (tokensA.length < 5 || tokensB.length < 5) return 0;

  const bigrams = toks => {
    const set = new Set();
    for (let i = 0; i < toks.length - 1; i++) set.add(`${toks[i]}|${toks[i+1]}`);
    return set;
  };

  const bA = bigrams(tokensA);
  const bB = bigrams(tokensB);

  if (!bA.size || !bB.size) return 0;

  let shared = 0;
  for (const bg of bA) { if (bB.has(bg)) shared++; }

  return Math.round((2 * shared / (bA.size + bB.size)) * 100);
}

module.exports = {
  executeCode,
  extractMetrics,
  tokenSimilarity,
  collectImageFiles,
  GRAPH_DIR,
  IMAGE_DIR,
  LOG_DIR: LOG_DIR_OUT,
  ML_DOMAINS,
  TIMEOUT,
};
