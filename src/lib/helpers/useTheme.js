import { useEffect, useLayoutEffect, useState } from 'react';
import { applyTheme, readThemePreference, themePreference, THEME_KEY, THEME_QUERY } from './theme';

// The header stays mounted across navigation and account changes, so this preference belongs to the browser.
export default function useTheme() {
  const [media] = useState(() => window.matchMedia?.(THEME_QUERY));
  const [state, setState] = useState(() => {
    const preference = readThemePreference();
    return { preference, theme: preference || (media?.matches ? 'dark' : 'light') };
  });

  useLayoutEffect(() => { applyTheme(state.theme); }, [state.theme]);

  useEffect(() => {
    const systemChanged = event => setState(current => current.preference ? current : {
      preference: null, theme: event.matches ? 'dark' : 'light',
    });
    const storageChanged = event => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      // Ignore sessionStorage events. Accessing localStorage itself can throw in privacy modes.
      if (event.storageArea) {
        try { if (event.storageArea !== window.localStorage) return; }
        catch { return; }
      }
      const preference = event.key === null ? null : themePreference(event.newValue);
      setState({ preference, theme: preference || (media?.matches ? 'dark' : 'light') });
    };
    if (media?.addEventListener) media.addEventListener('change', systemChanged);
    else media?.addListener?.(systemChanged);
    window.addEventListener('storage', storageChanged);
    return () => {
      if (media?.removeEventListener) media.removeEventListener('change', systemChanged);
      else media?.removeListener?.(systemChanged);
      window.removeEventListener('storage', storageChanged);
    };
  }, [media]);

  function toggleTheme() {
    const theme = state.theme === 'dark' ? 'light' : 'dark';
    try { window.localStorage.setItem(THEME_KEY, theme); }
    catch { /* Keep the explicit choice in memory when persistence is unavailable. */ }
    setState({ preference: theme, theme });
  }

  return { dark: state.theme === 'dark', toggleTheme };
}
