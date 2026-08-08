import React, { useRef, useState, useEffect } from 'react';

/**
 * A SINGLE date input box that displays/accepts DD/MM/YYYY (slashes)
 * instead of the browser-locale-dependent format a plain
 * <input type="date"> shows.
 *
 * Rewritten (round 5) to drop the previous "hide the native input's text
 * and overlay a styled span on top via CSS position:absolute/relative"
 * approach entirely - that technique depends on an external stylesheet
 * rule (.date-single { position: relative }) being correctly applied for
 * the absolutely-positioned overlay to stay confined to its box. If that
 * CSS rule is ever missed, overridden, or fails to load for any reason,
 * the overlay escapes to the nearest positioned ancestor (or the page
 * root) instead of staying inside its own field - which is exactly what
 * produced a detached, unstyled date input floating at the top of an
 * otherwise blank page in production.
 *
 * This version has no such dependency: the VISIBLE control is a completely
 * normal, in-flow <input type="text"> with a hand-rolled DD/MM/YYYY typing
 * mask (auto-inserts slashes as digits are typed) - standard box model, no
 * positioning tricks, nothing that can escape its container regardless of
 * what the surrounding stylesheet does or doesn't do. A tiny native
 * <input type="date"> still exists for the calendar-picker button, but
 * it's pushed off-screen via inline styles (not a CSS class, so it can't
 * be affected by any external stylesheet issue either) rather than
 * layered on top of anything.
 *
 * Stores/emits the value as an ISO "YYYY-MM-DD" string, unchanged from
 * before, so nothing downstream needs to change.
 */
function isoToDisplay(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

function displayToIso(display) {
  const digits = display.replace(/\D/g, '');
  if (digits.length !== 8) return '';
  const d = digits.slice(0, 2);
  const mo = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  const dn = Number(d);
  const mon = Number(mo);
  if (dn < 1 || dn > 31 || mon < 1 || mon > 12) return '';
  return `${y}-${mo}-${d}`;
}

// Formats raw typed digits into "DD/MM/YYYY" as the person types, inserting
// slashes automatically rather than requiring them to type the slashes.
function maskDigitsAsDisplay(digits) {
  const d = digits.slice(0, 2);
  const mo = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  let out = d;
  if (mo) out += `/${mo}`;
  if (y) out += `/${y}`;
  return out;
}

export default function DateInputDMY({ value, onChange, required, disabled, className }) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const hiddenDateRef = useRef(null);

  // Keep in sync if the parent resets/changes `value` from outside (e.g.
  // loading an existing delivery note for editing).
  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleTextChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    const masked = maskDigitsAsDisplay(digits);
    setDisplay(masked);
    const iso = displayToIso(masked);
    if (iso) onChange(iso);
    else if (digits.length === 0) onChange('');
  };

  const openPicker = () => {
    if (disabled) return;
    const el = hiddenDateRef.current;
    if (!el) return;
    if (el.showPicker) {
      try {
        el.showPicker();
        return;
      } catch (e) {
        /* fall through to focus() below */
      }
    }
    el.focus();
  };

  return (
    <div className={`date-single${className ? ` ${className}` : ''}`}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        value={display}
        onChange={handleTextChange}
        disabled={disabled}
        required={required}
        className="date-single-text"
        maxLength={10}
      />
      <button
        type="button"
        className="date-single-icon-btn"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Open calendar"
        tabIndex={-1}
      >
        📅
      </button>
      {/* Off-screen via inline styles (not a class) so it can never be
          affected by any external stylesheet issue - exists purely to
          provide the native calendar-picker popup via showPicker(). */}
      <input
        ref={hiddenDateRef}
        type="date"
        value={value || ''}
        onChange={(e) => {
          onChange(e.target.value);
          setDisplay(isoToDisplay(e.target.value));
        }}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '-1000px',
          left: '-1000px',
          width: '1px',
          height: '1px',
          opacity: 0,
          border: 'none',
          padding: 0,
          margin: 0,
        }}
      />
    </div>
  );
}
