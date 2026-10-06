import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { root, offlineEnvironment, validateBrowserReport, validateDependencies, validateManifest, validateUnitModules, UnitCompletionReporter, main, reportPolicies } from '../offline-runner.mjs';

function report(policy = reportPolicies.production) {
  const suites = Object.entries(policy).flatMap(([project, files]) => files.map((file, index) => ({ file, specs: [{ id: `${project}-${index}`, file, ok: true, tests: [{ projectName: project, expectedStatus: 'passed', status: 'expected', annotations: [], results: [{ status: 'passed', retry: 0, errors: [], annotations: [] }] }] }] })));
  return { suites, errors: [], stats: { expected: suites.length, skipped: 0, flaky: 0, unexpected: 0 } };
}

test('accepts complete production and proxy reports for every required browser/file pair', () => {
  for (const policy of Object.values(reportPolicies)) {
    const complete = report(policy);
    const planned = structuredClone(complete);
    for (const suite of planned.suites) suite.specs[0].tests[0].results = [];
    assert.equal(validateBrowserReport(complete, planned, policy), complete.stats.expected);
  }
});

const invalidReports = [
  ['zero tests', value => { value.suites = []; value.stats.expected = 0; }],
  ['missing suite evidence', value => { delete value.suites; }],
  ['missing stats', value => { delete value.stats; }],
  ['missing skip count', value => { delete value.stats.skipped; }],
  ['non-numeric test count', value => { value.stats.expected = String(value.stats.expected); }],
  ['skipped', value => { value.stats.skipped = 1; }],
  ['flaky', value => { value.stats.flaky = 1; }],
  ['unexpected failure', value => { value.stats.unexpected = 1; }],
  ['runner error', value => { value.errors = [{ message: 'server never started' }]; }],
  ['missing runner errors', value => { delete value.errors; }],
  ['partial file', value => { value.suites.pop(); }],
  ['different scenario', value => { value.suites[0].specs[0].id = 'another-test'; }],
  ['duplicate scenario', value => { value.suites.push(structuredClone(value.suites[0])); }],
  ['missing scenario id', value => { delete value.suites[0].specs[0].id; }],
  ['no passed result', value => { value.suites[0].specs[0].tests[0].results = []; }],
  ['retry', value => { value.suites[0].specs[0].tests[0].results[0].retry = 1; }],
  ['multiple attempts', value => { value.suites[0].specs[0].tests[0].results.push({ status: 'passed', retry: 1, errors: [] }); }],
  ['expected failure', value => { value.suites[0].specs[0].tests[0].expectedStatus = 'failed'; }],
  ['timeout', value => { value.suites[0].specs[0].tests[0].results[0].status = 'timedOut'; }],
  ['test error', value => { value.suites[0].specs[0].tests[0].results[0].errors = [{ message: 'failure' }]; }],
  ['failed spec', value => { value.suites[0].specs[0].ok = false; }],
  ['skip annotation', value => { value.suites[0].specs[0].tests[0].annotations = [{ type: 'skip' }]; }],
  ['fixme result annotation', value => { value.suites[0].specs[0].tests[0].results[0].annotations = [{ type: 'fixme' }]; }],
];
for (const [name, mutate] of invalidReports) test(`fails closed for ${name} despite a zero exit code`, () => {
  const complete = report(); const changed = structuredClone(complete); mutate(changed);
  assert.throws(() => validateBrowserReport(changed, complete, reportPolicies.production), /Browser|browser/);
});

test('rejects collection narrowed to smoke tests or missing a required browser', () => {
  for (const missing of ['integration.spec.js', 'journeys.spec.js', 'webkit']) {
    const narrowed = report();
    narrowed.suites = narrowed.suites.filter(suite => suite.file !== missing && suite.specs[0].tests[0].projectName !== missing);
    narrowed.stats.expected = narrowed.suites.length;
    assert.throws(() => validateBrowserReport(narrowed, narrowed, reportPolicies.production), /Required browser scenarios missing/);
  }
});

test('checks nested suites and every collected scenario within the same file', () => {
  const complete = report();
  const additional = structuredClone(complete.suites[0].specs[0]); additional.id = 'second-scenario';
  complete.suites[0].suites = [{ specs: [additional] }]; complete.stats.expected++;
  assert.equal(validateBrowserReport(complete, complete, reportPolicies.production), 6);
  const missing = structuredClone(complete); delete missing.suites[0].suites;
  assert.throws(() => validateBrowserReport(missing, complete, reportPolicies.production), /all collected tests/);
});

