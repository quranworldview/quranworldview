/**
 * QUR'AN WORLD VIEW — navbar.js
 * ─────────────────────────────────────────────────────────────
 * Public site navbar component.
 *
 * Features:
 *  - QWV logo (left) → links to /
 *  - Nav links: Home · Journey · Apps · Blog · Testimonials · About · Contact
 *  - Right side: Language toggle (EN · HI · UR) + Theme toggle + Login/Dashboard
 *  - Mobile: hamburger → full-screen overlay nav
 *  - On scroll: sticky with backdrop blur
 *  - Active link highlight based on current path
 *  - Auth-aware: shows "Dashboard" + "Sign Out" when logged in
 *
 * RULE: This component is for the public site only.
 *       The dashboard has its own chrome. No shared navbar.
 * ─────────────────────────────────────────────────────────────
 */

import { t, getLang, setLang }                      from '../core/i18n.js';
import { getThemePreference, cycleTheme, themeIcon } from '../core/theme.js';
import { isLoggedIn, logout }                        from '../core/auth.js';

const BASE = window.QWV_BASE || '';

// ── Render ────────────────────────────────────────────────────

/**
 * renderNavbar(container)
 * Renders the navbar into the given container element.
 * Called by app.js on boot and on lang/theme change.
 */
export function renderNavbar(container) {
  container.innerHTML = _buildNavbar();
  _wireNavbar(container);
}

// ── Build HTML ────────────────────────────────────────────────

function _buildNavbar() {
  const lang      = getLang();
  const loggedIn  = isLoggedIn();
  const themePref = getThemePreference();
  const path      = window.location.pathname;

  const navLinks = _getNavLinks(loggedIn);

  return `
    <nav class="qwv-navbar" id="qwv-navbar" role="navigation" aria-label="Main navigation">

      <!-- Background blur layer -->
      <div class="navbar-bg" aria-hidden="true"></div>

      <div class="navbar-inner container">

        <!-- Logo -->
        <a href="${BASE}/" class="navbar-logo" aria-label="Qur'an World View — Home">
          <img src="/icons/logo.png" alt="" class="navbar-logo-img" width="36" height="36" aria-hidden="true" />
          <span class="navbar-logo-text">Qur'an World View</span>
        </a>

        <!-- Desktop nav links -->
        <ul class="navbar-links" role="list">
          ${navLinks.map(link => `
            <li>
              <a href="${link.href}"
                class="navbar-link ${path === link.href || (link.href !== '/' && path.startsWith(link.href)) ? 'active' : ''}"
                ${link.href.startsWith('http') ? 'data-external target="_blank" rel="noopener"' : ''}
              >${t(link.key)}</a>
            </li>
          `).join('')}
        </ul>

        <!-- Right controls -->
        <div class="navbar-controls">

          <!-- Language toggle -->
          <div class="lang-toggle" role="group" aria-label="Language">
            ${['en', 'hi', 'ur'].map(code => `
              <button
                class="lang-toggle-btn ${lang === code ? 'active' : ''}"
                data-lang="${code}"
                aria-label="${_langLabel(code)}"
                aria-pressed="${lang === code}"
              >${code.toUpperCase()}</button>
            `).join('')}
          </div>

          <!-- Theme toggle -->
          <button
            class="theme-toggle"
            id="theme-toggle-btn"
            aria-label="Toggle theme (current: ${themePref})"
            title="${t('theme_' + themePref)}"
          >${themeIcon(themePref)}</button>

          <!-- Auth CTA -->
          ${loggedIn
            ? `<a href="${BASE}/dashboard" class="btn btn-outline btn-sm">${t('nav_dashboard')}</a>`
            : `<a href="${BASE}/login" class="btn btn-primary btn-sm">${t('nav_login')}</a>`
          }

          <!-- Hamburger (mobile only) -->
          <button
            class="navbar-hamburger"
            id="navbar-hamburger"
            aria-label="Open menu"
            aria-expanded="false"
            aria-controls="navbar-mobile-overlay"
          >
            <span class="hamburger-bar"></span>
            <span class="hamburger-bar"></span>
            <span class="hamburger-bar"></span>
          </button>

        </div>
      </div>

      <!-- Mobile overlay -->
      <div class="navbar-mobile-overlay" id="navbar-mobile-overlay" inert role="dialog" aria-label="Navigation menu" aria-modal="true">
        <div class="mobile-overlay-inner">

          <!-- Close button -->
          <button class="mobile-close-btn" id="mobile-close-btn" aria-label="Close menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              aria-hidden="true">
              <line x1="18" y1="6"  x2="6" y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>

          <!-- Mobile links -->
          <ul class="mobile-nav-links" role="list">
            ${navLinks.map((link, i) => `
              <li class="animate-fade-up delay-${i + 1}" style="opacity:0;">
                <a href="${link.href}"
                  class="mobile-nav-link ${path === link.href ? 'active' : ''}"
                >${t(link.key)}</a>
              </li>
            `).join('')}
          </ul>

          <!-- Mobile lang toggle -->
          <div class="mobile-lang-toggle" role="group" aria-label="Language">
            ${['en', 'hi', 'ur'].map(code => `
              <button
                class="mobile-lang-btn ${lang === code ? 'active' : ''}"
                data-lang="${code}"
              >${_langLabel(code)}</button>
            `).join('')}
          </div>

          <!-- Mobile auth -->
          <div class="mobile-auth">
            ${loggedIn
              ? `
                <a href="${BASE}/dashboard" class="btn btn-outline btn-full">${t('nav_dashboard')}</a>
                <button class="btn btn-ghost btn-full" id="mobile-logout-btn">${t('nav_logout')}</button>
              `
              : `<a href="${BASE}/login" class="btn btn-primary btn-full">${t('nav_login')}</a>`
            }
          </div>

        </div>
      </div>

    </nav>
  `;
}

