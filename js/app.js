/**
 * QUR'AN WORLD VIEW — app.js
 * ─────────────────────────────────────────────────────────────
 * Boot sequence, SPA routing, and auth check.
 *
 * Base path support:
 *   window.QWV_BASE is set by index.html before this module loads.
 *   It equals '' on root deployments (Cloudflare Pages, localhost)
 *   and '/subfolder' on GitHub Pages (e.g. '/quranworldview').
 *   All route matching strips the base prefix first.
 *   All pushState calls re-add it.
 *
 * RULE: This is the only file that calls initTheme() and initAuth().
 * RULE: This is the only file that wires the global click interceptor.
 * ─────────────────────────────────────────────────────────────
 */

import { initTheme }                        from './core/theme.js';
import { initAuth, authGuard, adminGuard }  from './core/auth.js';
import { setLang, getLang }                 from './core/i18n.js';

// ── Base path ─────────────────────────────────────────────────
const BASE = window.QWV_BASE || '';

/** Strip base prefix from a full pathname to get the SPA route */
function toRoute(pathname) {
  if (BASE && pathname.startsWith(BASE)) {
    const r = pathname.slice(BASE.length) || '/';
    return r.startsWith('/') ? r : '/' + r;
  }
  return pathname || '/';
}

/** Add base prefix to an SPA route for use in pushState / hrefs */
function toHref(route) {
  return BASE + (route.startsWith('/') ? route : '/' + route);
}

// ── App shell elements ────────────────────────────────────────
const $app    = document.getElementById('app');
const $navbar = document.getElementById('navbar');
const $footer = document.getElementById('footer');
const $loader = document.getElementById('page-loader');

// ── Route table ───────────────────────────────────────────────
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
  '/welcome':      async () => authGuard(() => import('./pages/welcome.js')),
  '/apply':        () => import('./pages/apply.js'),
  '/dashboard':    async () => authGuard(() => import('./pages/dashboard.js')),
  '/admin':        async () => adminGuard(() => import('./pages/admin.js')),
};

const PREFIX_ROUTES = [
  { prefix: '/blog/', loader: () => import('./pages/blog-post.js') },
];

const CHROME_HIDDEN = ['/dashboard', '/admin', '/apply', '/welcome'];

// ── Navigation ────────────────────────────────────────────────

async function navigate(pathname, { pushState = false } = {}) {
  const route = toRoute(pathname);

  if (pushState) {
    window.history.pushState(null, '', toHref(route));
  }

  showLoader();

  const loader = _resolveRoute(route);
  if (!loader) {
    hideLoader();
    render404();
    return;
  }

  try {
    // loader() may return a Promise<module> or Promise<Promise<module>>
    // (when authGuard/adminGuard are async). Double-await resolves both.
    const mod = await Promise.resolve(await loader());

    _toggleChrome(route);

    if ($navbar && $navbar.style.display !== 'none') {
      await _renderNavbar();
    }

    if (typeof mod.default === 'function') {
      $app.innerHTML = '';
      await mod.default($app, { path: route });
    }
  } catch (err) {
    console.error('[QWV router] Failed to load page:', route, err);
    renderError();
  }

  hideLoader();

  if (!window.location.hash) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

function _resolveRoute(route) {
  if (ROUTES[route]) return ROUTES[route];
  for (const { prefix, loader } of PREFIX_ROUTES) {
    if (route.startsWith(prefix)) return loader;
  }
  return null;
}

function _toggleChrome(route) {
  const hide = CHROME_HIDDEN.some(r => route === r || route.startsWith(r + '/'));
  if ($navbar) $navbar.style.display = hide ? 'none' : '';
  if ($footer) $footer.style.display = hide ? 'none' : '';
}

// ── Programmatic navigation (exported for page modules) ───────
export function goTo(route) {
  navigate(route, { pushState: true });
}

// ── Global link interceptor ───────────────────────────────────
function _wireLinks() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Let external, mailto, tel, hash-only, _blank links pass through
    if (
      href.startsWith('http') ||
      href.startsWith('//') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href === '#' ||
      link.target === '_blank' ||
      link.hasAttribute('data-external')
    ) return;

    // Resolve relative hrefs against BASE
    // e.g. href="/journey" on base '/quranworldview' → navigate to route '/journey'
    let route = href;
    if (BASE && href.startsWith(BASE)) {
      route = href.slice(BASE.length) || '/';
    }
    // Only intercept if it maps to a known route
    if (!route.startsWith('/')) return;

    e.preventDefault();
    navigate(route, { pushState: true });
  });
}

