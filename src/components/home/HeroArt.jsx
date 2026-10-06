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

// Groups scene in the same grey line-art: a team on the pitch - a high-five, a runner and a kick heading for the goal.
export function GroupsArt() {
  return <svg className="banner-art banner-art-pitch" viewBox="0 0 1200 160" preserveAspectRatio="xMaxYMid slice" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <g transform="translate(78 0) scale(.9)">
      <path d="M440 142H1010" strokeWidth="1.5" strokeDasharray="3 7" />
      <g>
        <circle cx="480" cy="52" r="9" />
        <path d="M480 63V102M480 102L467 138M480 102L493 138M480 72L462 54M480 72L508 52" />
      </g>
      <g>
        <circle cx="538" cy="52" r="9" />
        <path d="M538 63V102M538 102L525 138M538 102L551 138M538 72L556 54M538 72L510 52" />
      </g>
      <path d="M509 40V30M499 43L494 35M519 43L524 35" strokeWidth="1.5" />
      <path d="M598 142L608 118L618 142Z" strokeWidth="1.6" />
      <g>
        <circle cx="690" cy="52" r="9" />
        <path d="M686 63L676 102M676 102L696 120L692 140M676 102L658 114L642 108M686 72L704 84M686 72L666 82" />
      </g>
      <path d="M612 80H636M606 92H630" strokeWidth="1.5" opacity=".8" />
      <g>
        <circle cx="800" cy="52" r="9" />
        <path d="M800 63V102M800 102L796 140M800 102L828 114L844 100M800 72L780 86M800 72L820 64" />
      </g>
      <g strokeWidth="1.8">
        <circle cx="888" cy="92" r="11" fill="#f3f5f4" />
        <path d="M888 86L893 90L891 96H885L883 90Z" />
        <path d="M850 108C862 112 870 108 876 100" strokeDasharray="2 6" />
      </g>
      <g>
        <path d="M930 142V58H1010V142" />
        <path d="M930 58L914 74V142M1010 58L1026 74V142" strokeWidth="1.5" />
        <path d="M946 58V142M962 58V142M978 58V142M994 58V142M930 78H1010M930 98H1010M930 118H1010" strokeWidth="1" opacity=".7" />
      </g>
      <g strokeWidth="1.2"><path d="M1040 36l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M445 36l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></g>
    </g>
  </svg>;
}

// Messages scene in the same grey line-art: two friends trading chat bubbles with a paper plane between them.
export function MessagesArt() {
  return <svg className="banner-art banner-art-pitch" viewBox="0 0 1200 160" preserveAspectRatio="xMaxYMid slice" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <g transform="translate(70 0) scale(.92)">
      <path d="M520 142H1000" strokeWidth="1.5" strokeDasharray="3 7" />
      <g>
        <circle cx="560" cy="62" r="9" />
        <path d="M560 73V108M560 108L548 140M560 108L572 140M560 82L542 66M560 82L582 94" />
      </g>
      <g strokeWidth="1.8">
        <path d="M584 22h70a7 7 0 0 1 7 7v26a7 7 0 0 1-7 7h-46l-14 12V62h-10a7 7 0 0 1-7-7V29a7 7 0 0 1 7-7Z" fill="#f3f5f4" />
        <path d="M598 38h42M598 50h26" strokeWidth="1.5" />
      </g>
      <g>
        <circle cx="940" cy="62" r="9" />
        <path d="M940 73V108M940 108L928 140M940 108L952 140M940 82L958 66M940 82L918 94" />
        <rect x="905" y="86" width="12" height="20" rx="2.5" strokeWidth="1.6" transform="rotate(-18 911 96)" />
      </g>
      <g strokeWidth="1.8">
        <path d="M760 66h66a7 7 0 0 1 7 7v26a7 7 0 0 1-7 7h-10v12l-14-12h-42a7 7 0 0 1-7-7V73a7 7 0 0 1 7-7Z" fill="#f3f5f4" />
        <path d="M776 82h46M776 94h30" strokeWidth="1.5" />
      </g>
      <g strokeWidth="1.8">
        <path d="M690 100L736 82L700 124L694 108Z" />
        <path d="M694 108L736 82" />
        <path d="M600 112C630 130 660 128 686 112" strokeDasharray="2 7" />
      </g>
      <g strokeWidth="1.2"><path d="M1010 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M500 52l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></g>
    </g>
  </svg>;
}

