/**
 * QUR'AN WORLD VIEW — dashboard.js
 * ─────────────────────────────────────────────────────────────
 * Student Dashboard — personal mission control.
 *
 * Two zones:
 *   Zone 1 — Journey Map (5 stage cards, swipeable on mobile)
 *   Zone 2 — Reflection Space (prompt, write, submit)
 *
 * Additional:
 *   - Dashboard header: greeting, streak, gems, member badge
 *   - Founder Insights (sabiqun + core only)
 *   - Full navbar (student can navigate to blog, library etc.)
 *   - Language toggle syncs to Firebase
 *
 * Auth: guaranteed logged-in by authGuard in app.js
 * ─────────────────────────────────────────────────────────────
 */

import { t, getLang, setLang }        from '../core/i18n.js';
import { getCurrentUser, logout,
         refreshUserProfile,
         canSeeFounderInsights }       from '../core/auth.js';
import { db, COLLECTIONS }            from '../core/firebase.js';
import { arabicText }                 from '../core/ArabicText.js';

const BASE = window.QWV_BASE || '';

// ── Stage metadata ────────────────────────────────────────────
const STAGES = [
  { id: 1, app: 'iqra',   path: '/iqra',   icon: '📖' },
  { id: 2, app: 'alif',   path: '/alif',   icon: '✍️' },
  { id: 3, app: 'aamaal', path: '/aamaal', icon: '🌱' },
  { id: 4, app: 'ahad',   path: '/ahad',   icon: '🤝' },
  { id: 5, app: 'miftah', path: '/miftah', icon: '🗝️' },
];

// ── Entry point ───────────────────────────────────────────────
export default async function render(container) {
  const { profile } = getCurrentUser();
  const lang        = profile?.language || getLang();

  // Sync language to user preference
  if (lang !== getLang()) setLang(lang);

  container.innerHTML = buildShell(profile);
  wireNavbar(container, profile);

  // Load data in parallel
  const [prompts, reflections, founderInsights] = await Promise.all([
    fetchJSON(BASE + '/js/data/reflection-prompts.json').then(d => d?.prompts || []),
    fetchRecentReflections(profile?.uid),
    canSeeFounderInsights() ? fetchFounderInsights() : Promise.resolve([]),
  ]);

  renderHeader(container.querySelector('#dash-header'), profile);
  renderJourneyMap(container.querySelector('#dash-journey'), profile);
  renderReflectionSpace(container.querySelector('#dash-reflection'), profile, prompts, reflections);

  if (canSeeFounderInsights() && founderInsights.length) {
    renderFounderInsights(container.querySelector('#dash-founder'), founderInsights);
  } else {
    container.querySelector('#dash-founder')?.remove();
  }

  initReveal(container);
}

