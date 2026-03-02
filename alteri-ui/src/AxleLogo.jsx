var React = require('react');
var e = React.createElement;

var SIZES = {
  sm: { mark: 28, wordmark: 15 },
  md: { mark: 36, wordmark: 18 },
  lg: { mark: 48, wordmark: 24 },
};

var SPIN_STYLE = '\n' +
  '@keyframes axle-rotor-spin {\n' +
  '  from { transform: rotate(0deg); }\n' +
  '  to   { transform: rotate(360deg); }\n' +
  '}\n' +
  '.axle-rotor-blades {\n' +
  '  transform-origin: 22px 22px;\n' +
  '  animation: axle-rotor-spin 12s linear infinite;\n' +
  '}\n';

function AxleLogo(props) {
  var variant  = props.variant  || 'dark';
  var size     = props.size     || 'md';
  var animated = props.animated !== false;

  var s       = SIZES[size] || SIZES.md;
  var isDark  = variant === 'dark';
  var color   = isDark ? '#C8A258' : '#0F2137';
  var hubCut  = isDark ? '#0F2137' : '#F0EDE8';
  var textClr = isDark ? '#FFFFFF' : '#0F2137';

  return e(React.Fragment, null,
    e('style', null, SPIN_STYLE),
    e('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: (s.mark * 0.3) + 'px',
        textDecoration: 'none',
      }
    },
      e('svg', {
        width: s.mark,
        height: s.mark,
        viewBox: '0 0 44 44',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        style: { color: color, display: 'block' },
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
        style: {
          fontFamily: "'Outfit', sans-serif",
          fontSize: s.wordmark + 'px',
          fontWeight: 700,
          color: textClr,
          letterSpacing: '4px',
        }
      }, 'AXLE'),
    )
  );
}

module.exports = AxleLogo;
