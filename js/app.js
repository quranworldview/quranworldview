/**
 * QUR'AN WORLD VIEW — app.js
 * ─────────────────────────────────────────────────────────────
 * Boot sequence, SPA routing, and auth check.
 * This is the single entry point for the entire QWV root.
 *
 * Boot order:
 *   1. initTheme()   — apply theme before any paint (no flash)
 *   2. initAuth()    — resolve Firebase auth state, cache user profile
 *   3. navigate()    — render the correct page for current URL
 *   4. Wire listeners — popstate, link clicks, lang/theme changes
 *
 * Routing:
 *   SPA routing via history.pushState. No full page reloads.
 *   Dynamic imports — each page is a separate JS module, loaded on demand.
 *   Auth-gated routes redirect to /login if not authenticated.
 *
 * RULE: This is the only file that calls initTheme() and initAuth().
 * RULE: This is the only file that wires the global click interceptor.
 * ─────────────────────────────────────────────────────────────
 */

import { initTheme }              from './core/theme.js';
import { initAuth, authGuard, adminGuard } from './core/auth.js';
import { setLang, getLang }       from './core/i18n.js';

// ── App shell elements ────────────────────────────────────────
const $app      = document.getElementById('app');
const $navbar   = document.getElementById('navbar');
const $footer   = document.getElementById('footer');
const $loader   = document.getElementById('page-loader');

// ── Route table ───────────────────────────────────────────────
// Each value is a function returning a dynamic import.
// Auth-gated routes are wrapped in authGuard / adminGuard.
const ROUTES = {
  '/':             () => import('./pages/home.js'),
  '/journey':      () => import('./pages/journey.js'),
  '/apps':         () => import('./pages/apps.js'),
  '/library':      () => import('./pages/library.js'),
  '/blog':         () => import('./pages/blog.js'),
  '/testimonials': () => import('./pages/testimonials.js'),
  '/about':        () => import('./pages/about.js'),
  '/contact':      () => import('./pages/contact.js'),
  '/login':        () => import('./pages/login.js'),
  '/dashboard':    () => authGuard(() => import('./pages/dashboard.js')),
  '/admin':        () => adminGuard(() => import('./pages/admin.js')),
};

// Routes that match a prefix (e.g. /blog/post-id)
const PREFIX_ROUTES = [
  { prefix: '/blog/', loader: () => import('./pages/blog-post.js') },
];

// Pages that hide the public navbar/footer (use their own chrome)
const CHROME_HIDDEN_ROUTES = ['/dashboard', '/admin'];

// ── Navigation ────────────────────────────────────────────────

/**
 * navigate(path, { pushState })
 * Renders the page matching path. Called on boot and on every navigation.
 */
async function navigate(path, { pushState = false } = {}) {
  if (pushState) {
    window.history.pushState(null, '', path);
  }

  // Show loader
  showLoader();

  // Resolve the page module
  const loader = _resolveRoute(path);

  if (!loader) {
    hideLoader();
    render404();
    return;
  }

  try {
    const module = await loader();

    // Toggle public chrome visibility
    _toggleChrome(path);

    // Re-render navbar so the active link highlight updates
    if ($navbar && $navbar.style.display !== 'none') {
      await _renderNavbar();
    }

    // Each page module exports a default render(container) function
    if (typeof module.default === 'function') {
      $app.innerHTML = '';
      await module.default($app, { path });
    }
  } catch (err) {
    console.error('[QWV router] Failed to load page:', path, err);
    renderError();
  }

  hideLoader();

  // Scroll to top on navigation (unless hash is present)
  if (!window.location.hash) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

function _resolveRoute(path) {
  // Exact match
  if (ROUTES[path]) return ROUTES[path];

  // Prefix match (e.g. /blog/some-post-id)
  for (const { prefix, loader } of PREFIX_ROUTES) {
    if (path.startsWith(prefix)) return loader;
  }

  return null;
}

function _toggleChrome(path) {
  const hiddenBase = CHROME_HIDDEN_ROUTES.some(r => path === r || path.startsWith(r + '/'));
  if ($navbar) $navbar.style.display = hiddenBase ? 'none' : '';
  if ($footer) $footer.style.display = hiddenBase ? 'none' : '';
}

// ── Programmatic navigation helper (for use by all page modules) ──
export function goTo(path) {
  navigate(path, { pushState: true });
}

// ── Global click interceptor ──────────────────────────────────
// Intercepts all <a href> clicks and routes them through the SPA
// instead of triggering a full page reload.
function _wireLinks() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');

    // Let external links, mailto, tel, and hash-only links pass through
    if (
      !href ||
      href.startsWith('http') ||
      href.startsWith('//') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href === '#' ||
      link.target === '_blank' ||
      link.hasAttribute('data-external')
    ) return;

    e.preventDefault();
    navigate(href, { pushState: true });
  });
}

