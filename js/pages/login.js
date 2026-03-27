/**
 * QUR'AN WORLD VIEW — login.js
 * ─────────────────────────────────────────────────────────────
 * Login page. Two views:
 *   1. Sign In  — email + password
 *   2. Reset    — email only, sends Firebase password reset link
 *
 * Features:
 *  - Firebase Email/Password auth via auth.js
 *  - Post-login redirect: returns to sessionStorage 'qwv_redirect_after_login'
 *    or falls back to /dashboard
 *  - All text through t() — 3 languages
 *  - Floating logo animation on the card
 *  - Inline error messages (no alerts)
 *  - Loading state on submit button
 *  - Password visibility toggle
 *  - If already logged in → redirect immediately to /dashboard
 * ─────────────────────────────────────────────────────────────
 */

import { t, getLang }                        from '../core/i18n.js';
import { loginWithEmail, sendPasswordReset,
         isLoggedIn }                        from '../core/auth.js';

const BASE = window.QWV_BASE || '';

// ── Entry point ───────────────────────────────────────────────
export default function render(container) {
  // Already logged in — redirect
  if (isLoggedIn()) {
    const dest = sessionStorage.getItem('qwv_redirect_after_login') || '/dashboard';
    sessionStorage.removeItem('qwv_redirect_after_login');
    window.history.replaceState(null, '', BASE + dest);
    window.dispatchEvent(new CustomEvent('qwv:navigate', { detail: { path: dest } }));
    return;
  }

  container.innerHTML = buildLoginPage('signin');
  wireLoginPage(container);
}

// ── Views ─────────────────────────────────────────────────────

function buildLoginPage(view) {
  const lang = getLang();
  const isRTL = lang === 'ur';

  return `
    <div class="login-page" ${isRTL ? 'dir="rtl"' : ''}>

      <!-- Background glow -->
      <div class="login-bg-glow" aria-hidden="true"></div>

      <div class="login-card animate-scale-up" role="main">

        <!-- Top accent line (from components.css .login-card::before) -->

        <!-- Logo -->
        <div class="login-logo">
          <img src="${BASE}/icons/logo.png" alt="Qur'an World View"
            class="animate-float" width="64" height="64" />
          <p class="login-brand-name">Qur'an World View</p>
        </div>

        <!-- Sign In view -->
        <div id="view-signin" class="${view === 'signin' ? '' : 'hidden'}">
          <div class="login-heading">
            <h1 class="h2">${t('login_title')}</h1>
            <p class="login-subheading">${t('login_subtitle')}</p>
          </div>

          <div id="signin-error" class="login-error hidden" role="alert"></div>

          <div class="login-form">
            <div class="form-group">
              <label class="form-label" for="signin-email">${t('login_email')}</label>
              <input
                type="email"
                id="signin-email"
                name="email"
                autocomplete="email"
                inputmode="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="signin-password">${t('login_password')}</label>
              <div class="password-field">
                <input
                  type="password"
                  id="signin-password"
                  name="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  required
                />
                <button type="button" class="password-toggle" id="password-toggle"
                  aria-label="Show password" tabindex="-1">
                  ${_eyeIcon(false)}
                </button>
              </div>
            </div>

            <button type="button" class="btn btn-primary btn-full btn-lg" id="signin-btn">
              ${t('login_cta')}
            </button>

            <button type="button" class="login-forgot-link" id="show-reset">
              ${t('login_forgot')}
            </button>
          </div>
        </div>

        <!-- Reset Password view -->
        <div id="view-reset" class="${view === 'reset' ? '' : 'hidden'}">
          <div class="login-heading">
            <h1 class="h2">${t('login_reset_title')}</h1>
            <p class="login-subheading">${t('login_reset_email')}</p>
          </div>

          <div id="reset-error"   class="login-error   hidden" role="alert"></div>
          <div id="reset-success" class="login-success hidden" role="status"></div>

          <div class="login-form">
            <div class="form-group">
              <label class="form-label" for="reset-email">${t('login_email')}</label>
              <input
                type="email"
                id="reset-email"
                name="email"
                autocomplete="email"
                inputmode="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <button type="button" class="btn btn-primary btn-full btn-lg" id="reset-btn">
              ${t('login_reset_cta')}
            </button>

            <button type="button" class="login-forgot-link" id="show-signin">
              ${t('login_back_to_login')}
            </button>
          </div>
        </div>

        <!-- Language toggle at the bottom -->
        <div class="login-lang-toggle">
          <div class="lang-toggle" role="group" aria-label="Language">
            ${['en', 'hi', 'ur'].map(code => `
              <button class="lang-toggle-btn ${getLang() === code ? 'active' : ''}"
                data-lang="${code}"
                aria-pressed="${getLang() === code}">
                ${code.toUpperCase()}
              </button>
            `).join('')}
          </div>
        </div>

      </div>
    </div>
  `;
}