// ── Shell ─────────────────────────────────────────────────────
function buildShell(profile) {
  const lang  = getLang();
  const isRTL = lang === 'ur';

  return `
    <div class="dash-page" ${isRTL ? 'dir="rtl"' : ''}>

      <!-- Minimal top bar (logo + nav + user controls) -->
      <header class="dash-topbar" id="dash-topbar">
        <div class="dash-topbar-inner">
          <a href="${BASE}/" class="dash-logo" aria-label="Qur'an World View Home">
            <img src="${BASE}/icons/logo.png" alt="" width="32" height="32" aria-hidden="true" />
            <span class="dash-logo-text">Qur'an World View</span>
          </a>

          <nav class="dash-nav" aria-label="Dashboard navigation">
            <a href="${BASE}/journey"   class="dash-nav-link">${t('nav_journey')}</a>
            <a href="${BASE}/apps"      class="dash-nav-link">${t('nav_apps')}</a>
            <a href="${BASE}/library"   class="dash-nav-link">${t('nav_library')}</a>
            <a href="${BASE}/blog"      class="dash-nav-link">${t('nav_blog')}</a>
            ${profile?.member_tier === 'admin' ? `<a href="${BASE}/admin" class="dash-nav-link" style="color:var(--crimson-bright);">Admin ⚙</a>` : ''}
          </nav>

          <div class="dash-topbar-controls">
            <!-- Language toggle -->
            <div class="lang-toggle" role="group" aria-label="Language">
              ${['en','hi','ur'].map(code => `
                <button class="lang-toggle-btn ${getLang()===code?'active':''}"
                  data-lang="${code}" aria-pressed="${getLang()===code}">
                  ${code.toUpperCase()}
                </button>`).join('')}
            </div>

            <!-- User menu -->
            <div class="dash-user-menu" id="dash-user-menu">
              <button class="dash-avatar-btn" id="dash-avatar-btn"
                aria-label="User menu" aria-expanded="false">
                <span class="dash-avatar">${_initials(profile)}</span>
              </button>
              <div class="dash-dropdown" id="dash-dropdown" aria-hidden="true">
                <p class="dash-dropdown-name">${profile?.name || 'Student'}</p>
                <p class="dash-dropdown-email">${profile?.contact || ''}</p>
                <hr style="border-color:var(--border);margin:var(--space-2) 0;" />
                <button class="dash-dropdown-item" id="dash-logout-btn">
                  ${t('nav_logout')}
                </button>
              </div>
            </div>

            <!-- Mobile hamburger -->
            <button class="dash-hamburger" id="dash-hamburger" aria-label="Open menu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>

        <!-- Mobile nav drawer -->
        <div class="dash-mobile-drawer" id="dash-mobile-drawer" inert>
          <a href="${BASE}/journey"   class="dash-mobile-link">${t('nav_journey')}</a>
          <a href="${BASE}/apps"      class="dash-mobile-link">${t('nav_apps')}</a>
          <a href="${BASE}/library"   class="dash-mobile-link">${t('nav_library')}</a>
          <a href="${BASE}/blog"      class="dash-mobile-link">${t('nav_blog')}</a>
          <div class="dash-mobile-lang">
            ${['en','hi','ur'].map(code => `
              <button class="mobile-lang-btn ${getLang()===code?'active':''}"
                data-lang="${code}">${_langLabel(code)}</button>`).join('')}
          </div>
          <button class="btn btn-ghost btn-full" id="dash-mobile-logout">${t('nav_logout')}</button>
        </div>
      </header>

      <!-- Page content -->
      <main class="dash-main" id="dash-main">
        <div class="dash-content">
          <div id="dash-header"></div>
          <div id="dash-journey"></div>
          <div id="dash-reflection"></div>
          <div id="dash-founder"></div>
        </div>
      </main>

    </div>
  `;
}