// ── Browser back/forward ──────────────────────────────────────
function _wirePopState() {
  window.addEventListener('popstate', () => {
    navigate(window.location.pathname);
  });
}

// ── Custom event bus ──────────────────────────────────────────
// Other modules dispatch these events; app.js handles routing ones.
function _wireEvents() {
  // Internal navigation event (e.g. from auth.js logout)
  window.addEventListener('qwv:navigate', (e) => {
    navigate(e.detail.path, { pushState: true });
  });

  // Language change — re-render current page
  window.addEventListener('qwv:lang-changed', () => {
    // Re-render the navbar (language toggle updates immediately)
    _renderNavbar();
    // Re-render the current page content
    navigate(window.location.pathname, { pushState: false });
  });

  // Theme change — navbar icon updates; no page re-render needed
  window.addEventListener('qwv:theme-changed', () => {
    _renderNavbar();
  });

  // Offline / online banner
  window.addEventListener('offline', _showOfflineBanner);
  window.addEventListener('online',  _hideOfflineBanner);
}

// ── Navbar / Footer rendering ─────────────────────────────────
async function _renderNavbar() {
  if (!$navbar) return;
  const { renderNavbar } = await import('./components/navbar.js');
  renderNavbar($navbar);
}

async function _renderFooter() {
  if (!$footer) return;
  const { renderFooter } = await import('./components/footer.js');
  renderFooter($footer);
}

// ── Loader helpers ────────────────────────────────────────────
function showLoader() {
  if ($loader) {
    $loader.classList.remove('fade-out');
    $loader.style.display = 'flex';
  }
}

function hideLoader() {
  if ($loader) {
    $loader.classList.add('fade-out');
    setTimeout(() => {
      if ($loader.classList.contains('fade-out')) {
        $loader.style.display = 'none';
      }
    }, 400);
  }
}

// ── 404 / Error states ────────────────────────────────────────
function render404() {
  $app.innerHTML = `
    <div style="
      min-height: calc(100vh - var(--navbar-height));
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-8);
      gap: var(--space-6);
    ">
      <p style="
        font-family: var(--font-arabic);
        font-size: var(--arabic-xl);
        color: var(--gold);
        direction: rtl;
        line-height: 1.8;
      ">٤٠٤</p>
      <h1 style="font-family: var(--font-display); color: var(--off-white); font-size: var(--text-2xl);">
        Page Not Found
      </h1>
      <p style="color: var(--text-muted); max-width: 36ch;">
        This path doesn't exist in the journey yet.
      </p>
      <a href="/" class="btn btn-outline">Return Home</a>
    </div>
  `;
}

function renderError() {
  $app.innerHTML = `
    <div style="
      min-height: calc(100vh - var(--navbar-height));
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-8);
      gap: var(--space-6);
    ">
      <h1 style="font-family: var(--font-display); color: var(--off-white); font-size: var(--text-xl);">
        Something went wrong.
      </h1>
      <p style="color: var(--text-muted);">Please refresh and try again.</p>
      <button class="btn btn-outline" onclick="window.location.reload()">Refresh</button>
    </div>
  `;
}

// ── Offline banner ────────────────────────────────────────────
function _showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0;
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: var(--text-sm);
    text-align: center;
    padding: var(--space-3) var(--space-4);
    z-index: var(--z-toast);
    animation: fade-up 0.3s ease forwards;
  `;
  banner.textContent = "You're offline. Some content may not be available.";
  document.body.appendChild(banner);
}

function _hideOfflineBanner() {
  document.getElementById('offline-banner')?.remove();
}

// ── PWA Service Worker registration ──────────────────────────
function _registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.warn('[QWV] Service worker registration failed:', err);
      });
    });
  }
}

// ── BOOT ──────────────────────────────────────────────────────
async function boot() {
  // 1. Theme — must happen before first paint to avoid flash
  initTheme();

  // 2. Auth — resolves Firebase auth state, caches user profile
  await initAuth();

  // 3. Render persistent chrome (navbar + footer)
  await Promise.all([_renderNavbar(), _renderFooter()]);

  // 4. Wire all event listeners
  _wireLinks();
  _wirePopState();
  _wireEvents();

  // 5. Register PWA service worker
  _registerServiceWorker();

  // 6. Render the current route
  await navigate(window.location.pathname);
}

// Start
boot();
