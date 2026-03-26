/**
 * QUR'AN WORLD VIEW — home.js
 * ─────────────────────────────────────────────────────────────
 * Public home page. Six sections:
 *   1. Hero Slideshow
 *   2. Ayah of the Day
 *   3. The 5-Stage Journey Overview
 *   4. Testimonials
 *   5. Blog / Reflections preview
 *   6. About / Mission + 8 Guiding Principles
 *
 * All content from JSON files or Firestore — nothing hardcoded.
 * All text through t(). All Arabic through ArabicText.js.
 * Mobile-first throughout.
 * ─────────────────────────────────────────────────────────────
 */

import { t, getLang }           from '../core/i18n.js';
import { ayahText }             from '../core/ArabicText.js';
import { db }                   from '../core/firebase.js';

const BASE = window.QWV_BASE || '';

// ── Entry point ───────────────────────────────────────────────
export default async function render(container) {
  container.innerHTML = buildShell();

  const [slides, ayah, testimonials, blogPosts] = await Promise.all([
    fetchJSON(BASE + '/js/data/slides.json').then(d => d?.slides || []),
    fetchJSON(BASE + '/js/data/ayah-of-the-day.json'),
    fetchJSON(BASE + '/js/data/testimonials.json').then(d => d?.testimonials || []),
    fetchBlogPosts(),
  ]);

  renderHero(container.querySelector('#section-hero'), slides);
  renderAyah(container.querySelector('#section-ayah'), ayah);
  renderJourney(container.querySelector('#section-journey'));
  renderTestimonials(container.querySelector('#section-testimonials'), testimonials);
  renderBlog(container.querySelector('#section-blog'), blogPosts);
  renderAbout(container.querySelector('#section-about'));

  initRevealObserver(container);
}

// ── Shell ─────────────────────────────────────────────────────
function buildShell() {
  return `
    <div class="home-page">
      <section id="section-hero"         class="home-hero-wrap"></section>
      <section id="section-ayah"         class="section home-section"></section>
      <section id="section-journey"      class="section home-section home-section-alt"></section>
      <section id="section-testimonials" class="section home-section"></section>
      <section id="section-blog"         class="section home-section home-section-alt"></section>
      <section id="section-about"        class="section home-section home-about"></section>
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════════
// SECTION 1 — HERO SLIDESHOW
// ═══════════════════════════════════════════════════════════════

function renderHero(el, slides) {
  if (!el || !slides.length) return;
  const lang = getLang();

  el.innerHTML = `
    <div class="hero-slideshow" id="hero-slideshow" role="region" aria-label="Introduction" tabindex="0">
      <canvas class="hero-particles" id="hero-particles" aria-hidden="true"></canvas>
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-slides-container">
        ${slides.map((slide, i) => buildSlide(slide, i, lang)).join('')}
      </div>
      <div class="hero-slide-dots" role="tablist" aria-label="Slide navigation">
        ${slides.map((_, i) => `
          <button class="hero-dot ${i === 0 ? 'active' : ''}"
            role="tab" aria-selected="${i === 0}"
            aria-label="Slide ${i + 1}" data-index="${i}">
          </button>
        `).join('')}
      </div>
      <p class="hero-keyboard-hint" aria-hidden="true">← →</p>
    </div>
  `;

  initParticles('hero-particles');
  initSlideshow('hero-slideshow', slides.length);
}

function buildSlide(slide, index, lang) {
  const isFirst = index === 0;

  if (slide.type === 'problem') {
    const line1 = slide.line1?.[lang] || slide.line1?.en || '';
    const line2 = slide.line2?.[lang] || slide.line2?.en || '';
    return `
      <div class="hero-slide hero-slide-problem ${isFirst ? 'active' : ''}"
        role="tabpanel" data-index="${index}">
        <div class="hero-slide-inner">
          <p class="hero-problem-line1 hero-anim">${line1}</p>
          ${line2 ? `<p class="hero-problem-line2 hero-anim hero-anim-delay">${line2}</p>` : ''}
        </div>
      </div>`;
  }

  if (slide.type === 'solution') {
    const line1    = slide.line1?.[lang]     || slide.line1?.en     || '';
    const ctaLabel = slide.cta_label?.[lang] || slide.cta_label?.en || t('begin_journey');
    const lines    = line1.split('\n');
    return `
      <div class="hero-slide hero-slide-solution ${isFirst ? 'active' : ''}"
        role="tabpanel" data-index="${index}">
        <div class="hero-slide-inner">
          <p class="hero-brand-eyebrow hero-anim">Qur'an World View</p>
          <h1 class="hero-solution-heading hero-anim hero-anim-delay">
            ${lines.map(l => `<span class="hero-solution-line">${l}</span>`).join('')}
          </h1>
          <a href="${slide.cta_href || '/journey'}"
            class="btn btn-primary btn-lg hero-cta hero-anim hero-anim-delay2">
            ${ctaLabel}
          </a>
        </div>
      </div>`;
  }

  return '';
}

// ── Particle canvas ───────────────────────────────────────────
function initParticles(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [], raf;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function spawn() {
    const count = Math.floor((W * H) / 12000);
    particles = [];
    for (let i = 0; i < count; i++) {
      const gold = Math.random() > 0.38;
      particles.push({
        x:       Math.random() * W,
        y:       Math.random() * H,
        r:       Math.random() * 1.6 + 0.3,
        baseAlpha: Math.random() * 0.45 + 0.08,
        speed:   Math.random() * 0.22 + 0.05,
        drift:   (Math.random() - 0.5) * 0.15,
        phase:   Math.random() * Math.PI * 2,
        cr: gold ? 201 : 120,
        cg: gold ? 168 : 15,
        cb: gold ? 76  : 0,
      });
    }
  }

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      const pulse = Math.sin(ts * 0.00075 + p.phase) * 0.15;
      const alpha = Math.max(0.03, p.baseAlpha + pulse);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.cr},${p.cg},${p.cb},${alpha.toFixed(2)})`;
      ctx.fill();
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -4)  p.y = H + 4;
      if (p.x < -4)  p.x = W + 4;
      if (p.x > W+4) p.x = -4;
    }
    raf = requestAnimationFrame(draw);
  }

  new ResizeObserver(() => { resize(); spawn(); }).observe(canvas);
  resize(); spawn();
  raf = requestAnimationFrame(draw);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(draw);
  });
}

