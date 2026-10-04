import { request } from '../lib/api/client.js';

/** Exchange a Google ID token for our own JWT. @param {{ credential: string }} body @returns {Promise<import('../lib/api/types.js').AuthResponse>} */
export const signIn = (body, options = {}) => request('/auth/google', { ...options, method: 'POST', body });
/** Link Google to the signed-in password account. @param {{ credential: string }} body */
export const link = (body, options = {}) => request('/auth/google/link', { ...options, method: 'POST', body, auth: 'required' });

export default { signIn, link };