// ── Wire interactions ─────────────────────────────────────────

function _wireNavbar(container) {
  const navbar   = container.querySelector('#qwv-navbar');
  const hamburger = container.querySelector('#navbar-hamburger');
  const overlay  = container.querySelector('#navbar-mobile-overlay');
  const closeBtn = container.querySelector('#mobile-close-btn');
  const themeBtn = container.querySelector('#theme-toggle-btn');
  const logoutBtn = container.querySelector('#mobile-logout-btn');

  // ── Scroll → sticky blur ──
  const scrollHandler = () => {
    if (navbar) {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    }
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });
  scrollHandler(); // apply on mount

  // ── Hamburger → open overlay ──
  hamburger?.addEventListener('click', () => {
    _openMobileMenu(hamburger, overlay);
  });

  // ── Close button ──
  closeBtn?.addEventListener('click', () => {
    _closeMobileMenu(hamburger, overlay);
  });

  // ── Close on overlay background click ──
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) _closeMobileMenu(hamburger, overlay);
  });

  // ── Close on Escape ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('open')) {
      _closeMobileMenu(hamburger, overlay);
    }
  });

  // ── Close on internal link click (mobile) ──
  overlay?.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener('click', () => {
      _closeMobileMenu(hamburger, overlay);
    });
  });

  // ── Language toggle (desktop + mobile) ──
  container.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      const uid  = null; // Will be wired to auth if logged in — see below
      setLang(lang, { syncToFirebase: isLoggedIn(), uid });
      // Re-render handled by qwv:lang-changed event in app.js
    });
  });

  // ── Theme toggle ──
  themeBtn?.addEventListener('click', () => {
    cycleTheme();
    // Re-render navbar so the icon updates to match new preference
    renderNavbar(container);
  });

  // ── Logout (mobile) ──
  logoutBtn?.addEventListener('click', () => {
    logout();
  });

  // ── Desktop logout (if we add a dropdown later, wire here) ──
}

function _openMobileMenu(hamburger, overlay) {
  hamburger?.setAttribute('aria-expanded', 'true');
  overlay?.classList.add('open');
  overlay?.removeAttribute('inert');
  document.body.style.overflow = 'hidden';

  // Focus the close button for keyboard/screen reader users
  const closeBtn = overlay?.querySelector('#mobile-close-btn');
  setTimeout(() => closeBtn?.focus(), 50);

  // Trigger animations on list items
  overlay?.querySelectorAll('.animate-fade-up').forEach((el, i) => {
    el.style.animationDelay = `${(i + 1) * 60}ms`;
    el.style.opacity = '0';
    void el.offsetWidth;
    el.classList.add('visible');
    el.style.opacity = '';
  });
}

function _closeMobileMenu(hamburger, overlay) {
  hamburger?.setAttribute('aria-expanded', 'false');
  overlay?.classList.remove('open');
  overlay?.setAttribute('inert', '');
  document.body.style.overflow = '';
  // Return focus to hamburger
  hamburger?.focus();
}

// ── Helpers ───────────────────────────────────────────────────

function _getNavLinks(loggedIn) {
  const links = [
    { key: 'nav_home',         href: BASE + '/' },
    { key: 'nav_journey',      href: BASE + '/journey' },
    { key: 'nav_apps',         href: BASE + '/apps' },
    { key: 'nav_blog',         href: BASE + '/blog' },
    { key: 'nav_testimonials', href: BASE + '/testimonials' },
    { key: 'nav_about',        href: BASE + '/about' },
    { key: 'nav_contact',      href: BASE + '/contact' },
  ];
  return links;
}

function _langLabel(code) {
  return { en: 'English', hi: 'हिन्दी', ur: 'اردو' }[code] || code;
}
