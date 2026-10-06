const PATHS = {
  pin: <><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="1.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M8 14h2M14 14h2M8 17h2" /></>,
  people: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 13.8c2.7-.3 4.8 1.6 4.8 4.4" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" /></>,
  bolt: <path d="M13.5 3 6 13.5h5l-1 7.5 7.5-10.5h-5Z" />,
  arrow: <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  bell: <><path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15Z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  chat: <><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5Z" /><path d="M8 10h8M8 13h5" /></>,
  userplus: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5M18 8v6M15 11h6" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 6H5c0 3 1.5 4.5 3.5 5M16 6h3c0 3-1.5 4.5-3.5 5M12 13v4M10 17h4l1 3H9Z" /></>,
};

export default function Icon({ name, size = 18, className = '' }) {
  return <svg
    className={`ui-icon ${className}`.trim()}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {PATHS[name]}
  </svg>;
}