test('isolates child environments from production secrets, proxies, Vite extras and Node injection', () => {
  const env = offlineEnvironment({ PATH: '/bin', HOME: '/home/test', MODEER_TEST_PG_BIN: '/local/postgres', MODEER_TEST_PYTHON: '/local/python', MODEER_BACKEND_PATH: '/production', MODEER_TEST_ENV_DIR: '/production', DATABASE_URL: 'production', JWT_SECRET: 'secret', VITE_OTHER_SECRET: 'secret', HTTPS_PROXY: 'proxy', NO_PROXY: 'anything', NODE_OPTIONS: '--require=unsafe', VITE_API_BASE_URL: 'https://production', CI: 'true' }, '/test/backend', '/empty/env');
  assert.equal(env.PATH, '/bin'); assert.equal(env.HOME, '/home/test'); assert.equal(env.CI, 'true');
  assert.equal(env.MODEER_BACKEND_PATH, '/test/backend'); assert.equal(env.MODEER_TEST_ENV_DIR, '/empty/env');
  assert.equal(env.VITE_API_BASE_URL, '/api/v1'); assert.equal(env.VITE_API_PROXY_TARGET, 'http://127.0.0.1:8001');
  assert.equal(env.MODEER_TEST_PYTHON, '/local/python'); assert.equal(env.MODEER_TEST_PG_BIN, '/local/postgres');
  assert.match(env.NODE_OPTIONS, /^--import=file:.*deny-outbound\.mjs$/);
  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'VITE_OTHER_SECRET', 'HTTPS_PROXY', 'NO_PROXY']) assert.equal(env[key], undefined, key);
  assert.equal(env.PIPENV_DONT_LOAD_ENV, '1'); assert.equal(env.VITE_GOOGLE_CLIENT_ID, '');
});

