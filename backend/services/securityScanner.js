/**
 * backend/services/securityScanner.js
 *
 * Pre-execution code security scanner.
 * Blocks dangerous imports, system calls, and malicious patterns
 * before any code reaches the sandbox.
 *
 * Returns: { safe: boolean, reason: string, blocked: string[] }
 */
'use strict';

// ─── Blocked Python modules ─────────────────────────────────────────────────
const PYTHON_BLOCKED_MODULES = [
  'os',
  'sys',
  'subprocess',
  'socket',
  'shutil',
  'multiprocessing',
  'threading',
  'ctypes',
  'signal',
  'pty',
  'tty',
  'termios',
  'resource',
  'grp',
  'pwd',
  'nis',
  'posix',
  'fcntl',
  'winreg',
  'mmap',
  'pickle',
  'shelve',
  'importlib',
  '__import__',
  'exec',
  'compile',
  'open',          // File I/O outside workspace
];

// Allowed exceptions (needed for ML domains)
const PYTHON_ML_ALLOWLIST = [
  'os.path',       // allowed – path manipulation only
  'os.makedirs',   // allowed – needed by shim
  'os.getcwd',
  'os.listdir',
];

// ─── Blocked Python patterns ────────────────────────────────────────────────
const PYTHON_BLOCKED_PATTERNS = [
  /import\s+os\b(?!\s*\.\s*(path|makedirs|getcwd|listdir))/,  // os module (not os.path)
  /import\s+subprocess/,
  /import\s+socket/,
  /import\s+shutil/,
  /import\s+multiprocessing\b/,
  /from\s+os\s+import/,
  /from\s+subprocess\s+import/,
  /from\s+socket\s+import/,
  /from\s+shutil\s+import/,
  /from\s+ctypes\s+import/,
  /from\s+multiprocessing\s+import/,
  /__import__\s*\(/,
  /importlib\s*\.import_module/,
  /requests\s*\./,          // HTTP requests
  /urllib\s*\.request/,
  /http\.client/,
  /urllib3/,
  /aiohttp/,
  /httpx/,
  /pycurl/,
  /(?<!\.)\bexec\s*\(/,
  /(?<!\.)\bcompile\s*\(/,
  /os\.system\s*\(/,
  /os\.popen\s*\(/,
  /os\.spawn/,
  /os\.exec/,
  /os\.fork\s*\(/,
  /subprocess\.run/,
  /subprocess\.Popen/,
  /subprocess\.call/,
  /subprocess\.check_output/,
];

// ─── Blocked Java patterns ───────────────────────────────────────────────────
const JAVA_BLOCKED_PATTERNS = [
  /Runtime\s*\.\s*getRuntime\s*\(\s*\)/,
  /ProcessBuilder/,
  /System\s*\.\s*exit\s*\(/,
  /java\.net\./,
  /java\.io\.File/,
  /new\s+File\s*\(/,
  /FileWriter/,
  /FileReader/,
  /Socket\s*\(/,
  /ServerSocket/,
  /java\.lang\.reflect/,
  /Class\.forName/,
  /ClassLoader/,
  /SecurityManager/,
  /java\.nio\./,
];

// ─── Blocked C/C++ patterns ──────────────────────────────────────────────────
const C_BLOCKED_PATTERNS = [
  /system\s*\(/,
  /popen\s*\(/,
  /exec[lv]?\s*\(/,
  /fork\s*\(\s*\)/,
  /#include\s*<sys\/socket\.h>/,
  /#include\s*<netinet\/in\.h>/,
  /#include\s*<arpa\/inet\.h>/,
  /socket\s*\(/,
  /connect\s*\(/,
  /bind\s*\(/,
  /dlopen\s*\(/,
  /dlsym\s*\(/,
];

// ─── Heuristic: AI-generated code detection ──────────────────────────────────
const AI_SIGNATURES = [
  // Very common GPT-4 / Claude comment patterns
  /\/\/ Sure,? here's?/i,
  /\/\/ Of course,? here's?/i,
  /\/\/ This code/i,
  /#\s*Here's?.*implementation/i,
  /#\s*This script/i,
  /#\s*Step \d+:/i,
  /\/\*\s*Sure,? here's?/i,
  /\/\*\s*This is an implementation/i,
  // Unnaturally comprehensive docstrings for exam questions
  /\"\"\"\s*This function.{200,}/s,
];

// ─── Main scanner ────────────────────────────────────────────────────────────

/**
 * Scan code for security violations before execution.
 *
 * @param {string} code       – Source code string
 * @param {string} language   – 'python' | 'java' | 'c' | 'cpp' | 'js'
 * @param {string} [domain]   – ML domain (some imports allowed)
 * @param {object} [opts]
 * @param {boolean} [opts.checkAI=false] – Flag AI-generated code (soft warning)
 *
 * @returns {{ safe: boolean, status: string, reason: string, blocked: string[], aiSuspected: boolean }}
 */
function scanCode(code, language, domain = null, opts = {}) {
  const blocked = [];
  let aiSuspected = false;

  const isMLDomain = ['machine_learning', 'data_science', 'cvpr', 'reinforcement_learning'].includes(domain || '');
  const lang = (language || '').toLowerCase();

  // ── Python checks ──────────────────────────────────────────────────────────
  if (lang === 'python') {
    for (const pattern of PYTHON_BLOCKED_PATTERNS) {
      if (pattern.test(code)) {
        // Skip if it's a shim-injected line (starts with _)
        const match = code.match(pattern);
        if (match) {
          const linesBefore = code.substring(0, code.search(pattern)).split('\n');
          const lineNum = linesBefore.length;
          const lineContent = code.split('\n')[lineNum - 1] || '';

          // Allow _patched_ / shim lines
          if (lineContent.trim().startsWith('#') || lineContent.trim().startsWith('_')) continue;

          // Allow os.path usage in ML mode
          if (isMLDomain && /import\s+os\.path/.test(lineContent)) continue;
          if (isMLDomain && /os\.(makedirs|getcwd|path|listdir)/.test(lineContent)) continue;

          blocked.push(`Blocked pattern: ${pattern.toString().substring(0, 60)}`);
        }
      }
    }

    // Extra: block requests/urllib specifically
    if (/\brequests\b/.test(code) && !isMLDomain) {
      blocked.push('Blocked: requests module (internet access denied)');
    }
  }

  // ── Java checks ───────────────────────────────────────────────────────────
  if (lang === 'java') {
    for (const pattern of JAVA_BLOCKED_PATTERNS) {
      if (pattern.test(code)) {
        blocked.push(`Blocked Java pattern: ${pattern.toString().substring(0, 60)}`);
      }
    }
  }

  // ── C/C++ checks ──────────────────────────────────────────────────────────
  if (lang === 'c' || lang === 'cpp') {
    for (const pattern of C_BLOCKED_PATTERNS) {
      if (pattern.test(code)) {
        blocked.push(`Blocked C/C++ pattern: ${pattern.toString().substring(0, 60)}`);
      }
    }
  }

  // ── Code size limit (prevent DoS via huge files) ──────────────────────────
  const MAX_CODE_BYTES = 128 * 1024; // 128KB
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    blocked.push('Code exceeds maximum allowed size (128 KB)');
  }

  // ── AI-generated code detection (soft, non-blocking) ─────────────────────
  if (opts.checkAI !== false) {
    for (const sig of AI_SIGNATURES) {
      if (sig.test(code)) {
        aiSuspected = true;
        break;
      }
    }

    // High comment-to-code ratio heuristic (>60% comment lines = suspicious)
    const lines = code.split('\n').filter(l => l.trim().length > 0);
    const commentLines = lines.filter(l => {
      const t = l.trim();
      return t.startsWith('#') || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
    });
    if (lines.length > 10 && commentLines.length / lines.length > 0.6) {
      aiSuspected = true;
    }
  }

  const safe = blocked.length === 0;

  return {
    safe,
    status: safe ? 'CLEAN' : 'SECURITY_BLOCKED',
    reason: blocked.length > 0
      ? `Security violation: ${blocked[0]}${blocked.length > 1 ? ` (+${blocked.length - 1} more)` : ''}`
      : 'Code passed security scan',
    blocked,
    aiSuspected,
  };
}

module.exports = { scanCode };
