import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { locate, popupHost, useFollow } from './popup';

// Setting .value directly and firing the events a user would, so React's onChange and any form listeners run as usual.
function setNativeValue(element, value) {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

const readOptions = element => Array.from(element.options)
  .map((option, index) => ({ index, value: option.value, label: option.textContent, disabled: option.disabled, selected: option.selected }))
  // A disabled empty option is only a "Select a ..." hint, not something to pick.
  .filter(option => !(option.disabled && option.value === ''));

/**
 * Drop-in replacement for <select>. The real select stays in the page (hidden), so forms, validation, labels and
 * keyboards keep working; people see and use a styled button and menu instead of the browser's default dropdown.
 */
export default function Select({ children, className = '', ...props }) {
  // A plain list box (several rows showing at once) stays as the browser control; everything else gets the styled menu.
  if (props.size > 1 && !props.multiple) return <select className={className} {...props}>{children}</select>;
  return <EnhancedSelect className={className} {...props}>{children}</EnhancedSelect>;
}

function EnhancedSelect({ children, className, ...props }) {
  const nativeRef = useRef(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: '', timer: null });
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const [host, setHost] = useState(null);
  const [options, setOptions] = useState([]);
  const [active, setActive] = useState(-1);
  const [view, setView] = useState({ label: '', placeholder: true, disabled: false });
  const [, refresh] = useState(0);
  const listId = useId();

  // After every render, copy what the real select currently shows so the button matches it.
  // Runs every render on purpose: it only updates state when the real element differs, so it cannot loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const element = nativeRef.current;
    const chosen = Array.from(element.selectedOptions).filter(item => item.value !== '');
    const label = props.multiple
      ? (chosen.length === 0 ? (props['data-placeholder'] || 'None selected') : chosen.length <= 2 ? chosen.map(item => item.textContent).join(', ') : `${chosen.length} selected`)
      : element.selectedOptions[0]?.textContent ?? '';
    const next = { label, placeholder: props.multiple ? chosen.length === 0 : !element.selectedOptions[0] || element.selectedOptions[0].value === '', disabled: element.disabled };
    setView(previous => previous.label === next.label && previous.placeholder === next.placeholder && previous.disabled === next.disabled ? previous : next);
  });

  // A keyboard change on the real select does not re-render by itself, so listen for it.
  useEffect(() => {
    const element = nativeRef.current;
    const onChange = () => refresh(count => count + 1);
    element.addEventListener('change', onChange);
    return () => element.removeEventListener('change', onChange);
  }, []);

  const measure = useCallback(field => locate(field, { height: 270 }), []);
  useFollow(open, rootRef, measure, setPlace);

  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) nativeRef.current?.focus();
  };

  function openMenu() {
    const element = nativeRef.current;
    if (element.disabled) return;
    const list = readOptions(element);
    const selected = list.findIndex(option => option.selected);
    setOptions(list);
    setActive(selected >= 0 ? selected : list.findIndex(option => !option.disabled));
    setPlace(measure(rootRef.current));
    setHost(popupHost(element));
    setOpen(true);
  }

  function choose(index) {
    const option = options[index];
    if (!option || option.disabled) return;
    if (props.multiple) {
      // Several can be picked: toggle this one on the real select and keep the menu open.
      const element = nativeRef.current;
      element.options[option.index].selected = !element.options[option.index].selected;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      setOptions(readOptions(element));
      return;
    }
    setNativeValue(nativeRef.current, option.value);
    close(true);
  }

  // Focus the list when it opens, and keep the active option in view.
  useEffect(() => { if (open) listRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = event => { if (!rootRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const step = (from, direction) => {
    for (let index = from + direction; index >= 0 && index < options.length; index += direction) if (!options[index].disabled) return index;
    return from;
  };

  function onListKeyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(step(active, 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(step(active, -1)); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(step(-1, 1)); }
    else if (event.key === 'End') { event.preventDefault(); setActive(step(options.length, -1)); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === 'Tab') close();
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Type-ahead: keep typing to jump to a matching option.
      clearTimeout(typed.current.timer);
      typed.current.text += event.key.toLowerCase();
      typed.current.timer = setTimeout(() => { typed.current.text = ''; }, 600);
      const match = options.findIndex(option => !option.disabled && option.label.toLowerCase().startsWith(typed.current.text));
      if (match >= 0) setActive(match);
    }
  }

  // The real select is the keyboard control; these keys open the styled menu instead of the browser's own popup.
  function onNativeKeyDown(event) {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === ' ' || event.key === 'F4' || (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp'))) {
      event.preventDefault();
      openMenu();
    }
  }

  const menu = open && place && host && <ul
    ref={listRef}
    id={listId}
    className="ui-menu"
    role="listbox"
    aria-multiselectable={props.multiple || undefined}
    tabIndex={-1}
    aria-label={props['aria-label'] || props.name || 'Options'}
    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
    style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: Math.min(256, place.maxHeight) }}
    onKeyDown={onListKeyDown}
  >
    {options.map((option, index) => <li
      key={`${option.value}-${index}`}
      id={`${listId}-${index}`}
      role="option"
      aria-selected={option.selected}
      aria-disabled={option.disabled || undefined}
      data-active={index === active}
      className={`ui-option${option.selected ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
      onPointerEnter={() => { if (!option.disabled) setActive(index); }}
      onClick={() => choose(index)}
    >{option.label}</li>)}
  </ul>;

  return <div ref={rootRef} className={`ui-select${open ? ' is-open' : ''}${view.disabled ? ' is-disabled' : ''} ${className}`.trim()} data-field={props.name}>
    <select {...props} ref={nativeRef} className="ui-native" onKeyDown={onNativeKeyDown}>{children}</select>
    <button type="button" className="ui-trigger" tabIndex={-1} aria-hidden="true" disabled={view.disabled} onClick={() => (open ? close() : openMenu())}>
      <span className={view.placeholder ? 'is-placeholder' : ''}>{view.label || ' '}</span>
    </button>
    {menu && createPortal(menu, host)}
  </div>;
}
