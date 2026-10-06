import { useEffect } from 'react';

/**
 * Where to draw a popup so it sits under (or, when there is no room, above) its field.
 * Popups are rendered outside the field's <label> (so they do not become part of its text) and use fixed
 * positioning (so no card or dialog can clip them), which is why this works from the field's screen position.
 */
export function locate(field, { width, height }) {
  const box = field.getBoundingClientRect();
  const below = window.innerHeight - box.bottom - 12;
  const above = box.top - 12;
  const up = below < Math.min(height, 300) && above > below;
  const popupWidth = Math.min(width ?? box.width, window.innerWidth - 16);
  return {
    left: Math.max(8, Math.min(box.left, window.innerWidth - popupWidth - 8)),
    width: width ? popupWidth : box.width,
    ...(up ? { bottom: window.innerHeight - box.top + 6 } : { top: box.bottom + 6 }),
    maxHeight: Math.max(160, (up ? above : below) - 6),
    up,
  };
}

/** Keeps a popup attached to its field while the page scrolls or the window changes size. */
export function useFollow(open, field, measure, setPlace) {
  useEffect(() => {
    if (!open) return undefined;
    const update = () => { if (field.current) setPlace(measure(field.current)); };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open, field, measure, setPlace]);
}

/** A modal <dialog> sits in the browser's top layer, so a popup for a field inside one has to live inside it too. */
export const popupHost = element => element?.closest('dialog') || document.body;