// ── Slideshow controller ──────────────────────────────────────
function initSlideshow(id, total) {
  const wrap = document.getElementById(id);
  if (!wrap) return;

  let current = 0, timer, running = true;
  const DELAY = 5000;

  const slides = () => wrap.querySelectorAll('.hero-slide');
  const dots   = () => wrap.querySelectorAll('.hero-dot');

  function goTo(n) {
    const s = slides(), d = dots();
    s[current]?.classList.remove('active');
    d[current]?.classList.remove('active');
    d[current]?.setAttribute('aria-selected', 'false');

    current = ((n % total) + total) % total;

    s[current]?.classList.add('active');
    d[current]?.classList.add('active');
    d[current]?.setAttribute('aria-selected', 'true');

    // Re-trigger entry animations
    s[current]?.querySelectorAll('.hero-anim').forEach(el => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  }

  function tick()  { clearInterval(timer); timer = setInterval(() => { if (running) goTo(current + 1); }, DELAY); }

  dots().forEach(d => d.addEventListener('click', () => { goTo(+d.dataset.index); tick(); }));

  wrap.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { goTo(current + 1); tick(); }
    if (e.key === 'ArrowLeft')  { goTo(current - 1); tick(); }
  });

  let tx = 0;
  wrap.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  wrap.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 44) { goTo(dx < 0 ? current + 1 : current - 1); tick(); }
  }, { passive: true });

  wrap.addEventListener('mouseenter', () => { running = false; });
  wrap.addEventListener('mouseleave', () => { running = true;  });

  tick();
}


// ═══════════════════════════════════════════════════════════════
// SECTION 2 — AYAH OF THE DAY
// ═══════════════════════════════════════════════════════════════

