/**
 * QUR'AN WORLD VIEW — welcome.js
 * ─────────────────────────────────────────────────────────────
 * The student's arrival moment. Shown only on first login.
 * Two parts:
 *   Part 1 — The Arrival Screen (full viewport)
 *   Part 2 — Orientation Modal (4 steps, cannot be skipped)
 *
 * Routing:
 *   - Only reachable when users/{uid}.first_login === true
 *   - If first_login === false → auth.js redirects to /dashboard
 *   - On "Enter the Dashboard" → progress.js sets first_login: false
 *     then navigates to /dashboard
 *
 * RULES:
 *   - All text through t()
 *   - All Arabic through ArabicText.js
 *   - Urdu: RTL layout
 *   - The modal CANNOT be dismissed or skipped
 *   - first_login: false is ONLY written by setFirstLoginComplete()
 * ─────────────────────────────────────────────────────────────
 */

import { getCurrentUser }        from '../core/auth.js';
import { t, getLang }            from '../core/i18n.js';
import { renderArabic }          from '../core/ArabicText.js';
import { setFirstLoginComplete } from '../services/progress.js';

const BASE = window.QWV_BASE || '';

// ── The Al-Ankabut 29:69 ayah ────────────────────────────────
// This ayah appeared in Ramadan Challenge 2026.
// It is also in the confirmation email.
// Its second appearance here is intentional — a deliberate callback.
// DO NOT change this ayah without explicit instruction from Yusuf.
const AYAH = {
  arabic:  'وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا',
  ref:     { en: 'Al-Ankabut 29:69', hi: 'अल-अनकबूत 29:69', ur: 'العنکبوت 29:69' },
  trans: {
    en: '"And those who strive for Us — We will surely guide them to Our paths."',
    hi: '"और जो लोग हमारी राह में कोशिश करते हैं, हम उन्हें अपने रास्ते ज़रूर दिखाएंगे।"',
    ur: '"اور جو لوگ ہماری راہ میں کوشش کرتے ہیں، ہم انہیں اپنے راستے ضرور دکھائیں گے۔"',
  },
};

// ── Stage data for the modal ──────────────────────────────────
const STAGES = [
  { n: 1, key: 'iqra',   arabic: 'اِقْرَأ'  },
  { n: 2, key: 'alif',   arabic: 'أَلِف'    },
  { n: 3, key: 'aamaal', arabic: 'أَعْمَال' },
  { n: 4, key: 'ahad',   arabic: 'أَحَد'    },
  { n: 5, key: 'miftah', arabic: 'مِفْتَاح' },
];

// ── Entry point ───────────────────────────────────────────────
export default function render(container) {
  const { profile } = getCurrentUser();
  const lang        = getLang();
  const isRTL       = lang === 'ur';
  const name        = profile?.name || '';

  container.innerHTML = buildArrivalScreen(name, lang, isRTL);
  wireArrivalScreen(container, name, lang, isRTL, profile);
}

// ══════════════════════════════════════════════════════════════
// PART 1 — ARRIVAL SCREEN
// ══════════════════════════════════════════════════════════════

