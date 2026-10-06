import path from 'node:path';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
export const frontend = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const backend = path.resolve(process.env.MODEER_BACKEND_PATH || path.join(frontend, '..', 'modeer_backend'));
function discoverPython() {
  if (process.env.MODEER_TEST_PYTHON) return process.env.MODEER_TEST_PYTHON;
  const inProject = path.join(backend, '.venv', 'bin', 'python');
  if (existsSync(inProject)) return inProject;
  try { return execFileSync('pipenv', ['--py'], { cwd: backend, env: { ...process.env, PIPENV_DONT_LOAD_ENV: '1' }, encoding: 'utf8' }).trim(); }
  catch { throw new Error('Set MODEER_TEST_PYTHON or install the backend Pipenv environment first.'); }
}
export const python = discoverPython();
export const servers = (production = true) => [
  { command: `"${python}" "${path.join(frontend, 'tests/isolated_backend.py')}"`, url: 'http://127.0.0.1:8001/health', env: { PYTHONDONTWRITEBYTECODE: '1', PIPENV_DONT_LOAD_ENV: '1', MODEER_BACKEND_PATH: backend }, gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 }, reuseExistingServer: false, timeout: 60_000 },
  { command: `npm run ${production ? 'preview' : 'dev'} -- --host 127.0.0.1 --port 5174 --strictPort`, cwd: frontend, url: 'http://127.0.0.1:5174', env: { VITE_API_PROXY_TARGET: 'http://127.0.0.1:8001', VITE_API_BASE_URL: '/api/v1', VITE_GOOGLE_CLIENT_ID: '', VERCEL: '' }, gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 }, reuseExistingServer: false, timeout: 60_000 },
];
