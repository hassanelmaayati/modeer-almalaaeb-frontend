// Run before the app and its styles load. Keep this external for the site's script-src 'self' policy.
(() => {
  let preference = null;
  try {
    const saved = window.localStorage.getItem('modeer-theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch { /* A blocked storage area still allows the device theme. */ }
  const theme = preference || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#001e2b' : '#14594a');
})();
