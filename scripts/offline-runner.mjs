import process from 'node:process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
export const reportPolicies = {
  production: { chromium: ['integration.spec.js', 'journeys.spec.js', 'smoke.spec.js'], firefox: ['smoke.spec.js'], webkit: ['smoke.spec.js'] },
  proxy: { 'chromium-proxy': ['realtime.spec.js'] },
};

export function validateManifest(directory = root, manifestFile = path.join(directory, 'scripts', 'test-manifest.json')) {
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  for (const kind of ['unit', 'fixtures']) {
    const files = manifest[kind];
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length) throw new Error(`Test manifest ${kind} list is empty or invalid`);
    for (const file of files) {
      if (typeof file !== 'string' || path.isAbsolute(file) || file.split('/').includes('..') || (kind === 'unit' && !/^tests\/unit\/[^/]+\.test\.(js|jsx)$/.test(file))) throw new Error(`Test manifest contains an invalid path: ${file}`);
      const required = path.join(directory, file);
      if (!existsSync(required) || !statSync(required).isFile()) throw new Error(`Required test file missing: ${file}`);
    }
  }
  for (const name of readdirSync(path.join(directory, 'tests', 'unit'))) {
    if (/\.test\.(js|jsx)$/.test(name) && !manifest.unit.includes(`tests/unit/${name}`)) throw new Error(`Unit module missing from test manifest: ${name}`);
  }
  return manifest;
}

export function validateUnitModules(modules, manifest, errors = [], reason = 'passed') {
  if (reason !== 'passed' || errors.length) throw new Error('Unit run failed, was interrupted, or has unhandled errors');
  const completed = new Map();
  for (const module of modules) {
    const file = module.relativeModuleId?.replaceAll('\\', '/');
    if (!file || completed.has(file)) throw new Error('Unit run contains unidentified or duplicate modules');
    if (module.state() !== 'passed' || module.errors().length) throw new Error(`Unit module did not complete successfully: ${file}`);
    let count = 0;
    function visit(children) {
      for (const entity of children) {
        if (entity.type === 'test') {
          const diagnostic = entity.diagnostic();
          if (entity.result().state !== 'passed' || !diagnostic || diagnostic.retryCount !== 0 || diagnostic.flaky !== false) throw new Error(`Unit test did not pass without retries or skips: ${file}/${entity.name}`);
          count++;
        } else if (entity.type === 'suite') visit(entity.children);
        else throw new Error(`Unit module contains an unidentified test: ${file}`);
      }
    }
    visit(module.children);
    if (!count) throw new Error(`Unit module executed zero tests: ${file}`);
    completed.set(file, count);
  }
  for (const file of manifest.unit) if (!completed.has(file)) throw new Error(`Required unit module did not run: ${file}`);
  return { success: true, tests: [...completed.values()].reduce((sum, count) => sum + count, 0), files: Object.fromEntries(completed) };
}

export class UnitCompletionReporter {
  constructor(manifest, reportFile = path.join(root, 'tests', 'artifacts', 'unit-completion.json')) {
    this.manifest = manifest;
    this.reportFile = reportFile;
  }
  onTestRunEnd(modules, errors, reason) {
    let summary;
    try { summary = validateUnitModules(modules, this.manifest, errors, reason); }
    catch (error) {
      summary = { success: false, error: error.message };
      process.exitCode = 1;
      console.error(`\nMandatory unit completion failed: ${error.message}`);
    }
    mkdirSync(path.dirname(this.reportFile), { recursive: true });
    writeFileSync(this.reportFile, `${JSON.stringify(summary, null, 2)}\n`);
  }
}

