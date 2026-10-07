export const THEME_KEY = 'modeer-theme';
export const THEME_QUERY = '(prefers-color-scheme: dark)';

export function themePreference(value) {
  return value === 'light' || value === 'dark' ? value : null;
}

export function readThemePreference() {
  try { return themePreference(window.localStorage.getItem(THEME_KEY)); }
  catch { return null; }
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#001e2b' : '#14594a');
}
