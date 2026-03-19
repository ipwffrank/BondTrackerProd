import React from 'react';

const e = React.createElement;

const BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Outfit', sans-serif",
  fontWeight: 600,
  letterSpacing: '0.02em',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '8px',
  transition: 'background 0.18s, color 0.18s, border-color 0.18s, transform 0.12s',
  textDecoration: 'none',
};

const SIZE_MAP = {
  sm: { padding: '8px 18px',  fontSize: '13px' },
  md: { padding: '11px 24px', fontSize: '14px' },
  lg: { padding: '14px 32px', fontSize: '16px' },
};

const VARIANT_MAP = {
  gold:  { background: '#C8A258', color: '#0F2137', border: 'none' },
  ghost: { background: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' },
  navy:  { background: '#0F2137', color: '#C8A258', border: 'none' },
};

const HOVER_MAP = {
  gold:  { background: '#D4B06A', transform: 'translateY(-1px)' },
  ghost: { color: '#C8A258', borderColor: '#C8A258' },
  navy:  { background: '#162B44' },
};

export default function Button(props) {
  const variant  = props.variant || 'gold';
  const size     = props.size    || 'md';
  const children = props.children;
  const style    = props.style   || {};
  const onClick  = props.onClick;
  const disabled = props.disabled;
  const type     = props.type    || 'button';

  const sizeStyle    = SIZE_MAP[size]       || SIZE_MAP.md;
  const variantStyle = VARIANT_MAP[variant] || VARIANT_MAP.gold;

  const mergedStyle = Object.assign({}, BASE, sizeStyle, variantStyle, style,
    disabled ? { opacity: 0.5, cursor: 'not-allowed', transform: 'none' } : {}
  );

  function handleMouseEnter(ev) {
    if (disabled) return;
    const hover = HOVER_MAP[variant] || {};
    if (hover.background)  ev.currentTarget.style.background  = hover.background;
    if (hover.transform)   ev.currentTarget.style.transform   = hover.transform;
    if (hover.color)       ev.currentTarget.style.color       = hover.color;
    if (hover.borderColor) ev.currentTarget.style.borderColor = hover.borderColor;
  }

  function handleMouseLeave(ev) {
    if (disabled) return;
    ev.currentTarget.style.background  = variantStyle.background;
    ev.currentTarget.style.transform   = '';
    ev.currentTarget.style.color       = variantStyle.color;
    ev.currentTarget.style.borderColor = '';
  }

  return e('button', {
    type: type,
    disabled: disabled,
    style: mergedStyle,
    onClick: onClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  }, children);
}
