// Empty when the env var is missing; Google UI then hides itself so the app still runs.
export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';

export function googleErrorMessage(error) {
  // 409: an account with this email already exists with a password and is not linked yet.
  if (error?.status === 409) return 'Sign in with your password, then link Google from your Profile.';
  return error?.message || 'Google sign-in failed. Please try again.';
}