// Notifications scene in the same grey line-art: a ringing bell with a trail of notice cards and a tick.
export function NotificationsArt() {
  return <svg className="banner-art banner-art-pitch" viewBox="0 0 1200 160" preserveAspectRatio="xMaxYMid slice" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <g transform="translate(60 0) scale(.92)">
      <g transform="rotate(-10 600 96)">
        <path d="M562 112V84a38 38 0 0 1 76 0v28l12 16H550Z" fill="#f3f5f4" />
        <path d="M588 128a12 12 0 0 0 24 0M600 36v10" />
        <path d="M575 84a25 25 0 0 1 12-22" strokeWidth="1.6" />
      </g>
      <path d="M520 60c-8 10-10 22-6 34M508 48c-14 16-18 38-10 58M684 56c8 10 10 22 6 34M696 44c14 16 18 38 10 58" strokeWidth="1.8" />
      <g strokeWidth="1.8">
        <rect x="740" y="32" width="150" height="40" rx="8" fill="#f3f5f4" />
        <circle cx="764" cy="52" r="10" />
        <path d="M784 46h86M784 58h54" strokeWidth="1.5" />
        <rect x="770" y="86" width="150" height="40" rx="8" fill="#f3f5f4" />
        <circle cx="794" cy="106" r="10" />
        <path d="M814 100h86M814 112h40" strokeWidth="1.5" />
        <path d="M758 106h-16M752 98l-10 8 10 8" strokeWidth="1.5" strokeDasharray="2 5" />
      </g>
      <g strokeWidth="1.8">
        <circle cx="960" cy="80" r="22" fill="#f3f5f4" />
        <path d="M950 80l8 8 14-16" />
      </g>
      <path d="M470 124h-30M450 140h-30" strokeWidth="1.5" strokeDasharray="3 7" />
      <g strokeWidth="1.2"><path d="M1010 36l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M470 36l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></g>
    </g>
  </svg>;
}

