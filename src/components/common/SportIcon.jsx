const ICONS = {
  football: <>
    <circle cx="24" cy="24" r="18" />
    <path d="M24 16.5 31 21.6 28.3 29.8H19.7L17 21.6Z" fill="currentColor" />
    <path d="M24 16.5V6.2M31 21.6 40.6 18.4M28.3 29.8 34.4 38.2M19.7 29.8 13.6 38.2M17 21.6 7.4 18.4" />
  </>,
  basketball: <>
    <circle cx="24" cy="24" r="18" />
    <path d="M24 6V42M6 24H42" />
    <path d="M11.3 11.3C18 18 18 30 11.3 36.7M36.7 11.3C30 18 30 30 36.7 36.7" />
  </>,
  swimming: <>
    <circle cx="34" cy="13" r="3.5" />
    <path d="M10 26 20 19 28 21 35 26" />
    <path d="M22 20 27 14" />
    <path d="M5 34q4.7-4 9.5 0t9.5 0 9.5 0 9.5 0M5 42q4.7-4 9.5 0t9.5 0 9.5 0 9.5 0" />
  </>,
  walking: <>
    <circle cx="25" cy="8" r="3.5" />
    <path d="M25 13.5 24 27" />
    <path d="M25 16 17 24M25 16 32 23" />
    <path d="M24 27 17 42M24 27 30 34 32 42" />
  </>,
  running: <>
    <circle cx="31" cy="8.5" r="3.5" />
    <path d="M28.5 14 22 27" />
    <path d="M27.5 17 19 19 15 26M27.5 17 35 21 39 17" />
    <path d="M22 27 31 32 29 42M22 27 13 33 7 31" />
  </>,
  cycling: <>
    <circle cx="11" cy="32" r="8" />
    <circle cx="37" cy="32" r="8" />
    <path d="M11 32 19 17H31L37 32M19 17 24 32H11M24 32 31 17" />
    <path d="M16 13.5H22M31 17 29 11H34" />
  </>,
  handball: <>
    <path d="M5 38V12H43V38" />
    <path d="M5 20H43M5 28H43M15 12V38M24 12V38M33 12V38" opacity=".35" />
    <circle cx="24" cy="31" r="7" fill="var(--icon-fill, #fff)" />
    <path d="M17.4 28.6C21 31 27 31 30.6 28.6M24 24V38" />
  </>,
  padel: <>
    <ellipse cx="20" cy="18.5" rx="11" ry="13.5" transform="rotate(-35 20 18.5)" />
    <path d="M27 28 38 41M34.5 37.5 37.5 34.7" />
    <path d="M14 16h.01M19 12h.01M24 16h.01M19 20h.01M14 23h.01M24 24h.01M29 19.5h.01M19 27h.01" strokeWidth="3" />
    <circle cx="38" cy="10" r="3.5" />
  </>,
  kayaking: <>
    <path d="M4 33Q24 41 44 33Q24 28 4 33Z" />
    <circle cx="24" cy="17.5" r="3.5" />
    <path d="M24 21 24 30" />
    <path d="M9 12 39 26" />
    <ellipse cx="9.5" cy="12.4" rx="2.2" ry="4" transform="rotate(-62 9.5 12.4)" />
    <ellipse cx="38.5" cy="25.6" rx="2.2" ry="4" transform="rotate(-62 38.5 25.6)" />
    <path d="M6 43q4-3 8 0t8 0 8 0 8 0" />
  </>,
  tennis: <>
    <ellipse cx="19" cy="19" rx="10.5" ry="13.5" transform="rotate(-40 19 19)" />
    <path d="M11.5 11.5 27 27M16 8 30 22M7 17 21 31" opacity=".5" />
    <path d="M27 29 39 42" />
    <circle cx="37" cy="10" r="3.5" />
  </>,
  default: <>
    <circle cx="24" cy="24" r="18" />
    <path d="M24 6C16 14 16 34 24 42M24 6C32 14 32 34 24 42M6 24H42" />
  </>,
};

function sportIconKey(name) {
  const key = String(name || '').trim().toLowerCase();
  return key in ICONS ? key : 'default';
}

export default function SportIcon({ name, size = 44, className = '' }) {
  return <svg
    className={`sport-icon ${className}`.trim()}
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {ICONS[sportIconKey(name)]}
  </svg>;
}