function buildArrivalScreen(name, lang, isRTL) {
  const subtitle = {
    en: 'You\'ve taken the first step. Now let us show you the path.',
    hi: 'पहला क़दम उठा लिया। अब राह दिखाते हैं।',
    ur: 'پہلا قدم اٹھا لیا۔ اب راہ دکھاتے ہیں۔',
  };

  const cta = {
    en: 'Show me the journey',
    hi: 'सफ़र दिखाएं',
    ur: 'سفر دکھائیں',
  };

  return `
    <div class="welcome-page" dir="${isRTL ? 'rtl' : 'ltr'}">

      <div class="welcome-bg" aria-hidden="true">
        <div class="welcome-bg-orb welcome-bg-orb--1"></div>
        <div class="welcome-bg-orb welcome-bg-orb--2"></div>
      </div>

      <div class="welcome-content animate-fade-up">

        <div class="welcome-logo-wrap">
          <img src="${BASE}/icons/logo.png" alt="QWV" class="welcome-logo animate-float" width="80" height="80" />
        </div>

        <h1 class="welcome-greeting">
          ${lang === 'ur' ? 'مرحبا' : lang === 'hi' ? 'मरहबा' : 'Marhaba'},
          <span class="welcome-name">${name}</span>
        </h1>

        <p class="welcome-subtitle">${subtitle[lang] || subtitle.en}</p>

        <div class="welcome-ayah-block">
          <p class="welcome-ayah-arabic">${renderArabic(AYAH.arabic)}</p>
          <p class="welcome-ayah-ref">${AYAH.ref[lang] || AYAH.ref.en}</p>
          <p class="welcome-ayah-trans">${AYAH.trans[lang] || AYAH.trans.en}</p>
        </div>

        <button class="btn btn-primary btn-lg welcome-cta" id="welcome-cta-btn">
          ${cta[lang] || cta.en}
          <span class="welcome-cta-arrow" aria-hidden="true">→</span>
        </button>

      </div>

    </div>

    <!-- Orientation modal — rendered hidden, shown on CTA click -->
    <div class="orient-overlay hidden" id="orient-overlay" role="dialog" aria-modal="true" aria-label="Orientation">
      <div class="orient-modal">
        <div class="orient-dots" id="orient-dots" aria-hidden="true"></div>
        <div class="orient-body" id="orient-body"></div>
      </div>
    </div>
  `;
}

function wireArrivalScreen(container, name, lang, isRTL, profile) {
  container.querySelector('#welcome-cta-btn')?.addEventListener('click', () => {
    openModal(container, lang, isRTL, profile);
  });
}

// ══════════════════════════════════════════════════════════════
// PART 2 — ORIENTATION MODAL
// Cannot be skipped or dismissed. 4 steps.
// ══════════════════════════════════════════════════════════════

let _currentStep = 0;
const TOTAL_STEPS = 4;

function openModal(container, lang, isRTL, profile) {
  _currentStep = 0;
  const overlay = container.querySelector('#orient-overlay');
  overlay?.classList.remove('hidden');
  // Prevent body scroll while modal is open
  document.body.style.overflow = 'hidden';
  renderStep(container, lang, isRTL, profile);
}

function renderStep(container, lang, isRTL, profile) {
  renderDots(container);
  const body = container.querySelector('#orient-body');
  if (!body) return;

  body.classList.remove('orient-step-visible');

  // Small delay for transition feel
  setTimeout(() => {
    body.innerHTML = buildStep(_currentStep, lang, isRTL);
    body.classList.add('orient-step-visible');
    wireStep(container, body, lang, isRTL, profile);
  }, 150);
}

function renderDots(container) {
  const dotsEl = container.querySelector('#orient-dots');
  if (!dotsEl) return;
  dotsEl.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, i) =>
    `<span class="orient-dot ${i === _currentStep ? 'orient-dot--active' : ''}"></span>`
  ).join('');
}

function buildStep(step, lang, isRTL) {
  switch (step) {
    case 0: return buildStep1(lang, isRTL);
    case 1: return buildStep2(lang, isRTL);
    case 2: return buildStep3(lang, isRTL);
    case 3: return buildStep4(lang, isRTL);
    default: return '';
  }
}

function wireStep(container, body, lang, isRTL, profile) {
  const nextBtn = body.querySelector('.orient-next-btn');
  if (!nextBtn) return;

  nextBtn.addEventListener('click', async () => {
    if (_currentStep < TOTAL_STEPS - 1) {
      _currentStep++;
      renderStep(container, lang, isRTL, profile);
    } else {
      // Final step — write first_login: false and navigate
      nextBtn.disabled = true;
      nextBtn.innerHTML = '<span class="btn-spinner"></span>';
      document.body.style.overflow = '';

      try {
        const { user } = getCurrentUser();
        await setFirstLoginComplete(user.uid);
      } catch (err) {
        console.error('[QWV welcome] Failed to set first_login:', err);
        // Navigate anyway — don't trap the student
      }

      window.history.pushState(null, '', BASE + '/dashboard');
      window.dispatchEvent(new CustomEvent('qwv:navigate', { detail: { path: '/dashboard' } }));
    }
  });
}

