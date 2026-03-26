/**
 * QUR'AN WORLD VIEW — theme.js
 * ─────────────────────────────────────────────────────────────
 * Three-way theme management: Dark · Light · System
 *
 * RULE: All theme logic lives here. Never duplicated in any other file.
 * RULE: The [data-theme] attribute on <html> drives all CSS theming.
 * RULE: localStorage key is 'qwv_theme'.
 *
 * Theme resolution:
 *   - 'dark'   → always dark, regardless of OS
 *   - 'light'  → always light, regardless of OS
 *   - 'system' → respects prefers-color-scheme media query in real time
 *
 * Default for first-time visitors: 'system'
 *
 * Architecture Note (v1.1):
 *   This module is imported by app.js on boot.
 *   initTheme() must be called before any components render
 *   to prevent flash of incorrect theme.
 * ─────────────────────────────────────────────────────────────
 */

// ── Constants ─────────────────────────────────────────────────
const STORAGE_KEY  = 'qwv_theme';
const VALID_THEMES = ['dark', 'light', 'system'];

// ── Module state ──────────────────────────────────────────────
let _preference = 'system';  // What the user has chosen
let _applied    = 'dark';    // What is actually active on <html>
let _mediaQuery = null;       // Reference to the media query listener

// ── Boot ──────────────────────────────────────────────────────

/**
 * initTheme()
 *
 * Call once from app.js as early as possible — before any DOM rendering.
 * Reads stored preference, applies theme to <html>, sets up
 * the system/OS change listener if needed.
 */
export function initTheme() {
  _preference = _loadPreference();
  _applyTheme(_preference);
  _setupSystemListener();
}

// ── Public API ────────────────────────────────────────────────

/**
 * getThemePreference()
 * Returns the user's stored preference: 'dark' | 'light' | 'system'
 */
export function getThemePreference() {
  return _preference;
}

/**
 * getAppliedTheme()
 * Returns what is actually rendered: 'dark' | 'light'
 * (system resolves to one of these)
 */
export function getAppliedTheme() {
  return _applied;
}

/**
 * setTheme(preference)
 * Sets and persists the theme preference.
 * Dispatches 'qwv:theme-changed' for any component that needs to update.
 *
 * @param {'dark'|'light'|'system'} preference
 */
export function setTheme(preference) {
  if (!VALID_THEMES.includes(preference)) return;

  _preference = preference;
  localStorage.setItem(STORAGE_KEY, preference);
  _applyTheme(preference);
  _setupSystemListener();

  window.dispatchEvent(new CustomEvent('qwv:theme-changed', {
    detail: { preference, applied: _applied }
  }));
}

/**
 * cycleTheme()
 * Cycles: dark → light → system → dark
 * Useful for a single toggle button.
 */
export function cycleTheme() {
  const cycle = { dark: 'light', light: 'system', system: 'dark' };
  setTheme(cycle[_preference] || 'system');
}

/**
 * isDark()
 * Returns true if the currently applied theme is dark.
 */
export function isDark() {
  return _applied === 'dark';
}

// ── Private helpers ───────────────────────────────────────────

function _loadPreference() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID_THEMES.includes(stored) ? stored : 'system';
}

function _resolveTheme(preference) {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  return preference;
}

function _applyTheme(preference) {
  _applied = _resolveTheme(preference);
  document.documentElement.setAttribute('data-theme', _applied);

  // Update meta theme-color for browser chrome (PWA / mobile browser bar)
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      _applied === 'light' ? '#F6F1E8' : '#0A0C10'
    );
  }
}

function _setupSystemListener() {
  // Remove any existing listener before adding a new one
  if (_mediaQuery) {
    _mediaQuery.removeEventListener('change', _onSystemChange);
  }

  // Only listen when preference is 'system'
  if (_preference !== 'system') return;

  _mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
  _mediaQuery.addEventListener('change', _onSystemChange);
}

function _onSystemChange() {
  // Only act if user preference is still 'system'
  if (_preference !== 'system') return;
  _applyTheme('system');

  window.dispatchEvent(new CustomEvent('qwv:theme-changed', {
    detail: { preference: 'system', applied: _applied }
  }));
}

// ── Theme icon helper ─────────────────────────────────────────

/**
 * themeIcon(preference)
 * Returns an SVG icon string for the given theme preference.
 * Used by the theme toggle button in navbar and dashboard.
 *
 * @param {'dark'|'light'|'system'} preference
 * @returns {string} SVG string
 */
export function themeIcon(preference) {
  const icons = {
    dark: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,

    light: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12"  x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>`,

    system: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8"  y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>`,
  };
  return icons[preference] || icons['system'];
}
