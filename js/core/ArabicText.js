/**
 * QUR'AN WORLD VIEW — ArabicText.js
 * ─────────────────────────────────────────────────────────────
 * Arabic text rendering utility.
 *
 * RULE: Every Arabic string rendered in the app must pass through
 * one of the functions in this file.
 * This ensures consistent font (Amiri), direction (RTL),
 * diacritics, line-height, and sizing across all apps.
 *
 * Never render Arabic text as a raw string in HTML.
 * Never apply Arabic font or direction inline in component files.
 *
 * Usage:
 *   import { arabicText, ayahText, basmala } from '../core/ArabicText.js';
 *
 *   el.innerHTML = arabicText('بِسْمِ اللَّهِ', { size: 'lg' });
 * ─────────────────────────────────────────────────────────────
 */

// ── Size map ─────────────────────────────────────────────────
// Maps size keys to CSS custom property values from design.css
const SIZE_MAP = {
  sm:  'var(--arabic-sm)',   /* 20px — inline, small labels  */
  md:  'var(--arabic-md)',   /* 28px — body, card text       */
  lg:  'var(--arabic-lg)',   /* 36px — section headings      */
  xl:  'var(--arabic-xl)',   /* 48px — hero, ayah display    */
  '2xl': 'var(--arabic-2xl)',/* 64px — full-screen hero      */
};

// ── Primary render function ───────────────────────────────────

/**
 * arabicText(text, options)
 *
 * Returns an HTML string for an Arabic text span.
 * Always RTL, always Amiri, always accessible.
 *
 * @param {string} text     — The Arabic string to render
 * @param {object} options
 *   @param {string} [size='md']         — Size key: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 *   @param {string} [colour='default']  — 'default' | 'gold' | 'muted' | 'crimson'
 *   @param {string} [align='right']     — 'right' | 'center' (RTL, so center is valid)
 *   @param {string} [weight='400']      — '400' | '700'
 *   @param {string} [tag='span']        — HTML element to use: 'span' | 'p' | 'div' | 'h2' etc.
 *   @param {string} [className='']      — Additional CSS classes
 *   @param {string} [ariaLabel='']      — aria-label override (for screen readers)
 *
 * @returns {string} HTML string
 */
export function arabicText(text, {
  size     = 'md',
  colour   = 'default',
  align    = 'right',
  weight   = '400',
  tag      = 'span',
  className = '',
  ariaLabel = '',
} = {}) {
  if (!text) return '';

  const fontSize   = SIZE_MAP[size] || SIZE_MAP['md'];
  const colorStyle = _colourStyle(colour);
  const labelAttr  = ariaLabel ? ` aria-label="${_escAttr(ariaLabel)}"` : '';

  const style = [
    `font-family: var(--font-arabic)`,
    `font-size: ${fontSize}`,
    `font-weight: ${weight}`,
    `direction: rtl`,
    `text-align: ${align}`,
    `line-height: 1.85`,
    `display: block`,
    colorStyle,
  ].filter(Boolean).join('; ');

  const classes = ['arabic-text', className].filter(Boolean).join(' ');

  return `<${tag}
    class="${classes}"
    lang="ar"
    dir="rtl"
    style="${style}"
    ${labelAttr}
  >${_escHtml(text)}</${tag}>`;
}

// ── Ayah display ─────────────────────────────────────────────

/**
 * ayahText(text, options)
 *
 * Specialised renderer for full Qur'anic ayahs.
 * Defaults to xl size, centred, in a <p> tag, with appropriate
 * line-height for tashkeel (diacritics).
 *
 * @param {string} text     — Uthmani Arabic text of the ayah
 * @param {object} options  — Same options as arabicText() with different defaults
 * @returns {string} HTML string
 */
export function ayahText(text, {
  size      = 'xl',
  colour    = 'default',
  align     = 'center',
  weight    = '400',
  tag       = 'p',
  className = '',
  ariaLabel = '',
} = {}) {
  return arabicText(text, { size, colour, align, weight, tag, className, ariaLabel });
}

// ── Surah / Ayah reference ────────────────────────────────────

/**
 * ayahRef(surahName, ayahNumber)
 *
 * Returns a small Arabic reference label, e.g. for "Al-Baqarah: 255"
 * Used below displayed ayahs.
 *
 * @param {string} surahName  — Arabic name of the surah
 * @param {number} ayahNumber — Ayah number as integer
 * @returns {string} HTML string
 */
export function ayahRef(surahName, ayahNumber) {
  if (!surahName || !ayahNumber) return '';
  // Ayah number in Arabic-Indic numerals
  const arabicNum = _toArabicNumerals(ayahNumber);
  const refText   = `${surahName} ﴿${arabicNum}﴾`;
  return arabicText(refText, {
    size:   'sm',
    colour: 'muted',
    align:  'center',
    tag:    'span',
  });
}

// ── Basmala ──────────────────────────────────────────────────

/**
 * basmala(options)
 *
 * Returns the Basmala in full Unicode Arabic.
 * Use at the top of lesson screens, covers, etc.
 *
 * @param {object} options — size, colour, align (same as arabicText)
 * @returns {string} HTML string
 */
export function basmala({
  size   = 'lg',
  colour = 'gold',
  align  = 'center',
} = {}) {
  return arabicText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', {
    size, colour, align,
    tag:       'p',
    ariaLabel: 'Bismillah ir-Rahman ir-Rahim',
  });
}

// ── Standalone Arabic word / root ────────────────────────────

/**
 * arabicWord(text, options)
 *
 * For single Arabic words or roots — e.g. vocabulary display in Alif.
 * Defaults to lg, centred, inline-block.
 */
export function arabicWord(text, {
  size    = 'lg',
  colour  = 'default',
  weight  = '700',
  className = '',
} = {}) {
  return arabicText(text, {
    size, colour, weight, className,
    tag:   'span',
    align: 'center',
  });
}

// ── DOM helper ───────────────────────────────────────────────

/**
 * renderArabic(element, text, options)
 *
 * Directly sets innerHTML of a DOM element with arabicText output.
 * Convenience wrapper to avoid .innerHTML = arabicText(...) everywhere.
 *
 * @param {HTMLElement} element
 * @param {string}      text
 * @param {object}      options  — same as arabicText()
 */
export function renderArabic(element, text, options = {}) {
  if (!element) return;
  element.innerHTML = arabicText(text, options);
}

// ── Private helpers ──────────────────────────────────────────

function _colourStyle(colour) {
  const map = {
    'default': 'color: var(--off-white)',
    'gold':    'color: var(--gold)',
    'muted':   'color: var(--text-muted)',
    'crimson': 'color: var(--crimson)',
  };
  return map[colour] || map['default'];
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _escAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// Convert Western numerals to Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩)
function _toArabicNumerals(num) {
  return String(num).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}