// ── Wire interactions ─────────────────────────────────────────

function wireLoginPage(container) {
  // ── Sign In ──
  const signinBtn    = container.querySelector('#signin-btn');
  const emailInput   = container.querySelector('#signin-email');
  const passInput    = container.querySelector('#signin-password');
  const signinError  = container.querySelector('#signin-error');
  const passToggle   = container.querySelector('#password-toggle');
  const showReset    = container.querySelector('#show-reset');

  // ── Reset ──
  const resetBtn     = container.querySelector('#reset-btn');
  const resetEmail   = container.querySelector('#reset-email');
  const resetError   = container.querySelector('#reset-error');
  const resetSuccess = container.querySelector('#reset-success');
  const showSignin   = container.querySelector('#show-signin');

  // Sign in submit
  signinBtn?.addEventListener('click', async () => {
    const email    = emailInput?.value.trim();
    const password = passInput?.value;

    if (!email || !password) {
      showError(signinError, t('auth_error_invalid_email'));
      return;
    }

    setLoading(signinBtn, true);
    hideError(signinError);

    const result = await loginWithEmail(email, password);

    if (result.success) {
      // Redirect to intended destination or dashboard
      const dest = sessionStorage.getItem('qwv_redirect_after_login') || '/dashboard';
      sessionStorage.removeItem('qwv_redirect_after_login');
      window.history.replaceState(null, '', BASE + dest);
      window.dispatchEvent(new CustomEvent('qwv:navigate', { detail: { path: dest } }));
    } else {
      setLoading(signinBtn, false);
      showError(signinError, t(result.error));
    }
  });

  // Enter key on email → focus password
  emailInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') passInput?.focus();
  });

  // Enter key on password → submit
  passInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') signinBtn?.click();
  });

  // Password visibility toggle
  let passVisible = false;
  passToggle?.addEventListener('click', () => {
    passVisible = !passVisible;
    if (passInput) passInput.type = passVisible ? 'text' : 'password';
    passToggle.innerHTML = _eyeIcon(passVisible);
    passToggle.setAttribute('aria-label', passVisible ? 'Hide password' : 'Show password');
  });

  // Switch to reset view
  showReset?.addEventListener('click', () => {
    switchView(container, 'reset');
    container.querySelector('#reset-email')?.focus();
  });

  // Switch back to sign in
  showSignin?.addEventListener('click', () => {
    switchView(container, 'signin');
    container.querySelector('#signin-email')?.focus();
  });

  // Reset submit
  resetBtn?.addEventListener('click', async () => {
    const email = resetEmail?.value.trim();
    if (!email) {
      showError(resetError, t('auth_error_invalid_email'));
      return;
    }

    setLoading(resetBtn, true);
    hideError(resetError);
    hideSuccess(resetSuccess);

    const result = await sendPasswordReset(email);
    setLoading(resetBtn, false);

    if (result.success) {
      showSuccess(resetSuccess, t('login_reset_sent'));
      if (resetEmail) resetEmail.value = '';
    } else {
      showError(resetError, t(result.error));
    }
  });

  // Enter key on reset email → submit
  resetEmail?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') resetBtn?.click();
  });

  // Language toggle — re-render the whole page in the new language
  container.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { setLang } = window._qwvI18n || {};
      import('../core/i18n.js').then(({ setLang }) => {
        setLang(btn.dataset.lang);
        // Re-render login page in new language
        const currentView = container.querySelector('#view-reset:not(.hidden)') ? 'reset' : 'signin';
        container.innerHTML = buildLoginPage(currentView);
        wireLoginPage(container);
        // Preserve any typed email
      });
    });
  });

  // Auto-focus email field
  setTimeout(() => emailInput?.focus(), 100);
}

// ── View switching ────────────────────────────────────────────

function switchView(container, view) {
  const signin = container.querySelector('#view-signin');
  const reset  = container.querySelector('#view-reset');

  if (view === 'reset') {
    signin?.classList.add('hidden');
    reset?.classList.remove('hidden');
  } else {
    reset?.classList.add('hidden');
    signin?.classList.remove('hidden');
  }
}

// ── UI helpers ────────────────────────────────────────────────

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.textContent.trim();
    btn.innerHTML = `<span class="btn-spinner"></span>`;
    btn.disabled  = true;
    btn.setAttribute('aria-busy', 'true');
  } else {
    btn.innerHTML  = btn.dataset.originalText || '';
    btn.disabled   = false;
    btn.removeAttribute('aria-busy');
  }
}

function showError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(el) {
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

function showSuccess(el, message) {
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideSuccess(el) {
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

// ── SVG icons ─────────────────────────────────────────────────

function _eyeIcon(visible) {
  if (visible) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
        a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8
        a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;
}
