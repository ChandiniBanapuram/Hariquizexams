#!/usr/bin/env node
/**
 * install_ml_deps.js  (v4 — venv strategy)
 * Creates a dedicated Python venv at backend/ml-venv and installs all ML packages.
 * Using a venv is immune to PEP 668, system Python overrides, and Render venv conflicts.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const VENV_DIR   = path.join(__dirname, 'ml-venv');
const VENV_PY    = process.platform === 'win32'
  ? path.join(VENV_DIR, 'Scripts', 'python.exe')
  : path.join(VENV_DIR, 'bin', 'python');
const CONFIG_FILE = path.join(__dirname, '.ml-python-path');

function run(bin, args, ms = 10000) {
  try {
    const r = spawnSync(bin, args, { timeout: ms, encoding: 'utf8', stdio: 'pipe' });
    return { ok: r.status === 0, out: (r.stdout || r.stderr || '').trim() };
  } catch (e) { return { ok: false, out: e.message }; }
}

// ── Get Python version ────────────────────────────────────────────────────────
function pyVersion(bin, extraArgs = []) {
  const r = run(bin, [...extraArgs, '--version']);
  if (!r.ok) return null;
  const m = r.out.match(/Python (\d+\.\d+)/);
  return m ? m[1] : null;
}

function tfCompatible(ver) {
  if (!ver) return false;
  const minor = parseInt((ver.split('.')[1] || '0'));
  return parseInt(ver) === 3 && minor >= 8 && minor <= 13;
}

// ── Find system Python suitable for creating a venv ───────────────────────────
function findSystemPython() {
  const candidates = [
    // User-configured
    ...(process.env.PYTHON_BIN
      ? [[process.env.PYTHON_BIN, ...(process.env.PYTHON_ARGS ? [process.env.PYTHON_ARGS] : [])]]
      : []),
    // Linux system (check BEFORE PATH — Render's venv overrides PATH)
    ['/usr/bin/python3.13'],
    ['/usr/bin/python3.12'],
    ['/usr/bin/python3.11'],
    ['/usr/bin/python3.10'],
    ['/usr/local/bin/python3.13'],
    ['/usr/local/bin/python3.12'],
    ['/usr/local/bin/python3.11'],
    ['/usr/local/bin/python3.10'],
    // Render pyenv locations
    ['/root/.pyenv/shims/python3.13'],
    ['/root/.pyenv/shims/python3.12'],
    ['/root/.pyenv/shims/python3.11'],
    ['/root/.pyenv/shims/python3.10'],
    ['/opt/render/project/.pyenv/shims/python3.13'],
    ['/opt/render/project/.pyenv/shims/python3.12'],
    ['/opt/render/project/.pyenv/shims/python3.11'],
    // Windows py launcher
    ['py', '-3.13'], ['py', '-3.12'], ['py', '-3.11'], ['py', '-3.10'],
    // PATH-based explicit versions
    ['python3.13'], ['python3.12'], ['python3.11'], ['python3.10'],
    // Fallback
    ['python3'], ['python'],
  ];

  for (const [bin, ...args] of candidates) {
    const ver = pyVersion(bin, args);
    if (!ver) continue;
    const minor = parseInt(ver.split('.')[1]);
    if (minor >= 8 && minor <= 13) {
      console.log(`✓ System Python ${ver}  →  ${[bin, ...args].join(' ')}`);
      return { bin, args, ver };
    }
    // Also allow newer versions for venv creation (packages install fine inside venv)
    if (minor >= 8) {
      console.log(`✓ Python ${ver}  →  ${[bin, ...args].join(' ')} (may not support TF)`);
      return { bin, args, ver };
    }
  }
  return null;
}

// ── Create or reuse venv ──────────────────────────────────────────────────────
function ensureVenv(bin, args) {
  if (fs.existsSync(VENV_PY)) {
    const ver = pyVersion(VENV_PY);
    console.log(`  Reusing existing venv: Python ${ver} at ${VENV_DIR}`);
    return true;
  }

  console.log(`  Creating venv at ${VENV_DIR} ...`);
  const r = run(bin, [...args, '-m', 'venv', VENV_DIR], 60000);
  if (!r.ok) {
    console.log(`  venv creation failed: ${r.out}`);
    return false;
  }

  const ver = pyVersion(VENV_PY);
  console.log(`  Venv created: Python ${ver} ✓`);
  return true;
}

// ── Upgrade pip inside venv ───────────────────────────────────────────────────
function upgradePip() {
  const r = run(VENV_PY, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip'], 60000);
  const ver = run(VENV_PY, ['-m', 'pip', '--version']);
  console.log(`  ${ver.out.split('\n')[0]}\n`);
}

// ── Install one package into venv ─────────────────────────────────────────────
function installPkg(pkg) {
  const r = spawnSync(
    VENV_PY,
    ['-m', 'pip', 'install', '--quiet', '--no-cache-dir', '--prefer-binary', pkg],
    { timeout: 300000, encoding: 'utf8', stdio: 'pipe' }
  );
  const err = (r.stderr || '').trim().split('\n').pop() || '';
  return { ok: r.status === 0, err };
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('\n🐍 Setting up ML Python venv...\n');

  // Find a suitable system Python to create the venv
  const sys = findSystemPython();
  if (!sys) {
    console.log('⚠  No Python found — ML execution disabled.\n');
    process.exit(0);
  }

  // Create venv
  if (!ensureVenv(sys.bin, sys.args)) {
    console.log('⚠  Could not create venv — trying fallback install.\n');
    process.exit(0);
  }

  // Upgrade pip inside venv
  upgradePip();

  // Persist the venv python path so the execution engine can find it
  fs.writeFileSync(CONFIG_FILE, VENV_PY, 'utf8');
  console.log(`  Python path saved → ${CONFIG_FILE}\n`);

  // Load requirements
  const reqFile = path.join(__dirname, 'requirements.txt');
  if (!fs.existsSync(reqFile)) {
    console.log('⚠  requirements.txt not found.\n');
    process.exit(0);
  }

  const packages = fs.readFileSync(reqFile, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  console.log(`📦 Installing ${packages.length} packages into venv...\n`);

  let ok = 0, fail = 0;
  const failed = [];

  for (const pkg of packages) {
    process.stdout.write(`  ${pkg.padEnd(32)} `);
    const res = installPkg(pkg);
    if (res.ok) { console.log('✓'); ok++; }
    else {
      console.log('✗');
      const lastErr = res.err.replace(/\n/g, ' ').slice(0, 120);
      if (lastErr) console.log(`    ↳ ${lastErr}`);
      fail++;
      failed.push(pkg);
    }
  }

  console.log(`\n✅ Done: ${ok} installed, ${fail} failed.`);
  if (failed.length) console.log(`⚠  Failed: ${failed.join(', ')}`);
  console.log(`\n🐍 Venv Python: ${VENV_PY}\n`);
}

main();
