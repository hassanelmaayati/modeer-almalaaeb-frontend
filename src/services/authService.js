import { request } from '../lib/api/client.js';

/** @param {import('../lib/api/types.js').SignupInput} body @returns {Promise<import('../lib/api/types.js').AuthResponse>} */
export const signUp = (body, options = {}) => request('/auth/signup', { ...options, method: 'POST', body });
/** @param {import('../lib/api/types.js').LoginInput} body @returns {Promise<import('../lib/api/types.js').AuthResponse>} */
export const signIn = (body, options = {}) => request('/auth/login', { ...options, method: 'POST', body });
/** Revoke all current user's tokens. The session provider owns local token storage. */
export const logout = (options = {}) => request('/auth/logout', { ...options, method: 'POST', auth: 'required' });

export default { signUp, signIn, logout };
