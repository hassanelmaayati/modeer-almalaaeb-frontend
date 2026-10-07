import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startScrollReplay } from '../../src/lib/helpers/scrollReplay';

let observers;
class FakeIntersectionObserver {
  constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
  observe(element) { this.targets.add(element); }
  disconnect() { this.targets.clear(); }
}
const report = (element, entry) => observers[0].callback([{ target: element, isIntersecting: false, intersectionRatio: 0, intersectionRect: { height: 0 }, ...entry }]);

describe('startScrollReplay', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    document.body.innerHTML = '<main><section class="home-section" id="one"></section><section class="sports-banner" id="two"></section><div id="plain"></div></main>';
  });
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('marks and watches the page blocks, and nothing else', () => {
    const stop = startScrollReplay();
    expect(document.getElementById('one')).toHaveClass('mo');
    expect(document.getElementById('two')).toHaveClass('mo');
    expect(document.getElementById('plain')).not.toHaveClass('mo');
    expect([...observers[0].targets].map(element => element.id)).toEqual(['one', 'two']);
    stop();
  });

  it('shows a block when it comes near and resets it once it has fully left, so the animation replays', () => {
    const stop = startScrollReplay();
    const block = document.getElementById('one');
    report(block, { isIntersecting: true, intersectionRatio: 0.5, intersectionRect: { height: 100 } });
    expect(block).toHaveClass('is-inview');
    // Still partly visible: it stays shown.
    report(block, { isIntersecting: true, intersectionRatio: 0.05, intersectionRect: { height: 10 } });
    expect(block).toHaveClass('is-inview');
    report(block, { isIntersecting: false });
    expect(block).not.toHaveClass('is-inview');
    report(block, { isIntersecting: true, intersectionRatio: 0.3, intersectionRect: { height: 60 } });
    expect(block).toHaveClass('is-inview');
    stop();
  });

  it('picks up blocks added later, like a new page', async () => {
    const stop = startScrollReplay();
    const late = document.createElement('section');
    late.className = 'panel';
    document.querySelector('main').append(late);
    await Promise.resolve();
    expect(late).toHaveClass('mo');
    expect(observers[0].targets.has(late)).toBe(true);
    stop();
  });

  it('does nothing when the visitor prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    startScrollReplay();
    expect(document.getElementById('one')).not.toHaveClass('mo');
    expect(observers).toHaveLength(0);
  });
});
