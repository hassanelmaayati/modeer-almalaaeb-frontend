// Page blocks whose entrance animation replays every time the visitor scrolls back to them.
const TARGETS = '.home-hero, .sports-banner, .home-section, .room-step, .panel, .bracket';
const NEAR = 0.12;

/**
 * Marks each block with `mo` (its resting, not-yet-shown state) and toggles `is-inview` while it is on screen,
 * so the CSS in motion.css can replay its animation each time the block comes back into view.
 * Does nothing for people who prefer reduced motion or browsers without the observers: the content then just stays visible.
 * Returns a function that stops everything.
 */
export function startScrollReplay(root = document) {
  const view = root.defaultView || window;
  if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  if (view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return () => {};

  const seen = new WeakSet();
  const intersections = new IntersectionObserver(entries => {
    for (const entry of entries) {
      // "Near" is a sliver of a normal block, or half a screen of one taller than the window.
      const near = entry.isIntersecting && (entry.intersectionRatio >= NEAR || entry.intersectionRect.height >= view.innerHeight * 0.4);
      if (near) entry.target.classList.add('is-inview');
      // Only reset once it is completely off screen, so nothing blinks while it is still partly visible.
      else if (!entry.isIntersecting) entry.target.classList.remove('is-inview');
    }
  }, { threshold: [0, NEAR, 0.4] });

  function scan() {
    for (const element of root.querySelectorAll(TARGETS)) {
      if (seen.has(element)) continue;
      seen.add(element);
      element.classList.add('mo');
      intersections.observe(element);
    }
  }

  // New pages and sections arrive after the first render, so keep looking; MutationObserver callbacks run before paint.
  const mutations = new MutationObserver(scan);
  mutations.observe(root.body || root, { childList: true, subtree: true });
  scan();
  return () => { mutations.disconnect(); intersections.disconnect(); };
}