function renderAyah(el, ayah) {
  if (!el || !ayah) return;
  const lang        = getLang();
  const translation = ayah.translation?.[lang] || ayah.translation?.en || '';
  const surahName   = ayah.surah_name?.[lang]  || ayah.surah_name?.en  || '';
  const platform    = ayah.platform || 'instagram';
  const platformCap = platform.charAt(0).toUpperCase() + platform.slice(1);

  el.innerHTML = `
    <div class="container">
      <div class="section-heading reveal">
        <span class="section-label">${t('ayah_of_day')}</span>
      </div>
      <div class="ayah-card reveal">
        <div class="ayah-arabic">
          ${ayahText(ayah.arabic, { size: 'xl', align: 'center' })}
        </div>
        <p class="ayah-translation">${translation}</p>
        <p class="ayah-reference">${surahName} · ${ayah.surah}:${ayah.ayah}</p>
        ${ayah.social_url ? `
          <a href="${ayah.social_url}" class="ayah-social-link"
            target="_blank" rel="noopener noreferrer" data-external>
            ${_socialIcon(platform)}
            ${t('ayah_view_social').replace('{{platform}}', platformCap)}
          </a>` : ''}
      </div>
    </div>
  `;
}

function _socialIcon(platform) {
  if (platform === 'youtube') return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>`;
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`;
}


// ═══════════════════════════════════════════════════════════════
// SECTION 3 — JOURNEY OVERVIEW
// ═══════════════════════════════════════════════════════════════

function renderJourney(el) {
  if (!el) return;
  const lang = getLang();

  const stages = [1,2,3,4,5].map(n => ({
    n,
    arabic: t(`stage_${n}_arabic`),
    name:   t(`stage_${n}_name`),
    role:   t(`stage_${n}_role`),
  }));

  const heading = lang === 'ur' ? 'پانچ مرحلے۔ ایک منزل۔' : lang === 'hi' ? 'पाँच मरहले। एक मंज़िल।' : 'Five Stages. One Destination.';
  const sub     = lang === 'ur' ? 'اقرا سے مفتاح تک — ایک تبدیلی کا سفر۔' : lang === 'hi' ? 'इक़रा से मिफ़्ताह तक — एक तब्दीली का सफ़र।' : 'From Iqra to Miftah — a transformational journey through the Qur\'an.';
  const label   = lang === 'ur' ? 'سفر' : lang === 'hi' ? 'सफ़र' : 'The Journey';

  el.innerHTML = `
    <div class="container">
      <div class="section-heading reveal">
        <span class="section-label">${label}</span>
        <h2>${heading}</h2>
        <p>${sub}</p>
      </div>
      <div class="journey-stages-grid">
        ${stages.map((s, i) => `
          <div class="journey-stage-card reveal" style="transition-delay:${i * 80}ms">
            <p class="stage-card-number">${lang === 'ur' ? `مرحلہ ${_toArabicNums(s.n)}` : lang === 'hi' ? `मरहला ${s.n}` : `Stage ${s.n}`}</p>
            <p class="stage-card-arabic">${s.arabic}</p>
            <p class="stage-card-name">${s.name}</p>
            <p class="stage-card-role">${s.role}</p>
          </div>`).join('')}
      </div>
      <p class="journey-gate-rule reveal">"${t('gate_rule')}"</p>
      <div class="reveal" style="text-align:center; margin-top:var(--space-8);">
        <a href="${BASE}/journey" class="btn btn-outline btn-lg">${t('explore_journey')}</a>
      </div>
    </div>
  `;
}

function _toArabicNums(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}


// ═══════════════════════════════════════════════════════════════
// SECTION 4 — TESTIMONIALS
// ═══════════════════════════════════════════════════════════════