// ── Step 1: The Journey ───────────────────────────────────────
function buildStep1(lang, isRTL) {
  const copy = {
    heading: { en: 'The Journey',    hi: 'आपका सफ़र',       ur: 'آپ کا سفر'       },
    body:    {
      en: 'Qur\'an World View is five stages — one continuous arc from reading to mastery. Each stage builds on the last. Each gate is earned.',
      hi: 'क़ुरआन वर्ल्ड व्यू पाँच मरहलों का एक सफ़र है — पढ़ने से महारत तक। हर मरहला पिछले पर बनता है। हर दरवाज़ा कमाना पड़ता है।',
      ur: 'قرآن ورلڈ ویو پانچ مراحل کا ایک سفر ہے — پڑھنے سے مہارت تک۔ ہر مرحلہ پچھلے پر بنتا ہے۔ ہر دروازہ کمانا پڑتا ہے۔',
    },
    next:    { en: 'Next', hi: 'आगे', ur: 'آگے' },
  };

  const stageCards = STAGES.map((s, i) => `
    <div class="orient-stage-card ${i === 0 ? 'orient-stage-card--active' : ''}" style="animation-delay:${i * 60}ms">
      <p class="orient-stage-num">${lang === 'ur' ? `مرحلہ ${s.n}` : lang === 'hi' ? `मरहला ${s.n}` : `Stage ${s.n}`}</p>
      <p class="orient-stage-arabic">${renderArabic(s.arabic)}</p>
      <p class="orient-stage-name">${t(`stage_${s.n}_name`)}</p>
      <p class="orient-stage-role">${t(`stage_${s.n}_role`)}</p>
    </div>
  `).join('');

  return `
    <div class="orient-step" dir="${isRTL ? 'rtl' : 'ltr'}">
      <h2 class="orient-heading">${copy.heading[lang] || copy.heading.en}</h2>
      <div class="orient-stages-row">${stageCards}</div>
      <p class="orient-body">${copy.body[lang] || copy.body.en}</p>
      <button class="btn btn-primary orient-next-btn">${copy.next[lang] || copy.next.en} →</button>
    </div>
  `;
}

// ── Step 2: Your Starting Point ───────────────────────────────
function buildStep2(lang, isRTL) {
  const copy = {
    heading: {
      en: 'Stage 1 — Iqra',
      hi: 'मरहला 1 — इक़रा',
      ur: 'مرحلہ 1 — اقرا',
    },
    body: {
      en: 'Iqra means "Read." Your first task is simple: show up daily. Open the Qur\'an. Build the habit of presence before you build the habit of understanding. Consistency is the foundation everything else stands on.',
      hi: 'इक़रा का मतलब है "पढ़ो।" आपका पहला काम आसान है: रोज़ हाज़िर हों। क़ुरआन खोलें। समझ की आदत बनाने से पहले हाज़िरी की आदत बनाएं। हर चीज़ की बुनियाद यही है।',
      ur: 'اقرا کا مطلب ہے "پڑھو۔" آپ کا پہلا کام آسان ہے: روزانہ حاضر ہوں۔ قرآن کھولیں۔ سمجھ کی عادت بنانے سے پہلے حاضری کی عادت بنائیں۔ ہر چیز کی بنیاد یہی ہے۔',
    },
    next: { en: 'Next', hi: 'आगे', ur: 'آگے' },
  };

  return `
    <div class="orient-step" dir="${isRTL ? 'rtl' : 'ltr'}">
      <h2 class="orient-heading">${copy.heading[lang] || copy.heading.en}</h2>

      <div class="orient-stage-spotlight">
        <p class="orient-stage-arabic orient-stage-arabic--lg">${renderArabic('اِقْرَأ')}</p>
        <p class="orient-stage-spotlight-role">${t('stage_1_role')}</p>
      </div>

      <p class="orient-body">${copy.body[lang] || copy.body.en}</p>
      <button class="btn btn-primary orient-next-btn">${copy.next[lang] || copy.next.en} →</button>
    </div>
  `;
}

