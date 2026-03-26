/**
 * QUR'AN WORLD VIEW — footer.js
 * ─────────────────────────────────────────────────────────────
 * Public site footer component.
 *
 * Contents:
 *  - QWV logo + tagline
 *  - Nav links (condensed)
 *  - Social links: Instagram · YouTube
 *  - CC BY-NC-ND license note
 *  - Contact link
 *  - Closing Arabic supplication
 * ─────────────────────────────────────────────────────────────
 */

import { t } from '../core/i18n.js';

const BASE = window.QWV_BASE || '';

export function renderFooter(container) {
  container.innerHTML = _buildFooter();
}

function _buildFooter() {
  const year = new Date().getFullYear();

  return `
    <footer class="qwv-footer" role="contentinfo">

      <!-- Gold divider -->
      <div class="divider-gold container">
        <div class="divider-gold-dot"></div>
        <div class="divider-gold-dot"></div>
        <div class="divider-gold-dot"></div>
      </div>

      <div class="footer-inner container">

        <!-- Brand column -->
        <div class="footer-brand">
          <a href="${BASE}/" class="footer-logo-link" aria-label="Qur'an World View">
            <img src="${BASE}/icons/logo.png" alt="" class="footer-logo-img" width="48" height="48" aria-hidden="true" />
            <span class="footer-logo-wordmark">Qur'an World View</span>
          </a>
          <p class="footer-tagline">${t('tagline')}</p>

          <!-- Social links -->
          <div class="footer-social" aria-label="Social media">
            <a href="https://instagram.com/quranworldview"
              class="footer-social-link"
              target="_blank" rel="noopener noreferrer"
              aria-label="${t('footer_instagram')}"
              data-external
            >
              ${_instagramIcon()}
              <span>${t('footer_instagram')}</span>
            </a>
            <a href="https://youtube.com/@QuranWorldView"
              class="footer-social-link"
              target="_blank" rel="noopener noreferrer"
              aria-label="${t('footer_youtube')}"
              data-external
            >
              ${_youtubeIcon()}
              <span>${t('footer_youtube')}</span>
            </a>
          </div>
        </div>

        <!-- Nav column -->
        <nav class="footer-nav" aria-label="Footer navigation">
          <p class="footer-nav-heading section-label">Navigate</p>
          <ul role="list" class="footer-nav-links">
            <li><a href="${BASE}/journey"      class="footer-nav-link">${t('nav_journey')}</a></li>
            <li><a href="${BASE}/apps"         class="footer-nav-link">${t('nav_apps')}</a></li>
            <li><a href="${BASE}/library"      class="footer-nav-link">${t('nav_library')}</a></li>
            <li><a href="${BASE}/blog"         class="footer-nav-link">${t('nav_blog')}</a></li>
            <li><a href="${BASE}/about"        class="footer-nav-link">${t('nav_about')}</a></li>
            <li><a href="${BASE}/contact"      class="footer-nav-link">${t('nav_contact')}</a></li>
          </ul>
        </nav>

        <!-- Apps column -->
        <div class="footer-apps">
          <p class="footer-nav-heading section-label">The Journey</p>
          <ul role="list" class="footer-nav-links">
            <li><a href="${BASE}/journey#iqra"   class="footer-nav-link">اِقْرَأ — Iqra</a></li>
            <li><a href="${BASE}/journey#alif"   class="footer-nav-link">أَلِف — Alif</a></li>
            <li><a href="${BASE}/journey#aamaal" class="footer-nav-link">أَعْمَال — Aamaal</a></li>
            <li><a href="${BASE}/journey#ahad"   class="footer-nav-link">أَحَد — Ahad</a></li>
            <li><a href="${BASE}/journey#miftah" class="footer-nav-link">مِفْتَاح — Miftah</a></li>
          </ul>
        </div>

      </div>

      <!-- Bottom bar -->
      <div class="footer-bottom container">

        <!-- Arabic supplication -->
        <p class="footer-supplication" lang="ar" dir="rtl">
          وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ
        </p>

        <!-- License + copyright -->
        <div class="footer-legal">
          <span class="footer-license">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            ${t('footer_license')}
          </span>
          <span class="footer-copyright">© ${year} Qur'an World View</span>
        </div>

      </div>

    </footer>
  `;
}

// ── SVG icons ─────────────────────────────────────────────────

function _instagramIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>`;
}

function _youtubeIcon() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
  </svg>`;
}
