import React from 'react';

/**
 * Small inline SVG icon set for the "premium, no-photos" visual pass -
 * construction-themed but abstract/geometric rather than literal stock
 * photography, so it stays lightweight and license-free. Each icon inherits
 * currentColor so it can be recolored per stat card via CSS.
 */
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };

export function IconRupee(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 4h12M6 9h12M6 4c4 0 7 1.5 7 4.5S10 13 6 13h9l-9 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClock(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCalendar(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconStack(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlertTriangle(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4 2 20h20L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10.5v4M12 17.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconWallet(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6.5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14" r="1.2" fill="currentColor" />
      <path d="M6 6.5 15 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconBrandMark(props) {
  // Abstract construction mark for the login screen - stacked beams/roof
  // silhouette, purely geometric (no photography, no stock imagery).
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" {...props}>
      <polygon points="60,14 108,52 92,52 92,100 28,100 28,52 12,52" fill="currentColor" opacity="0.12" />
      <path d="M60 14 108 52H92v48H28V52H12L60 14Z" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" fill="none" />
      <path d="M44 100V72h32v28" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
