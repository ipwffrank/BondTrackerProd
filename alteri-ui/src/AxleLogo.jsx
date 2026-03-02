import React from 'react';

const e = React.createElement;

const SIZES = {
  sm: { mark: 28, wordmark: 15 },
  md: { mark: 36, wordmark: 18 },
  lg: { mark: 48, wordmark: 24 },
};

const SPIN_STYLE =
  '@keyframes axle-rotor-spin {' +
  '  from { transform: rotate(0deg); }' +
  '  to   { transform: rotate(360deg); }' +
  '}' +
  '.axle-rotor-blades {' +
  '  transform-origin: 22px 22px;' +
  '  animation: axle-rotor-spin 12s linear infinite;' +
  '}';

export default function AxleLogo({ variant = 'dark', size = 'md', animated = true }) {
  const s      = SIZES[size] || SIZES.md;
  const isDark = variant === 'dark';
  const color  = isDark ? '#C8A258' : '#0F2137';
  const hubCut = isDark ? '#0F2137' : '#F0EDE8';
  const textClr = isDark ? '#FFFFFF' : '#0F2137';

  return e(React.Fragment, null,
    e('style', null, SPIN_STYLE),
    e('div', { style: { display: 'flex', alignItems: 'center', gap: (s.mark * 0.3) + 'px' } },
      e('svg', {
        width: s.mark, height: s.mark, viewBox: '0 0 44 44',
        fill: 'none', xmlns: 'http://www.w3.org/2000/svg',
        style: { color, display: 'block' },
      },
        e('circle', { cx: 22, cy: 22, r: 18, stroke: 'currentColor', strokeWidth: '0.8', fill: 'none', opacity: '0.15', strokeDasharray: '3 4' }),
        e('g', { className: animated ? 'axle-rotor-blades' : undefined },
          e('path', { d: 'M22 8 Q30 14 28 22', stroke: 'currentColor', strokeWidth: '2.2', strokeLinecap: 'round', fill: 'none' }),
          e('path', { d: 'M34 28 Q28 34 22 32', stroke: 'currentColor', strokeWidth: '2.2', strokeLinecap: 'round', fill: 'none', opacity: '0.7' }),
          e('path', { d: 'M10 24 Q14 16 22 16', stroke: 'currentColor', strokeWidth: '2.2', strokeLinecap: 'round', fill: 'none', opacity: '0.5' }),
        ),
        e('circle', { cx: 22, cy: 22, r: 4,   fill: 'currentColor' }),
        e('circle', { cx: 22, cy: 22, r: 1.8, fill: hubCut }),
      ),
      e('span', {
        style: { fontFamily: "'Outfit', sans-serif", fontSize: s.wordmark + 'px', fontWeight: 700, color: textClr, letterSpacing: '4px' }
      }, 'AXLE'),
    )
  );
}