// ── Step 3: The Reflection Space ──────────────────────────────
function buildStep3(lang, isRTL) {
  const copy = {
    heading: {
      en: 'The Reflection Space',
      hi: 'आपकी तहरीर की जगह',
      ur: 'آپ کی تحریر کی جگہ',
    },
    body: {
      en: 'Below your Journey Map is a space to write. Every insight, every question, every thing the Qur\'an says to you — write it. When approved, it joins the QWV Library: a permanent, living record of Qur\'anic worldviews. Every reflection you contribute is sadaqah jariyah.',
      hi: 'आपके जर्नी मैप के नीचे लिखने की जगह है। हर समझ, हर सवाल, क़ुरआन जो भी आपसे कहे — लिखें। मंज़ूर होने पर वो QWV लाइब्रेरी में जाती है: एक हमेशा के लिए ज़िंदा ख़ज़ाना। आपकी हर तहरीर सदक़ह जारियह है।',
      ur: 'آپ کے جرنی میپ کے نیچے لکھنے کی جگہ ہے۔ ہر سمجھ، ہر سوال، قرآن جو بھی آپ سے کہے — لکھیں۔ منظور ہونے پر وہ QWV لائبریری میں جاتی ہے: ایک ہمیشہ کے لیے زندہ خزانہ۔ آپ کی ہر تحریر صدقہ جاریہ ہے۔',
    },
    gem: {
      en: 'Every insight you write becomes sadaqah jariyah.',
      hi: 'आपकी हर तहरीर सदक़ह जारियह है।',
      ur: 'آپ کی ہر تحریر صدقہ جاریہ ہے۔',
    },
    next: { en: 'Next', hi: 'आगे', ur: 'آگے' },
  };

  return `
    <div class="orient-step" dir="${isRTL ? 'rtl' : 'ltr'}">
      <h2 class="orient-heading">${copy.heading[lang] || copy.heading.en}</h2>

      <div class="orient-gem-callout">
        <span class="orient-gem-icon" aria-hidden="true">◆</span>
        <p class="orient-gem-text">${copy.gem[lang] || copy.gem.en}</p>
      </div>

      <p class="orient-body">${copy.body[lang] || copy.body.en}</p>
      <button class="btn btn-primary orient-next-btn">${copy.next[lang] || copy.next.en} →</button>
    </div>
  `;
}

// ── Step 4: The Gate ──────────────────────────────────────────
function buildStep4(lang, isRTL) {
  const copy = {
    heading: {
      en: 'Each Stage is Earned',
      hi: 'हर मरहला कमाया जाता है',
      ur: 'ہر مرحلہ کمایا جاتا ہے',
    },
    body: {
      en: 'There is no shortcut through QWV. When you are ready for the next stage, we will know — and we will open the door. This keeps the journey meaningful for everyone who walks it.',
      hi: 'QWV में कोई शॉर्टकट नहीं है। जब आप अगले मरहले के लिए तैयार होंगे, हमें पता चल जाएगा — और हम दरवाज़ा खोल देंगे। इससे हर किसी का सफ़र मायनेदार रहता है।',
      ur: 'QWV میں کوئی شارٹ کٹ نہیں ہے۔ جب آپ اگلے مرحلے کے لیے تیار ہوں گے، ہمیں پتہ چل جائے گا — اور ہم دروازہ کھول دیں گے۔ اس سے ہر کسی کا سفر معنی خیز رہتا ہے۔',
    },
    gate: {
      en: 'Each stage is earned, not bought.',
      hi: 'हर मरहला कमाना पड़ता है, ख़रीदा नहीं जाता।',
      ur: 'ہر مرحلہ کمانا پڑتا ہے، خریدا نہیں جاتا۔',
    },
    cta: {
      en: 'Enter the Dashboard',
      hi: 'डैशबोर्ड खोलें',
      ur: 'ڈیش بورڈ کھولیں',
    },
  };

  return `
    <div class="orient-step" dir="${isRTL ? 'rtl' : 'ltr'}">
      <h2 class="orient-heading">${copy.heading[lang] || copy.heading.en}</h2>

      <div class="orient-gate-callout">
        <span class="orient-gate-icon" aria-hidden="true">🔒</span>
        <p class="orient-gate-text">${copy.gate[lang] || copy.gate.en}</p>
      </div>

      <p class="orient-body">${copy.body[lang] || copy.body.en}</p>

      <button class="btn btn-primary btn-lg orient-next-btn orient-final-btn">
        ${copy.cta[lang] || copy.cta.en}
      </button>
    </div>
  `;
}