function dependencies(t, mutate) {
  const directory = mkdtempSync(path.join(tmpdir(), 'modeer-lock-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const declared = { dependencies: { '@local/package': '^1.0.0' }, devDependencies: { tool: '2.0.0' } };
  const lock = { packages: { '': structuredClone(declared), 'node_modules/@local/package': { version: '1.0.2' }, 'node_modules/tool': { version: '2.0.0' } } };
  for (const [name, version] of [['@local/package', '1.0.2'], ['tool', '2.0.0']]) {
    mkdirSync(path.join(directory, 'node_modules', name), { recursive: true });
    writeFileSync(path.join(directory, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
  }
  mutate?.({ directory, declared, lock });
  writeFileSync(path.join(directory, 'package.json'), JSON.stringify(declared));
  writeFileSync(path.join(directory, 'package-lock.json'), JSON.stringify(lock));
  return directory;
}
test('requires installed scoped/runtime/dev package versions to match their lock entries', t => {
  assert.doesNotThrow(() => validateDependencies(dependencies(t)));
});
test('rejects lockfile drift before running checks or attempting downloads', t => {
  const directory = dependencies(t, ({ lock }) => { lock.packages[''].devDependencies.tool = '3.0.0'; });
  assert.throws(() => validateDependencies(directory), /Lockfile does not match tool/);
});
test('rejects a missing installed package instead of silently installing it', t => {
  const directory = dependencies(t, ({ directory: fixture }) => { rmSync(path.join(fixture, 'node_modules', '@local', 'package'), { recursive: true }); });
  assert.throws(() => validateDependencies(directory), /Missing dependency @local\/package/);
});
test('rejects stale installed packages despite matching declared dependency ranges', t => {
  const directory = dependencies(t, ({ lock }) => { lock.packages['node_modules/tool'].version = '2.1.0'; });
  assert.throws(() => validateDependencies(directory), /Installed dependency tool differs/);
});
test('rejects lockfiles with no resolved dependency entry', t => {
  const directory = dependencies(t, ({ lock }) => { delete lock.packages['node_modules/tool']; });
  assert.throws(() => validateDependencies(directory), /Installed dependency tool differs/);
});
test('unknown runner modes fail before environment creation or prerequisite commands', async () => {
  await assert.rejects(main('empty'), /Unknown offline mode/);
});

test('the committed test inventory contains all current required unit and offline fixture files', () => {
  const manifest = validateManifest();
  assert.deepEqual(manifest.unit.toSorted(), readdirSync(path.join(root, 'tests', 'unit')).filter(name => /\.test\.(js|jsx)$/.test(name)).map(name => `tests/unit/${name}`).toSorted());
  for (const file of ['tests/e2e/integration.spec.js', 'tests/e2e/journeys.spec.js', 'tests/e2e/realtime.spec.js', 'tests/e2e/smoke.spec.js']) assert.ok(manifest.fixtures.includes(file));
});

function inventory(t, mutate) {
  const directory = mkdtempSync(path.join(tmpdir(), 'modeer-manifest-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const manifest = { unit: ['tests/unit/example.test.js'], fixtures: ['tests/setup.js'] };
  mkdirSync(path.join(directory, 'scripts'), { recursive: true });
  mkdirSync(path.join(directory, 'tests', 'unit'), { recursive: true });
  writeFileSync(path.join(directory, manifest.unit[0]), ''); writeFileSync(path.join(directory, manifest.fixtures[0]), '');
  mutate?.(manifest, directory);
  writeFileSync(path.join(directory, 'scripts', 'test-manifest.json'), JSON.stringify(manifest));
  return directory;
}
for (const [name, mutate] of [
  ['unit module missing', (manifest, directory) => rmSync(path.join(directory, manifest.unit[0]))],
  ['fixture missing', (manifest, directory) => rmSync(path.join(directory, manifest.fixtures[0]))],
  ['a directory replacing a file', (manifest, directory) => { rmSync(path.join(directory, manifest.unit[0])); mkdirSync(path.join(directory, manifest.unit[0])); }],
  ['empty unit inventory', manifest => { manifest.unit = []; }],
  ['empty fixture inventory', manifest => { manifest.fixtures = []; }],
  ['duplicate inventory entries', manifest => { manifest.unit.push(manifest.unit[0]); }],
  ['path escaping the checkout', manifest => { manifest.fixtures.push('../production.env'); }],
  ['wrong unit filename', manifest => { manifest.unit = ['tests/setup.js']; }],
]) test(`prerequisites fail closed with ${name}`, t => {
  assert.throws(() => validateManifest(inventory(t, mutate)), /Required test file missing|Test manifest/);
});

function unitModule() {
  return {
    relativeModuleId: 'tests/unit/example.test.js', state: () => 'passed', errors: () => [],
    children: [{ type: 'suite', children: [{ type: 'test', name: 'scenario', result: () => ({ state: 'passed' }), diagnostic: () => ({ retryCount: 0, flaky: false }) }] }],
  };
}
const unitManifest = { unit: ['tests/unit/example.test.js'] };
test('requires each inventory unit module and accepts nested completed test cases', () => {
  assert.deepEqual(validateUnitModules([unitModule()], unitManifest), { success: true, tests: 1, files: { 'tests/unit/example.test.js': 1 } });
});
for (const [name, mutate] of [
  ['missing module', modules => { modules.length = 0; }],
  ['duplicate module', modules => { modules.push(unitModule()); }],
  ['unidentified module', modules => { delete modules[0].relativeModuleId; }],
  ['failed collection', modules => { modules[0].errors = () => [{ message: 'import failure' }]; }],
  ['uncompleted module', modules => { modules[0].state = () => 'pending'; }],
  ['no executed scenarios', modules => { modules[0].children = []; }],
  ['skipped scenario', modules => { modules[0].children[0].children[0].result = () => ({ state: 'skipped' }); }],
  ['pending scenario', modules => { modules[0].children[0].children[0].result = () => ({ state: 'pending' }); }],
  ['failed scenario', modules => { modules[0].children[0].children[0].result = () => ({ state: 'failed' }); }],
  ['retried scenario', modules => { modules[0].children[0].children[0].diagnostic = () => ({ retryCount: 1, flaky: false }); }],
  ['flaky scenario', modules => { modules[0].children[0].children[0].diagnostic = () => ({ retryCount: 0, flaky: true }); }],
  ['missing execution diagnostic', modules => { modules[0].children[0].children[0].diagnostic = () => undefined; }],
]) test(`unit completion rejects ${name}`, () => {
  const modules = [unitModule()]; mutate(modules);
  assert.throws(() => validateUnitModules(modules, unitManifest), /Unit|unit/);
});
test('unit completion fails interrupted runs and unhandled errors', () => {
  assert.throws(() => validateUnitModules([unitModule()], unitManifest, [], 'interrupted'), /Unit run failed/);
  assert.throws(() => validateUnitModules([unitModule()], unitManifest, [{ message: 'unhandled' }]), /Unit run failed/);
});
test('requires new unit modules to be added to the tracked inventory', t => {
  const directory = inventory(t, (_manifest, fixture) => { writeFileSync(path.join(fixture, 'tests', 'unit', 'new.test.js'), ''); });
  assert.throws(() => validateManifest(directory), /Unit module missing from test manifest/);
});
test('mandatory reporter emits failure evidence and sets a nonzero process exit code for skipped tests', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'modeer-reporter-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const reportFile = path.join(directory, 'unit-completion.json');
  const reporter = new UnitCompletionReporter(unitManifest, reportFile);
  const originalExitCode = process.exitCode; const originalConsoleError = console.error;
  try {
    console.error = () => {};
    const modules = [unitModule()]; modules[0].children[0].children[0].result = () => ({ state: 'skipped' });
    reporter.onTestRunEnd(modules, [], 'passed');
    assert.equal(process.exitCode, 1);
    assert.equal(JSON.parse(readFileSync(reportFile, 'utf8')).success, false);
  } finally { process.exitCode = originalExitCode; console.error = originalConsoleError; }
  reporter.onTestRunEnd([unitModule()], [], 'passed');
  assert.equal(JSON.parse(readFileSync(reportFile, 'utf8')).success, true);
});