function renderTestimonials(el, items) {
  if (!el || !items?.length) return;
  const lang = getLang();
  const heading = lang === 'ur' ? 'طلبا کیا کہتے ہیں' : lang === 'hi' ? 'तालिब क्या कहते हैं' : 'What Students Say';

  el.innerHTML = `
    <div class="container">
      <div class="section-heading reveal">
        <span class="section-label">${t('testimonials_title')}</span>
        <h2>${heading}</h2>
      </div>
      <div class="testimonials-grid">
        ${items.map((item, i) => `
          <div class="testimonial-card reveal" style="transition-delay:${i * 100}ms">
            <span class="testimonial-quote-mark" aria-hidden="true">"</span>
            <p class="testimonial-text">${item.quote?.[lang] || item.quote?.en || ''}</p>
            <div class="testimonial-author">
              <div>
                <p class="testimonial-author-name">${item.name}</p>
                <p class="testimonial-author-stage">${item.stage}</p>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════════
// SECTION 5 — BLOG PREVIEW
// ═══════════════════════════════════════════════════════════════

function renderBlog(el, posts) {
  if (!el) return;
  const lang    = getLang();
  const heading = lang === 'ur' ? 'تازہ تحریریں' : lang === 'hi' ? 'ताज़ी तहरीरें' : 'Recent Reflections';
  const empty   = lang === 'ur' ? 'تحریریں جلد آ رہی ہیں۔' : lang === 'hi' ? 'तहरीरें जल्द आ रही हैं।' : 'Reflections coming soon.';

  el.innerHTML = `
    <div class="container">
      <div class="section-heading reveal">
        <span class="section-label">${t('blog_title')}</span>
        <h2>${heading}</h2>
      </div>
      ${!posts?.length
        ? `<p class="reveal" style="text-align:center; color:var(--text-muted);">${empty}</p>`
        : `
          <div class="blog-cards-grid">
            ${posts.map((post, i) => {
              const title   = post.title?.[lang]  || post.title?.en  || '';
              const excerpt = post.body?.substring(0, 140) + '…'     || '';
              const date    = post.published_at?.toDate?.()?.toLocaleDateString() || '';
              return `
                <article class="blog-card reveal" style="transition-delay:${i * 100}ms">
                  <div class="blog-card-body">
                    <h3 class="blog-card-title">${title}</h3>
                    <p class="blog-card-excerpt">${excerpt}</p>
                    <div class="blog-card-meta">
                      <span>${post.author || ''}</span>
                      ${date ? `<span>·</span><span>${date}</span>` : ''}
                    </div>
                    <a href="${BASE}/blog/${post.id}" class="blog-card-read-more">
                      ${t('read_more')}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </a>
                  </div>
                </article>`;
            }).join('')}
          </div>
          <div class="reveal" style="text-align:center; margin-top:var(--space-10);">
            <a href="${BASE}/blog" class="btn btn-outline">${t('view_all')}</a>
          </div>`
      }
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════════
// SECTION 6 — ABOUT / MISSION + PRINCIPLES
// ═══════════════════════════════════════════════════════════════

function renderAbout(el) {
  if (!el) return;
  const lang = getLang();

  const mission = {
    en: "Qur'an World View is a transformational journey — five stages, five apps, one destination: the QWV Library. Our mission is to help Urdu and Hindustani Hindi-speaking Muslims — the single largest linguistic bloc in the Muslim world — understand and reflect on the Qur'an.",
    hi: "क़ुरआन वर्ल्ड व्यू एक तब्दीली का सफ़र है — पाँच मरहले, पाँच ऐप्स, एक मंज़िल: क़ुरआनी लाइब्रेरी। हमारा मक़सद है कि उर्दू और हिंदुस्तानी हिंदी बोलने वाले मुसलमान — दुनिया का सबसे बड़ा लिसानी गुरोह — क़ुरआन को समझ सकें।",
    ur: "قرآن ورلڈ ویو ایک تبدیلی کا سفر ہے — پانچ مرحلے، پانچ ایپس، ایک منزل: QWV لائبریری۔ ہمارا مقصد ہے کہ اردو اور ہندوستانی ہندی بولنے والے مسلمان — دنیا کا سب سے بڑا لسانی گروہ — قرآن کو سمجھ سکیں۔",
  };

  const principles = {
    en: [
      'We stand on shoulders of scholars. We are bridges, not sources.',
      'The heart is the filter. All study without sincere intention is useless.',
      'Quality over quantity — always. Small and serious beats large and shallow.',
      'The design communicates the values. Every UI decision is a pedagogical decision.',
      "Da'wah through excellence. Everything is offered to the Ummah freely.",
      'Community is the product. The platform is just the container.',
      'Adab before ilm. How we treat each other is itself Qur\'an.',
      'Bolchaal always. Spoken language. Never a barrier.',
    ],
    hi: [
      'हम आलिमों के कंधों पर खड़े हैं। हम पुल हैं, मनबा नहीं।',
      'दिल ही फ़िल्टर है। बिना सच्ची नीयत के कोई इल्म काम का नहीं।',
      'क्वालिटी हमेशा क्वांटिटी से बड़ी है। छोटा और सच्चा बड़े और खोखले से बेहतर है।',
      'डिज़ाइन क़द्रें बयान करता है। हर UI फ़ैसला एक तालीमी फ़ैसला है।',
      'एहसान के ज़रिए दावत। सब कुछ उम्मत को मुफ़्त पेश किया जाता है।',
      'जमात ही प्रोडक्ट है। प्लेटफ़ॉर्म तो सिर्फ़ बरतन है।',
      'इल्म से पहले अदब। हम एक-दूसरे के साथ जैसा बर्ताव करते हैं — वो ख़ुद क़ुरआन है।',
      'बोलचाल हमेशा। आसान ज़बान। कभी रुकावट नहीं।',
    ],
    ur: [
      'ہم علماء کے کندھوں پر کھڑے ہیں۔ ہم پل ہیں، منبع نہیں۔',
      'دل ہی فلٹر ہے۔ سچی نیت کے بغیر کوئی علم کام کا نہیں۔',
      'معیار ہمیشہ تعداد سے بڑا ہے۔ چھوٹا اور سچا بڑے اور کھوکھلے سے بہتر ہے۔',
      'ڈیزائن اقدار بیان کرتا ہے۔ ہر UI فیصلہ ایک تعلیمی فیصلہ ہے۔',
      'احسان کے ذریعے دعوت۔ سب کچھ امت کو مفت پیش کیا جاتا ہے۔',
      'جماعت ہی پروڈکٹ ہے۔ پلیٹ فارم تو صرف برتن ہے۔',
      'علم سے پہلے ادب۔ ہم ایک دوسرے کے ساتھ جیسا سلوک کرتے ہیں — وہ خود قرآن ہے۔',
      'بولچال ہمیشہ۔ آسان زبان۔ کبھی رکاوٹ نہیں۔',
    ],
  };

  const ps = principles[lang] || principles.en;
  const label = lang === 'ur' ? 'ہمارا مقصد' : lang === 'hi' ? 'हमारा मक़सद' : 'Our Mission';

  el.innerHTML = `
    <div class="about-bg-glow" aria-hidden="true"></div>
    <div class="container" style="position:relative;z-index:1;">
      <div class="section-heading reveal">
        <span class="section-label">${label}</span>
        <h2>${t('mantra')}</h2>
        <p>${mission[lang] || mission.en}</p>
      </div>

      <div class="principles-wrap">
        <p class="section-label reveal" style="text-align:center; margin-bottom:var(--space-8);">${t('about_principles')}</p>
        <div class="principles-grid">
          ${ps.map((p, i) => `
            <div class="principle-card reveal" style="transition-delay:${i * 55}ms">
              <span class="principle-number" aria-hidden="true">${i + 1}</span>
              <p class="principle-text">${p}</p>
            </div>`).join('')}
        </div>
      </div>

      <div class="reveal" style="text-align:center; margin-top:var(--space-10);">
        <a href="${BASE}/about" class="btn btn-outline btn-lg">${t('about_full_story')}</a>
      </div>
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function initRevealObserver(container) {
  const els = container.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.10, rootMargin: '0px 0px -36px 0px' });
  els.forEach(el => io.observe(el));
}

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  } catch (e) {
    console.warn('[QWV home] fetchJSON failed:', url, e);
    return null;
  }
}

async function fetchBlogPosts() {
  try {
    const snap = await db.collection('blog')
      .where('status', '==', 'published')
      .orderBy('published_at', 'desc')
      .limit(3).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}