export function offlineEnvironment(source, backend, envDir) {
  const keep = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PATHEXT', 'COMSPEC', 'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR', 'XDG_CACHE_HOME', 'PLAYWRIGHT_BROWSERS_PATH', 'CI', 'GITHUB_ACTIONS', 'MODEER_TEST_PYTHON', 'MODEER_TEST_PG_BIN'];
  const env = Object.fromEntries(keep.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
  return { ...env, PIPENV_DONT_LOAD_ENV: '1', PYTHONDONTWRITEBYTECODE: '1', VITE_API_BASE_URL: '/api/v1', VITE_API_PROXY_TARGET: 'http://127.0.0.1:8001', VITE_GOOGLE_CLIENT_ID: '', VERCEL: '', MODEER_BACKEND_PATH: backend, MODEER_TEST_ENV_DIR: envDir, NODE_OPTIONS: `--import=${pathToFileURL(path.join(root, 'scripts', 'deny-outbound.mjs')).href}` };
}

function run(command, args, env, cwd = root, capture = false) {
  console.log(`\nOffline check: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, env, ...(capture ? { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 } : { stdio: 'inherit' }) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Check failed (${result.status ?? result.signal}): ${command} ${args.join(' ')}${capture ? `\n${result.stderr || result.stdout}` : ''}`);
  return result.stdout;
}

function reportTests(report) {
  if (!Array.isArray(report?.suites)) throw new Error('Browser report has no suites');
  const tests = new Map();
  function visit(suite) {
    for (const spec of suite.specs || []) {
      const file = path.basename(String(spec.file || suite.file || '').replaceAll('\\', '/'));
      for (const test of spec.tests || []) {
        const project = test.projectName || test.projectId;
        if (!spec.id || !file || !project) throw new Error('Browser report contains an unidentified test');
        const key = `${project}:${file}:${spec.id}`;
        if (tests.has(key)) throw new Error(`Browser report repeats test ${key}`);
        tests.set(key, { spec, test, file, project });
      }
    }
    for (const child of suite.suites || []) visit(child);
  }
  for (const suite of report.suites) visit(suite);
  if (!tests.size) throw new Error('Browser report contains zero tests');
  return tests;
}

export function validateBrowserReport(report, planned, policy) {
  const expected = reportTests(planned);
  const actual = reportTests(report);
  for (const [project, files] of Object.entries(policy)) {
    for (const file of files) {
      if (![...expected.values()].some(test => test.project === project && test.file === file)) throw new Error(`Required browser scenarios missing: ${project}/${file}`);
    }
  }
  if (!Array.isArray(report.errors) || report.errors.length) throw new Error('Browser report contains runner errors or is incomplete');
  const stats = report.stats;
  if (!stats || stats.expected !== expected.size || ['skipped', 'unexpected', 'flaky'].some(key => stats[key] !== 0)) throw new Error('Browser report is empty, skipped, flaky, failed, or incomplete');
  if (actual.size !== expected.size || [...expected.keys()].some(key => !actual.has(key))) throw new Error('Browser report does not match all collected tests');
  for (const [key, { spec, test }] of actual) {
    if (spec.ok !== true || test.status !== 'expected' || test.expectedStatus !== 'passed' || test.results?.length !== 1
      || test.results[0].status !== 'passed' || test.results[0].retry !== 0 || !Array.isArray(test.results[0].errors) || test.results[0].errors.length
      || [...(test.annotations || []), ...(test.results[0].annotations || [])].some(annotation => ['skip', 'fixme'].includes(annotation.type))) throw new Error(`Browser scenario did not pass without retries or skips: ${key}`);
  }
  return actual.size;
}

export function validateDependencies(directory = root) {
  const lock = JSON.parse(readFileSync(path.join(directory, 'package-lock.json'), 'utf8'));
  const declared = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  for (const kind of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(declared[kind] || {})) {
      if (lock.packages?.['']?.[kind]?.[name] !== version) throw new Error(`Lockfile does not match ${name}. Update package-lock.json during setup.`);
      const packageFile = path.join(directory, 'node_modules', name, 'package.json');
      if (!existsSync(packageFile)) throw new Error(`Missing dependency ${name}. Run npm ci during setup; offline tests never install packages.`);
      const installed = JSON.parse(readFileSync(packageFile, 'utf8'));
      if (!lock.packages?.[`node_modules/${name}`]?.version || installed.version !== lock.packages[`node_modules/${name}`].version) throw new Error(`Installed dependency ${name} differs from the lockfile. Run npm ci during setup.`);
    }
  }
}

