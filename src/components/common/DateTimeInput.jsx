import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { locate, popupHost, useFollow } from './popup';

const pad = number => String(number).padStart(2, '0');
const toKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const HOURS = Array.from({ length: 24 }, (_, hour) => pad(hour));
const MINUTES = Array.from({ length: 12 }, (_, step) => pad(step * 5));
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_FORMAT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const DISPLAY_FORMAT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

// "2030-01-31T18:30" -> a Date for those wall-clock parts (no timezone conversion is involved).
function parse(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '');
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])) : null;
}
const format = date => `${toKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

function setNativeValue(element, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Monday-first grid of the six weeks that cover a month.
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(year, month, 1 - offset + index));
}

/**
 * Drop-in replacement for <input type="datetime-local">. The real input stays in the page (hidden) so forms, validation
 * and labels keep working; people pick from a calendar and time columns that match the rest of the app.
 */
export default function DateTimeInput({ className = '', ...props }) {
  const nativeRef = useRef(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const [host, setHost] = useState(null);
  const [value, setValue] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [shown, setShown] = useState(() => new Date());
  const panelId = useId();

  // Mirror the real input after every render, and when the user edits it natively.
  // Runs every render on purpose: it only updates state when the real element differs, so it cannot loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const element = nativeRef.current;
    setValue(previous => previous === element.value ? previous : element.value);
    setDisabled(previous => previous === element.disabled ? previous : element.disabled);
  });
  useEffect(() => {
    const element = nativeRef.current;
    const sync = () => setValue(element.value);
    element.addEventListener('input', sync);
    element.addEventListener('change', sync);
    return () => { element.removeEventListener('input', sync); element.removeEventListener('change', sync); };
  }, []);

  const current = parse(value);
  const min = parse(props.min);
  const minDay = min ? toKey(min) : '';
  const today = toKey(new Date());

  const measure = useCallback(field => locate(field, { width: 24 * 16, height: 440 }), []);
  useFollow(open, rootRef, measure, setPlace);

  function openPanel() {
    if (nativeRef.current.disabled) return;
    setShown(current || min || new Date());
    setPlace(measure(rootRef.current));
    setHost(popupHost(nativeRef.current));
    setOpen(true);
  }
  const close = (refocus = false) => { setOpen(false); if (refocus) nativeRef.current?.focus(); };

  // Choosing anything writes a complete value; if only a day or only a time is chosen, the other part gets a sensible default.
  function commit(next) {
    const clamped = min && next < min ? min : next;
    setNativeValue(nativeRef.current, format(clamped));
  }
  function pickDay(day) {
    const base = current || min || new Date(day.getFullYear(), day.getMonth(), day.getDate(), 18, 0);
    commit(new Date(day.getFullYear(), day.getMonth(), day.getDate(), current ? base.getHours() : (min && toKey(day) === minDay ? min.getHours() : 18), current ? base.getMinutes() : 0));
  }
  function pickTime(hours, minutes) {
    const base = current || new Date();
    commit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours ?? (current ? current.getHours() : 18), minutes ?? (current ? current.getMinutes() : 0)));
  }
  function clear() { setNativeValue(nativeRef.current, ''); }

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector('[data-selected="true"], [data-today="true"]')?.focus();
    const outside = event => { if (!rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open) panelRef.current?.querySelectorAll('.ui-time-list [aria-selected="true"]').forEach(item => item.scrollIntoView({ block: 'center' }));
  }, [open, value]);

  // The real input is the keyboard control (you can type a value into it); these keys open the picker instead.
  function onNativeKeyDown(event) {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === ' ' || event.key === 'F4' || (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp'))) {
      event.preventDefault();
      openPanel();
    }
  }

  function onPanelKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    const day = event.target.closest?.('[data-day]');
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (day && moves[event.key]) {
      event.preventDefault();
      const next = parse(`${day.dataset.day}T00:00`);
      next.setDate(next.getDate() + moves[event.key]);
      setShown(new Date(next.getFullYear(), next.getMonth(), 1));
      requestAnimationFrame(() => panelRef.current?.querySelector(`[data-day="${toKey(next)}"]`)?.focus());
    }
  }

  const cells = monthGrid(shown.getFullYear(), shown.getMonth());
  const shift = delta => setShown(new Date(shown.getFullYear(), shown.getMonth() + delta, 1));
  const selectedKey = current ? toKey(current) : '';
  // Only one day is in the tab order (the selected one, else today, else the 1st); arrow keys move between days.
  const visibleKeys = new Set(cells.map(toKey));
  const focusKey = selectedKey && visibleKeys.has(selectedKey) ? selectedKey : visibleKeys.has(today) ? today : toKey(cells.find(cell => cell.getMonth() === shown.getMonth()));

  return <div ref={rootRef} className={`ui-datetime${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''} ${className}`.trim()} data-field={props.name}>
    <input {...props} ref={nativeRef} type="datetime-local" className="ui-native" onKeyDown={onNativeKeyDown} />
    <button type="button" className="ui-trigger" tabIndex={-1} aria-hidden="true" disabled={disabled} onClick={() => (open ? close() : openPanel())}>
      <span className={current ? '' : 'is-placeholder'}>{current ? DISPLAY_FORMAT.format(current) : 'Pick a date and time'}</span>
    </button>
    {open && place && host && createPortal(<div ref={panelRef} id={panelId} className="ui-picker" role="dialog" aria-label="Choose date and time" style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight, overflowY: 'auto' }} onKeyDown={onPanelKeyDown}>
      <div className="ui-picker-body">
        <div className="ui-calendar">
          <div className="ui-calendar-head">
            <button type="button" className="ui-nav" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="arrow" size={16} /></button>
            <strong>{MONTH_FORMAT.format(shown)}</strong>
            <button type="button" className="ui-nav" onClick={() => shift(1)} aria-label="Next month"><Icon name="arrow" size={16} /></button>
          </div>
          <div className="ui-weekdays" aria-hidden="true">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
          <div className="ui-days" role="group" aria-label={MONTH_FORMAT.format(shown)}>
            {cells.map(day => {
              const key = toKey(day);
              const outside = day.getMonth() !== shown.getMonth();
              const blocked = !!minDay && key < minDay;
              return <button
                type="button"
                key={key}
                data-day={key}
                data-selected={key === selectedKey}
                data-today={key === today}
                tabIndex={key === focusKey ? 0 : -1}
                className={`ui-day${outside ? ' is-outside' : ''}${key === today ? ' is-today' : ''}${key === selectedKey ? ' is-selected' : ''}`}
                disabled={blocked}
                aria-label={day.toDateString()}
                aria-pressed={key === selectedKey}
                onClick={() => pickDay(day)}
              >{day.getDate()}</button>;
            })}
          </div>
        </div>
        <div className="ui-time" aria-label="Time">
          <div className="ui-time-head"><Icon name="calendar" size={14} />Time</div>
          <div className="ui-time-cols">
            <ul className="ui-time-list" role="listbox" aria-label="Hour">
              {HOURS.map(hour => <li key={hour} role="option" aria-selected={!!current && pad(current.getHours()) === hour} className={current && pad(current.getHours()) === hour ? 'is-selected' : ''} onClick={() => pickTime(Number(hour), undefined)}>{hour}</li>)}
            </ul>
            <ul className="ui-time-list" role="listbox" aria-label="Minute">
              {MINUTES.map(minute => <li key={minute} role="option" aria-selected={!!current && pad(current.getMinutes()) === minute} className={current && pad(current.getMinutes()) === minute ? 'is-selected' : ''} onClick={() => pickTime(undefined, Number(minute))}>{minute}</li>)}
            </ul>
          </div>
        </div>
      </div>
      <div className="ui-picker-foot">
        {!props.required && <button type="button" className="ui-link" onClick={clear}>Clear</button>}
        <button type="button" className="ui-link" onClick={() => { setShown(new Date()); }}>Today</button>
        <button type="button" className="ui-done" onClick={() => close(true)}>Done</button>
      </div>
    </div>, host)}
  </div>;
}