// ── Browser back/forward ──────────────────────────────────────
function _wirePopState() {
  window.addEventListener('popstate', () => {
    navigate(window.location.pathname);
  });
}

// ── Event bus ────────────────────────────────────────────────
function _wireEvents() {
  window.addEventListener('qwv:navigate', (e) => {
    navigate(e.detail.path, { pushState: true });
  });

  window.addEventListener('qwv:lang-changed', () => {
    _renderNavbar();
    navigate(toRoute(window.location.pathname), { pushState: false });
  });

  window.addEventListener('qwv:theme-changed', () => {
    _renderNavbar();
  });

  window.addEventListener('offline', _showOfflineBanner);
  window.addEventListener('online',  _hideOfflineBanner);
}

// ── Navbar / Footer ───────────────────────────────────────────
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

// ── Loader ────────────────────────────────────────────────────
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
      if ($loader.classList.contains('fade-out')) $loader.style.display = 'none';
    }, 400);
  }
}

// ── 404 / Error ───────────────────────────────────────────────
function render404() {
  $app.innerHTML = `
    <div style="min-height:calc(100vh - var(--navbar-height));display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;padding:var(--space-8);gap:var(--space-6);">
      <p style="font-family:var(--font-arabic);font-size:var(--arabic-xl);color:var(--gold);
        direction:rtl;line-height:1.8;">٤٠٤</p>
      <h1 style="font-family:var(--font-display);color:var(--off-white);font-size:var(--text-2xl);">
        Page Not Found
      </h1>
      <p style="color:var(--text-muted);max-width:36ch;">This path doesn't exist in the journey yet.</p>
      <a href="${toHref('/')}" class="btn btn-outline">Return Home</a>
    </div>`;
}

function renderError() {
  $app.innerHTML = `
    <div style="min-height:calc(100vh - var(--navbar-height));display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;padding:var(--space-8);gap:var(--space-6);">
      <h1 style="font-family:var(--font-display);color:var(--off-white);font-size:var(--text-xl);">
        Something went wrong.
      </h1>
      <p style="color:var(--text-muted);">Please refresh and try again.</p>
      <button class="btn btn-outline" onclick="window.location.reload()">Refresh</button>
    </div>`;
}

// ── Offline banner ────────────────────────────────────────────
function _showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const b = document.createElement('div');
  b.id = 'offline-banner';
  b.style.cssText = `position:fixed;bottom:0;left:0;right:0;background:var(--bg-surface);
    border-top:1px solid var(--border);color:var(--text-muted);font-size:var(--text-sm);
    text-align:center;padding:var(--space-3) var(--space-4);z-index:var(--z-toast);`;
  b.textContent = "You're offline. Some content may not be available.";
  document.body.appendChild(b);
}

function _hideOfflineBanner() {
  document.getElementById('offline-banner')?.remove();
}

// ── Service Worker ────────────────────────────────────────────
function _registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // sw.js must be at the base path scope
      navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' })
        .catch(err => console.warn('[QWV] SW registration failed:', err));
    });
  }
}

// ── BOOT ─────────────────────────────────────────────────────
async function boot() {
  initTheme();
  await initAuth();
  await Promise.all([_renderNavbar(), _renderFooter()]);
  _wireLinks();
  _wirePopState();
  _wireEvents();
  _registerServiceWorker();
  await navigate(window.location.pathname);
}

boot();