// ── Topbar wiring ─────────────────────────────────────────────
function wireNavbar(container, profile) {
  const avatarBtn  = container.querySelector('#dash-avatar-btn');
  const dropdown   = container.querySelector('#dash-dropdown');
  const logoutBtn  = container.querySelector('#dash-logout-btn');
  const hamburger  = container.querySelector('#dash-hamburger');
  const drawer     = container.querySelector('#dash-mobile-drawer');
  const mobileLogout = container.querySelector('#dash-mobile-logout');

  // Avatar dropdown toggle
  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown?.classList.toggle('open');
    avatarBtn.setAttribute('aria-expanded', open);
    dropdown?.setAttribute('aria-hidden', !open);
  });

  document.addEventListener('click', () => {
    dropdown?.classList.remove('open');
    avatarBtn?.setAttribute('aria-expanded', 'false');
  });

  // Logout
  logoutBtn?.addEventListener('click', () => logout());
  mobileLogout?.addEventListener('click', () => logout());

  // Hamburger
  hamburger?.addEventListener('click', () => {
    const open = drawer?.classList.toggle('open');
    if (open) drawer?.removeAttribute('inert');
    else drawer?.setAttribute('inert', '');
  });

  // Language toggles (topbar + mobile)
  container.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = profile?.uid;
      setLang(btn.dataset.lang, { syncToFirebase: !!uid, uid });
      // Re-render dashboard in new language
      import('./dashboard.js').then(m => {
        const app = document.getElementById('app');
        if (app) m.default(app);
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// ZONE 0 — DASHBOARD HEADER
// ══════════════════════════════════════════════════════════════

function renderHeader(el, profile) {
  if (!el) return;
  const lang    = getLang();
  const name    = profile?.name || 'Student';
  const streak  = profile?.streak || 0;
  const gems    = profile?.total_gems || 0;
  const tier    = profile?.member_tier || 'student';

  const greeting = t('dashboard_welcome').replace('{{name}}', name);

  const streakLabel = lang === 'ur'
    ? `${streak} دن کا سلسلہ`
    : lang === 'hi'
    ? `${streak} दिन का सिलसिला`
    : `${streak}-day streak`;

  const gemsLabel = lang === 'ur'
    ? `${gems} نگینے`
    : lang === 'hi'
    ? `${gems} नगीने`
    : `${gems} gems`;

  el.innerHTML = `
    <div class="dash-header reveal">

      <div class="dash-greeting-block">
        <p class="dash-greeting">${greeting}</p>
        <p class="dash-greeting-sub">${
          lang === 'ur' ? 'آپ کا سفر آپ کا انتظار کر رہا ہے۔' :
          lang === 'hi' ? 'आपका सफ़र आपका इंतज़ार कर रहा है।' :
          'Your journey is waiting for you.'
        }</p>
      </div>

      <div class="dash-stats">
        ${tier === 'sabiqun' || tier === 'core' ? `
          <span class="badge badge-sabiqun">
            ${_tierIcon(tier)} ${t('tier_' + tier)}
          </span>` : ''}

        <div class="streak-pill">
          <span class="streak-flame" aria-hidden="true">🔥</span>
          <span>${streakLabel}</span>
        </div>

        <div class="dash-gems-pill">
          <span aria-hidden="true">✨</span>
          <span>${gemsLabel}</span>
        </div>
      </div>

    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// ZONE 1 — JOURNEY MAP
// ══════════════════════════════════════════════════════════════

function renderJourneyMap(el, profile) {
  if (!el) return;
  const lang         = getLang();
  const currentStage = profile?.stage || 1;
  const gateStatus   = profile?.gate_status || {};
  const unlocked     = profile?.stage_unlocked || { iqra: true };

  const sectionLabel = lang === 'ur' ? 'آپ کا سفر' : lang === 'hi' ? 'आपका सफ़र' : 'Your Journey';
  const sectionHead  = lang === 'ur' ? 'پانچ مرحلے' : lang === 'hi' ? 'पाँच मरहले' : 'The Five Stages';

  el.innerHTML = `
    <div class="dash-section reveal">
      <div class="dash-section-header">
        <span class="section-label">${sectionLabel}</span>
        <h2 class="dash-section-title">${sectionHead}</h2>
      </div>

      <!-- Scroll track -->
      <div class="journey-map-scroll-wrap">
        <div class="journey-map-track" id="journey-track">
          ${STAGES.map((s, i) => buildStageCard(s, i, currentStage, gateStatus, unlocked, profile, lang)).join('')}
        </div>

        <!-- Scroll indicators (mobile) -->
        <div class="journey-scroll-dots" aria-hidden="true">
          ${STAGES.map((_, i) => `<span class="journey-scroll-dot ${i===currentStage-1?'active':''}"></span>`).join('')}
        </div>
      </div>
    </div>
  `;

  initJourneyScroll(el);
  scrollToActiveCard(el, currentStage);
}

function buildStageCard(stage, index, currentStage, gateStatus, unlocked, profile, lang) {
  const n       = stage.id;
  const appName = stage.app;
  const isActive    = n === currentStage;
  const isComplete  = n < currentStage;
  const isNext      = n === currentStage + 1;
  const isFar       = n > currentStage + 1;
  const isUnlocked  = unlocked[appName] === true;
  const gateState   = gateStatus[appName] || 'locked';
  const isPending   = gateState === 'pending_approval';

  // Card state class
  let cardClass = 'stage-card-dash';
  if (isActive)   cardClass += ' stage-card-active';
  if (isComplete) cardClass += ' stage-card-complete';
  if (isNext)     cardClass += ' stage-card-next';
  if (isFar)      cardClass += ' stage-card-far';

  // Progress text (placeholder — real data from individual app)
  const progressText = isActive
    ? (lang==='ur' ? 'جاری ہے' : lang==='hi' ? 'जारी है' : 'In progress')
    : '';

  // Gate message for next stage
  const pendingMsg = lang==='ur'
    ? 'آپ کی محنت نوٹ ہو گئی۔ تصدیق کا انتظار ہے۔'
    : lang==='hi'
    ? 'आपकी मेहنत नोट हो गई। तसदीक़ का इंतज़ार है।'
    : 'Your progress has been noted. Awaiting confirmation.';

  const lockedMsg = lang==='ur'
    ? 'پچھلا مرحلہ مکمل کریں'
    : lang==='hi'
    ? 'पिछला मरहला पूरा करें'
    : 'Complete the previous stage to unlock';

  // CTA label
  const ctaLabel = lang==='ur'
    ? `${t('stage_'+n+'_name')} کھولیں`
    : lang==='hi'
    ? `${t('stage_'+n+'_name')} खोलें`
    : `Open ${t('stage_'+n+'_name')}`;

  return `
    <div class="${cardClass}" data-stage="${n}" role="article"
      aria-label="Stage ${n}: ${t('stage_'+n+'_name')}">

      <!-- Stage number + status indicator -->
      <div class="sc-top">
        <div class="sc-number-wrap">
          <span class="sc-number ${isActive?'sc-number-active':isComplete?'sc-number-complete':'sc-number-locked'}
            ${isActive?'pulse-gold':''}">
            ${isComplete ? _checkIcon() : n}
          </span>
        </div>
        ${isFar ? `<span class="sc-lock" aria-label="Locked">${_lockIcon()}</span>` : ''}
        ${isPending ? `<span class="sc-pending-dot" title="${pendingMsg}"></span>` : ''}
      </div>

      <!-- Arabic name -->
      <div class="sc-arabic ${isFar ? 'sc-arabic-dim' : ''}">
        ${arabicText(t('stage_'+n+'_arabic'), { size: 'lg', colour: isActive ? 'gold' : isFar ? 'muted' : 'default', tag: 'p', align: 'center' })}
      </div>

      <!-- App name + role -->
      <div class="sc-body">
        <p class="sc-name ${isActive?'sc-name-active':''}">${t('stage_'+n+'_name')}</p>
        <p class="sc-role">${t('stage_'+n+'_role')}</p>
      </div>

      <!-- Status / progress -->
      <div class="sc-status">
        ${isActive ? `
          <div class="sc-progress-bar">
            <div class="sc-progress-fill" style="width:20%"></div>
          </div>
          <p class="sc-progress-text">${progressText}</p>
        ` : ''}
        ${isComplete ? `
          <p class="sc-complete-text">
            ${lang==='ur'?'مکمل ✓':lang==='hi'?'पूरा ✓':'Complete ✓'}
          </p>
        ` : ''}
        ${isPending ? `
          <p class="sc-pending-text">${pendingMsg}</p>
        ` : ''}
        ${isNext && !isPending ? `
          <p class="sc-locked-text">${lockedMsg}</p>
        ` : ''}
        ${isFar ? `
          <p class="sc-far-text">—</p>
        ` : ''}
      </div>

      <!-- CTA -->
      ${(isActive || isComplete) ? `
        <a href="${BASE}${stage.path}"
          class="btn btn-outline btn-sm sc-cta" data-external>
          ${ctaLabel}
        </a>
      ` : ''}

    </div>
  `;
}

function initJourneyScroll(el) {
  const track = el.querySelector('#journey-track');
  const dots  = el.querySelectorAll('.journey-scroll-dot');
  if (!track || !dots.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const n = parseInt(entry.target.dataset.stage) - 1;
        dots.forEach((d, i) => d.classList.toggle('active', i === n));
      }
    });
  }, { root: track, threshold: 0.6 });

  track.querySelectorAll('.stage-card-dash').forEach(card => observer.observe(card));
}

function scrollToActiveCard(el, currentStage) {
  requestAnimationFrame(() => {
    const track = el.querySelector('#journey-track');
    const card  = track?.querySelector(`[data-stage="${currentStage}"]`);
    if (!track || !card) return;
    // Only auto-scroll on mobile
    if (window.innerWidth < 768) {
      const offset = card.offsetLeft - (track.offsetWidth / 2) + (card.offsetWidth / 2);
      track.scrollTo({ left: offset, behavior: 'smooth' });
    }
  });
}

// ══════════════════════════════════════════════════════════════
// ZONE 2 — REFLECTION SPACE
// ══════════════════════════════════════════════════════════════

function renderReflectionSpace(el, profile, prompts, recentReflections) {
  if (!el) return;
  const lang   = getLang();
  const prompt = _pickPrompt(prompts, lang);

  const sectionLabel = lang==='ur' ? 'غور و فکر' : lang==='hi' ? 'ग़ौर व फ़िक्र' : 'Reflection';
  const sectionHead  = lang==='ur' ? 'آج آپ کیا سوچ رہے ہیں؟' : lang==='hi' ? 'आज आप क्या सोच रहे हैं?' : 'What are you thinking today?';

  el.innerHTML = `
    <div class="dash-section dash-reflection-section reveal">
      <div class="dash-section-header">
        <span class="section-label">${sectionLabel}</span>
        <h2 class="dash-section-title">${sectionHead}</h2>
      </div>

      <div class="reflection-wrap">

        <!-- Writing area -->
        <div class="reflection-editor">
          <p class="reflection-prompt-text">${prompt}</p>

          <div class="form-group">
            <label class="form-label" for="ref-title">
              ${lang==='ur'?'عنوان':lang==='hi'?'शीर्षक':'Title'}
            </label>
            <input type="text" id="ref-title" maxlength="120"
              placeholder="${t('dashboard_reflection_title_placeholder')}" />
          </div>

          <div class="form-group">
            <label class="form-label" for="ref-body">
              ${lang==='ur'?'تحریر':lang==='hi'?'तहरीर':'Reflection'}
            </label>
            <textarea id="ref-body" rows="5"
              placeholder="${t('dashboard_reflection_body_placeholder')}"></textarea>
          </div>

          <!-- Publish preference -->
          <div class="reflection-publish-toggle">
            <label class="reflection-pub-option">
              <input type="radio" name="publish_as" value="named" checked />
              <span>${t('dashboard_publish_named').replace('{{name}}', profile?.name || 'you')}</span>
            </label>
            <label class="reflection-pub-option">
              <input type="radio" name="publish_as" value="anonymous" />
              <span>${t('dashboard_publish_anon')}</span>
            </label>
          </div>

          <div id="ref-error"   class="login-error   hidden" role="alert"></div>
          <div id="ref-success" class="login-success hidden" role="status"></div>

          <button class="btn btn-primary" id="ref-submit">
            ${t('dashboard_submit_reflection')}
          </button>
        </div>

        <!-- Recent reflections -->
        ${recentReflections.length ? `
          <div class="reflection-recent">
            <p class="section-label" style="margin-bottom:var(--space-4);">
              ${lang==='ur'?'پچھلی تحریریں':lang==='hi'?'पिछली तहरीरें':'Previous Reflections'}
            </p>
            ${recentReflections.map(r => `
              <div class="reflection-recent-card">
                <div class="reflection-recent-header">
                  <p class="reflection-recent-title">${r.title || '—'}</p>
                  <span class="badge ${r.status==='pending'?'badge-muted':r.status==='approved'?'badge-gold':'badge-success'}">
                    ${r.status==='pending'
                      ? (lang==='ur'?'زیرِ جائزہ':lang==='hi'?'जाँच हो रही है':'Pending')
                      : r.status==='approved'
                      ? (lang==='ur'?'منظور':lang==='hi'?'मंज़ूर':'Approved')
                      : (lang==='ur'?'شائع':lang==='hi'?'शाया':'Published')}
                  </span>
                </div>
                <p class="reflection-recent-excerpt">${(r.body||'').substring(0,100)}…</p>
              </div>
            `).join('')}
          </div>
        ` : ''}

      </div>
    </div>
  `;

  // Wire submit
  const submitBtn = el.querySelector('#ref-submit');
  submitBtn?.addEventListener('click', () => submitReflection(el, profile));
}

async function submitReflection(el, profile) {
  const title      = el.querySelector('#ref-title')?.value.trim();
  const body       = el.querySelector('#ref-body')?.value.trim();
  const publishAs  = el.querySelector('input[name="publish_as"]:checked')?.value || 'named';
  const errorEl    = el.querySelector('#ref-error');
  const successEl  = el.querySelector('#ref-success');
  const submitBtn  = el.querySelector('#ref-submit');
  const lang       = getLang();

  // Validate
  if (!title || !body) {
    const msg = lang==='ur'?'براہ کرم عنوان اور تحریر دونوں لکھیں۔'
      : lang==='hi'?'कृपया शीर्षक और तहरीर दोनों लिखें।'
      : 'Please write a title and reflection.';
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="btn-spinner"></span>`;

  try {
    await db.collection(COLLECTIONS.USER_REFLECTIONS).add({
      uid:          profile.uid,
      title,
      body,
      submitted_at: firebase.firestore.FieldValue.serverTimestamp(),
      status:       'pending',
      published_as: publishAs,
      blog_post_id: null,
    });

    // Clear form
    el.querySelector('#ref-title').value = '';
    el.querySelector('#ref-body').value  = '';

    const msg = lang==='ur'?'بھیج دیا — جانچ ہو رہی ہے۔'
      : lang==='hi'?'भेज दिया — जाँच हو रही है।'
      : 'Submitted — awaiting review.';
    successEl.textContent = msg;
    successEl.classList.remove('hidden');

  } catch (err) {
    console.error('[QWV dashboard] Reflection submit error:', err);
    errorEl.textContent = lang==='ur'?'کچھ گڑبڑ ہوئی۔ دوبارہ کوشش کریں۔'
      : lang==='hi'?'कुछ गड़बड़ हुई। दोबारा कोशिश करें।'
      : 'Something went wrong. Please try again.';
    errorEl.classList.remove('hidden');
  }

  submitBtn.disabled = false;
  submitBtn.innerHTML = t('dashboard_submit_reflection');
}

// ══════════════════════════════════════════════════════════════
// FOUNDER INSIGHTS (Sabiqun + Core only)
// ══════════════════════════════════════════════════════════════

function renderFounderInsights(el, insights) {
  if (!el || !insights?.length) return;
  const lang  = getLang();
  const label = lang==='ur'?'بانی کے نوٹس':lang==='hi'?'बानी के नोट्स':'Founder\'s Notes';
  const head  = lang==='ur'?'خاص پیغام':lang==='hi'?'ख़ास पैग़ाम':'Personal Notes';

  el.innerHTML = `
    <div class="dash-section founder-insights-section reveal">
      <div class="dash-section-header">
        <span class="section-label">${label}</span>
        <h2 class="dash-section-title">${head}</h2>
      </div>
      <div class="founder-insights-list">
        ${insights.map(insight => `
          <div class="founder-insight-card">
            <div class="founder-insight-accent" aria-hidden="true"></div>
            <p class="founder-insight-title">${insight.title || ''}</p>
            <p class="founder-insight-body">${insight.body || ''}</p>
            <p class="founder-insight-date">${_formatDate(insight.posted_at, lang)}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════
// DATA FETCHERS
// ══════════════════════════════════════════════════════════════

async function fetchRecentReflections(uid) {
  if (!uid) return [];
  try {
    const snap = await db.collection(COLLECTIONS.USER_REFLECTIONS)
      .where('uid', '==', uid)
      .orderBy('submitted_at', 'desc')
      .limit(3)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function fetchFounderInsights() {
  try {
    const snap = await db.collection(COLLECTIONS.FOUNDER_INSIGHTS)
      .orderBy('posted_at', 'desc')
      .limit(5)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  } catch (e) {
    console.warn('[QWV dashboard] fetchJSON failed:', url, e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════

function initReveal(container) {
  const els = container.querySelectorAll('.reveal');
  const io  = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  els.forEach(el => io.observe(el));
}

function _pickPrompt(prompts, lang) {
  if (!prompts?.length) return t('dashboard_reflect_prompt');
  const day    = new Date().getDay();
  const prompt = prompts[day % prompts.length];
  return prompt?.[lang] || prompt?.en || t('dashboard_reflect_prompt');
}

function _initials(profile) {
  const name = profile?.name || 'S';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function _tierIcon(tier) {
  return tier === 'sabiqun' ? '⭐' : tier === 'core' ? '👑' : '';
}

function _langLabel(code) {
  return { en: 'English', hi: 'हिन्दी', ur: 'اردو' }[code] || code;
}

function _formatDate(ts, lang) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  return d.toLocaleDateString(
    lang === 'ur' ? 'ur-PK' : lang === 'hi' ? 'hi-IN' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

function _checkIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="3" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
}

function _lockIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>`;
}