function pythonPath(env, backend) {
  if (env.MODEER_TEST_PYTHON) {
    const selected = path.resolve(env.MODEER_TEST_PYTHON);
    if (!existsSync(selected)) throw new Error(`MODEER_TEST_PYTHON does not exist: ${selected}`);
    return selected;
  }
  for (const candidate of [path.join(backend, '.venv', 'bin', 'python'), path.join(backend, '.venv', 'Scripts', 'python.exe')]) if (existsSync(candidate)) return candidate;
  const result = spawnSync('pipenv', ['--py'], { cwd: backend, env, encoding: 'utf8' });
  const resolved = result.stdout?.trim();
  if (result.status === 0 && resolved && existsSync(resolved)) return resolved;
  throw new Error('Backend Python environment missing. Install Python 3.14 and run pipenv sync --dev in the backend, or set MODEER_TEST_PYTHON.');
}

async function preflight(env, backend, mode) {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error(`Node 24 is required; current version is ${process.versions.node}. Run nvm use 24.`);
  if (!existsSync(path.join(backend, 'tests', 'postgres_cluster.py'))) throw new Error(`Backend checkout or PostgreSQL helper missing at ${backend}. Set MODEER_BACKEND_PATH.`);
  validateManifest();
  validateDependencies();
  env.MODEER_TEST_PYTHON = pythonPath(env, backend);
  run(env.MODEER_TEST_PYTHON, ['-c', "import sys\nassert sys.version_info[:2] == (3,14), 'Python 3.14 required'\nimport pytest, fastapi, sqlalchemy, geoalchemy2, uvicorn\nfrom tests.postgres_cluster import TemporaryPostgres\np=TemporaryPostgres()\ntry:\n p.start()\n print('Isolated PostgreSQL/PostGIS prerequisites ready')\nfinally:\n p.stop()"], env, backend);
  for (const [name, browserType] of Object.entries(mode === 'proxy' ? { chromium } : { chromium, firefox, webkit })) {
    const browser = await browserType.launch({ headless: true, env });
    await browser.close();
    console.log(`${name} prerequisite ready`);
  }
}

function browsers(kind, env) {
  const config = kind === 'production' ? 'tests/playwright.config.js' : 'tests/playwright.proxy.config.js';
  const reportFile = path.join(root, 'tests', 'artifacts', `${kind}-results.json`);
  rmSync(reportFile, { force: true });
  const args = ['node_modules/@playwright/test/cli.js', 'test', '--config', config];
  const planned = JSON.parse(run(process.execPath, [...args, '--list', '--reporter=json'], env, root, true));
  // Validate required projects and files before starting application servers.
  const collected = reportTests(planned);
  for (const [project, files] of Object.entries(reportPolicies[kind])) for (const file of files) {
    if (![...collected.values()].some(test => test.project === project && test.file === file)) throw new Error(`Required browser scenarios missing: ${project}/${file}`);
  }
  run(process.execPath, args, env);
  if (!existsSync(reportFile)) throw new Error(`Browser report missing: ${reportFile}`);
  const count = validateBrowserReport(JSON.parse(readFileSync(reportFile, 'utf8')), planned, reportPolicies[kind]);
  console.log(`${kind}: all ${count} collected browser scenarios passed.`);
}

export async function main(mode = process.argv[2] || 'all') {
  if (!['all', 'e2e', 'production', 'proxy', 'prerequisites'].includes(mode)) throw new Error(`Unknown offline mode: ${mode}`);
  const backend = path.resolve(process.env.MODEER_BACKEND_PATH || path.join(root, '..', 'modeer_backend'));
  const envDir = mkdtempSync(path.join(tmpdir(), 'modeer-empty-env-'));
  const env = offlineEnvironment(process.env, backend, envDir);
  try {
    mkdirSync(path.join(root, 'tests', 'artifacts'), { recursive: true });
    run(process.execPath, ['--test', 'scripts/tests/deny-outbound.test.mjs', 'scripts/tests/offline-runner.test.mjs'], env);
    await preflight(env, backend, mode);
    if (mode === 'prerequisites') return;
    if (mode === 'all') { run(npm, ['run', 'lint'], env); run(npm, ['run', 'test:unit:coverage'], env); }
    if (['all', 'e2e', 'production'].includes(mode)) { run(npm, ['run', 'build'], env); browsers('production', env); }
    if (['all', 'e2e', 'proxy'].includes(mode)) browsers('proxy', env);
    console.log(`\nOffline ${mode} checks passed. No package downloads or deployment commands were run.`);
  } finally { rmSync(envDir, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); }
  catch (error) { console.error(`\nOffline checks failed: ${error.message}`); process.exitCode = 1; }
}
