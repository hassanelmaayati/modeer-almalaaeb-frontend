import { clearToken, getToken } from '../helpers/session.js';

const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

/** HTTP or network failure, including FastAPI field validation errors. */
export class ApiError extends Error {
  constructor(message, { status = 0, detail = null, fieldErrors = {} } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
  }
}

function normalizeError(response, data) {
  const detail = data?.detail ?? null;
  const fieldErrors = {};
  let message = typeof detail === 'string' ? detail : '';
  if (Array.isArray(detail)) {
    const messages = detail.map((issue) => {
      const path = (issue.loc || []).filter((part) => !['body', 'query', 'path'].includes(part)).join('.');
      const explanation = issue.msg || 'Invalid value';
      if (path) fieldErrors[path] = explanation;
      return path ? `${path}: ${explanation}` : explanation;
    });
    message = messages.join('; ');
  }
  return new ApiError(message || `Request failed (${response.status}).`, {
    status: response.status,
    detail,
    fieldErrors,
  });
}

/**
 * Execute a JSON API request without changing response shapes or retrying mutations.
 * @param {string} path Resource path relative to /api/v1.
 * @param {{ method?: string, body?: unknown, query?: object, auth?: 'none'|'required'|'optional', signal?: AbortSignal }} options
 * @returns {Promise<unknown>} A backend object/array, or null for a 204 response.
 */
export async function request(path, { method = 'GET', body, query, auth = 'none', signal } = {}) {
  if (!['none', 'required', 'optional'].includes(auth)) throw new TypeError('Unknown authentication mode.');
  const token = auth === 'none' ? null : getToken();
  if (auth === 'required' && !token) {
    throw new ApiError('Please sign in to continue.', { status: 401 });
  }
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    parameters.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const suffix = parameters.size ? `?${parameters}` : '';
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}/${path.replace(/^\/+/, '')}${suffix}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error;
    throw new ApiError('Unable to reach the server. Please try again.');
  }

  if (response.status === 401 && token && getToken() === token) clearToken();
  if (response.status === 204) return null;
  let data;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error;
    if (!response.ok) throw normalizeError(response, null);
    throw new ApiError('The server returned an unreadable response.', { status: response.status });
  }
  if (!response.ok) throw normalizeError(response, data);
  return data;
}