// My rooms scene in the same grey line-art: a coach pointing at a tactics board, with a stopwatch, cones and a ball.
export function MyRoomsArt() {
  return <svg className="banner-art banner-art-pitch" viewBox="0 0 1200 160" preserveAspectRatio="xMaxYMid slice" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <g transform="translate(60 0) scale(.92)">
      <path d="M520 144H1010" strokeWidth="1.5" strokeDasharray="3 7" />
      <g>
        <circle cx="570" cy="54" r="9" />
        <path d="M570 65V106M570 106L558 142M570 106L582 142M570 76L552 94M570 76L604 70" />
        <circle cx="548" cy="62" r="3.500" strokeWidth="1.600" />
        <path d="M534 52l-6-6M532 62h-8M534 72l-6 6" strokeWidth="1.400" />
      </g>
      <g strokeWidth="1.8">
        <rect x="620" y="26" width="220" height="96" rx="8" fill="#f3f5f4" />
        <path d="M660 122v22M800 122v22" />
        <rect x="634" y="38" width="192" height="72" rx="3" strokeWidth="1.500" />
        <path d="M730 38V110" strokeWidth="1.500" />
        <circle cx="730" cy="74" r="14" strokeWidth="1.500" />
        <rect x="634" y="56" width="26" height="36" strokeWidth="1.500" />
        <rect x="800" y="56" width="26" height="36" strokeWidth="1.500" />
        <circle cx="668" cy="50" r="5" fill="#f3f5f4" />
        <circle cx="672" cy="98" r="5" fill="#f3f5f4" />
        <circle cx="700" cy="74" r="5" fill="#f3f5f4" />
        <circle cx="704" cy="50" r="5" fill="#f3f5f4" />
        <path d="M758 52l8 8M766 52l-8 8M772 88l8 8M780 88l-8 8M790 64l8 8M798 64l-8 8" strokeWidth="1.800" />
        <path d="M706 56C722 62 738 62 752 58M746 52l6 6-8 3" strokeDasharray="3 5" strokeWidth="1.600" />
        <path d="M708 80C730 92 750 92 782 80" strokeDasharray="3 5" strokeWidth="1.600" />
      </g>
      <g strokeWidth="1.8">
        <circle cx="900" cy="84" r="22" fill="#f3f5f4" />
        <path d="M900 62v-8M894 52h12M900 84l10-10M900 84v-14" />
        <path d="M918 66l6-6" />
      </g>
      <path d="M948 144l10-26 10 26zM942 144h32" strokeWidth="1.800" />
      <path d="M984 144l9-22 9 22zM979 144h28" strokeWidth="1.800" />
      <circle cx="1040" cy="132" r="12" fill="#f3f5f4" strokeWidth="1.800" />
      <path d="M1040 126l5 3.500-2 6h-6l-2-6z" strokeWidth="1.400" />
      <g strokeWidth="1.200"><path d="M1060 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M520 36l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></g>
    </g>
  </svg>;
}

// Joined rooms scene: numbered team jerseys on a changing-room rail, with one empty dashed shirt waiting for you.
const JERSEYS = [{ x: 570, n: '7' }, { x: 650, n: '10' }, { x: 730, n: '4' }, { x: 810, n: '9' }];

function Jersey({ x, n, dashed = false }) {
  return <g transform={`translate(${x} 34)`}>
    <path d="M30 -8v8" strokeWidth="1.800" />
    <path d="M18 2L2 12L10 28L18 24V62H42V24L50 28L58 12L42 2Q30 12 18 2Z" fill="#f3f5f4" strokeDasharray={dashed ? '4 5' : undefined} />
    {dashed
      ? <path d="M30 34v20M20 44h20" strokeWidth="2.600" />
      : <text x="30" y="50" textAnchor="middle" fontSize="19" fontWeight="800" fill="currentColor" stroke="none">{n}</text>}
  </g>;
}

export function JoinedRoomsArt() {
  return <svg className="banner-art banner-art-pitch" viewBox="0 0 1200 160" preserveAspectRatio="xMaxYMid slice" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <g transform="translate(155 10) scale(.88)">
      <path d="M540 26H960" strokeWidth="2.600" />
      <path d="M540 26v10M960 26v10" strokeWidth="2.600" />
      {JERSEYS.map(jersey => <Jersey key={jersey.x} {...jersey} />)}
      <Jersey x={890} n="+" dashed />
      <g strokeWidth="1.800">
        <rect x="540" y="118" width="420" height="10" rx="3" fill="#f3f5f4" />
        <path d="M560 128v16M940 128v16" />
      </g>
      <circle cx="610" cy="106" r="11" fill="#f3f5f4" strokeWidth="1.800" />
      <path d="M610 100l5 3.500-2 6h-6l-2-6z" strokeWidth="1.400" />
      <path d="M700 112h26a4 4 0 0 1 4 4v2H696v-2a4 4 0 0 1 4-4z" strokeWidth="1.800" />
      <path d="M770 112h26a4 4 0 0 1 4 4v2H766v-2a4 4 0 0 1 4-4z" strokeWidth="1.800" />
      <path d="M1000 144h30M1008 144l5-14h8l5 14" strokeWidth="1.800" />
      <g strokeWidth="1.200"><path d="M990 52l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M520 70l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></g>
    </g>
  </svg>;
}
