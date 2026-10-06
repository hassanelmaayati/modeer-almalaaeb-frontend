export function PitchArt() {
  return <svg className="hero-art hero-art-left" viewBox="0 0 342 182" preserveAspectRatio="xMinYMid slice" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
    <rect x="-2" y="1" width="344" height="180" />
    <path d="M178 1V181" />
    <circle cx="178" cy="91" r="40" />
    <circle cx="178" cy="91" r="1.5" />
    <rect x="-2" y="44" width="52" height="94" />
    <rect x="-2" y="64" width="22" height="54" />
    <path d="M50 72A22 22 0 0 1 50 110" />
    <rect x="304" y="44" width="38" height="94" />
    <rect x="322" y="64" width="20" height="54" />
    <path d="M304 72A22 22 0 0 0 304 110" />
  </svg>;
}

export function CourtArt() {
  return <svg className="hero-art hero-art-right" viewBox="0 0 200 200" preserveAspectRatio="xMaxYMid slice" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
    <path d="M200 6H100C45 6 4 50 4 100s41 94 96 94h100" />
    <path d="M200 6V194" />
    <rect x="110" y="56" width="90" height="88" />
    <circle cx="110" cy="100" r="34" />
    <path d="M200 76V124" />
    <circle cx="182" cy="100" r="9" />
    <path d="M118 22C70 30 38 62 38 100s32 70 80 78" strokeDasharray="3 4" />
  </svg>;
}

export function StadiumArt() {
  return <svg className="banner-art banner-art-pitch" viewBox="0 0 1200 160" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
    <rect x="-2" y="-2" width="1204" height="164" />
    <path d="M600 -2V162" />
    <circle cx="600" cy="80" r="46" />
    <circle cx="600" cy="80" r="2" />
    <rect x="-2" y="20" width="110" height="120" />
    <rect x="-2" y="52" width="40" height="56" />
    <rect x="1092" y="20" width="110" height="120" />
    <rect x="1162" y="52" width="40" height="56" />
  </svg>;
}

// Cup-draw scene in the same thin grey line-art as the home and sports art: balls drawn along a path towards a trophy.
const DRAW_BALLS = [
  { x: 470, y: 122, r: 19, n: 7 },
  { x: 560, y: 64, r: 25, n: 3 },
  { x: 650, y: 108, r: 21, n: 5 },
  { x: 740, y: 52, r: 18, n: 1 },
  { x: 830, y: 100, r: 26, n: 8 },
];
const SPARKLES = ['M900 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z', 'M1034 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z', 'M885 128l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'];

function DrawBall({ x, y, r, n }) {
  return <g>
    <circle cx={x} cy={y} r={r} fill="#f3f5f4" />
    <text x={x} y={y + r * 0.22} textAnchor="middle" fontSize={r * 0.62} fontWeight="700" fill="currentColor" stroke="none">{n}</text>
  </g>;
}

export function BracketArt() {
  return <svg className="banner-art banner-art-pitch" viewBox="0 0 1200 160" preserveAspectRatio="xMaxYMid slice" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <g transform="translate(-60 0)">
      <path d="M470 122C510 122 520 64 560 64S610 108 650 108S700 52 740 52S790 100 830 100S870 96 895 84" strokeDasharray="3 7" />
      {DRAW_BALLS.map(ball => <DrawBall key={ball.n} {...ball} />)}
      <g transform="translate(905 22) scale(2.2)" strokeWidth="1.1">
        <path d="M14 3h20v15a10 10 0 0 1-20 0Z" />
        <path d="M15 7H8c0 8 3 11 8 12M33 7h7c0 8-3 11-8 12" />
        <path d="M24 28v5M17 33h14l2 5H15zM13 38h22v6H13z" />
        <path d="M24 8l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" />
      </g>
      <g strokeWidth="1.2">{SPARKLES.map(d => <path key={d} d={d} />)}</g>
    </g>
  </svg>;
}

export function TrophyArt({ size = 56 }) {
  return <svg className="trophy-art" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M15 6h18v12a9 9 0 0 1-18 0Z" />
    <path d="M15 10H8c0 7 3 10 8 11M33 10h7c0 7-3 10-8 11" />
    <path d="M24 27v8M19 35h10l2 7H17Z" />
    <path d="M24 11l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z" fill="currentColor" stroke="none" />
  </svg>;
}
