/**
 * QUR'AN WORLD VIEW — apply.js
 * Student Application Form — the front door to QWV.
 * 3 MCQs + open reflection + name + email
 * Trilingual: EN / HI / UR
 */

import { t, getLang, setLang } from '../core/i18n.js';
import { db }                  from '../core/firebase.js';
import { isLoggedIn }          from '../core/auth.js';

const BASE       = window.QWV_BASE || '';
const WORKER_URL = 'https://qwv-worker.YOUR-SUBDOMAIN.workers.dev'; // ← update after wrangler deploy

// ── Form persistence via localStorage ────────────────────────
// Saves progress as user fills in — survives a refresh.
// Cleared on successful submission.
const STORAGE_KEY = 'qwv_apply_draft';
function saveDraft(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {} }
function loadDraft()     { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch(e) { return null; } }
function clearDraft()    { try { localStorage.removeItem(STORAGE_KEY); } catch(e) {} }

export default function render(container) {
  if (isLoggedIn()) {
    window.history.replaceState(null, '', BASE + '/dashboard');
    window.dispatchEvent(new CustomEvent('qwv:navigate', { detail: { path: '/dashboard' } }));
    return;
  }
  container.innerHTML = buildPage();
  wirePage(container);
}

function getQuestions(lang) {
  return [
    {
      id: 'q1',
      text: {
        en: "How would you describe your current relationship with the Qur'an?",
        hi: 'आप अभी क़ुरआन के साथ अपने रिश्ते को कैसे बयान करेंगे?',
        ur: 'آپ ابھی قرآن کے ساتھ اپنے رشتے کو کیسے بیان کریں گے؟',
      },
      options: {
        en: ["I recite it regularly but don't understand it", "I've always wanted to understand it but don't know where to start", "I understand some Arabic but want to go deeper", "I've drifted away and want to reconnect"],
        hi: ['बाकायदगी से पढ़ता हूँ लेकिन समझता नहीं', 'हमेशा से समझना चाहता था, शुरुआत कैसे करें पता नहीं था', 'थोड़ी अरबी आती है, और गहराई में जाना है', 'दूर हो गया था, अब वापस जुड़ना है'],
        ur: ['باقاعدگی سے پڑھتا ہوں لیکن سمجھتا نہیں', 'ہمیشہ سے سمجھنا چاہتا تھا، شروعات کہاں سے کریں پتہ نہیں تھا', 'تھوڑی عربی آتی ہے، مزید گہرائی میں جانا ہے', 'دور ہو گیا تھا، اب واپس جڑنا ہے'],
      },
    },
    {
      id: 'q2',
      text: {
        en: "What does the Qur'an mean to you personally?",
        hi: 'क़ुरआन आपके लिए ज़ाती तौर पर क्या मायने रखता है?',
        ur: 'قرآن آپ کے لیے ذاتی طور پر کیا معنی رکھتا ہے؟',
      },
      options: {
        en: ["It's the word of Allah — I want to understand what He is saying to me", "It's a guide for life I haven't fully accessed yet", "It brings me peace, but I want it to bring understanding too", "It feels distant right now — I want to change that"],
        hi: ['यह अल्लाह का कलाम है — जानना चाहता हूँ वो मुझसे क्या कह रहे हैं', 'यह ज़िंदगी की रहनुमाई है जो अभी तक पूरी तरह नहीं मिली', 'सुकून देता है, लेकिन समझ भी चाहता हूँ', 'अभी दूर लगता है — यह बदलना है'],
        ur: ['یہ اللہ کا کلام ہے — جاننا چاہتا ہوں وہ مجھ سے کیا کہہ رہے ہیں', 'یہ زندگی کی رہنمائی ہے جو ابھی تک پوری طرح نہیں ملی', 'سکون دیتا ہے، لیکن سمجھ بھی چاہتا ہوں', 'ابھی دور لگتا ہے — یہ بدلنا ہے'],
      },
    },
    {
      id: 'q3',
      text: {
        en: "If you could ask the Qur'an one question right now, what kind would it be?",
        hi: 'अगर आप अभी क़ुरआन से एक सवाल पूछ सकते, तो वो किस क़िस्म का होता?',
        ur: 'اگر آپ ابھی قرآن سے ایک سوال پوچھ سکتے، تو وہ کس قسم کا ہوتا؟',
      },
      options: {
        en: ["What does Allah want from me specifically?", "How do I apply this to my actual life today?", "What am I missing that others seem to understand?", "Why does this feel so relevant to what I'm going through right now?"],
        hi: ['अल्लाह ख़ास तौर पर मुझसे क्या चाहते हैं?', 'मैं इसे आज अपनी असल ज़िंदगी में कैसे लागू करूँ?', 'वो क्या है जो मुझे अभी तक नहीं समझा?', 'यह मेरी अभी की ज़िंदगी से इतना जुड़ा क्यों लगता है?'],
        ur: ['اللہ خاص طور پر مجھ سے کیا چاہتے ہیں؟', 'میں اسے آج اپنی اصل زندگی میں کیسے لاگو کروں؟', 'وہ کیا ہے جو مجھے ابھی تک سمجھ نہیں آیا؟', 'یہ میری ابھی کی زندگی سے اتنا جڑا کیوں لگتا ہے؟'],
      },
    },
  ];
}

function buildPage() {
  const lang = getLang();
  const isRTL = lang === 'ur';
  const questions = getQuestions(lang);

  const reflQ = {
    en: "In your own words — what brought you here today? What are you hoping for?",
    hi: 'अपने अल्फ़ाज़ में — आज यहाँ क्या लाया? क्या उम्मीद है?',
    ur: 'اپنے الفاظ میں — آج یہاں کیا لایا؟ کیا امید ہے؟',
  };

  return `<div class="apply-page" ${isRTL ? 'dir="rtl"' : ''}>
    <div class="apply-bg" aria-hidden="true"></div>
    <div class="apply-wrap">

      <div class="apply-header">
        <a href="${BASE}/" class="apply-logo-link">
          <img src="${BASE}/icons/logo.png" alt="QWV" width="40" height="40" />
        </a>
        <div class="lang-toggle" role="group" aria-label="Language">
          ${['en','hi','ur'].map(code => `
            <button class="lang-toggle-btn ${lang===code?'active':''}" data-lang="${code}"
              aria-pressed="${lang===code}">${code.toUpperCase()}</button>`).join('')}
        </div>
      </div>

      <div class="apply-intro animate-fade-up">
        <span class="section-label">Qur'an World View</span>
        <h1 class="apply-title">${lang==='ur'?'سفر شروع کریں':lang==='hi'?'सफ़र शुरू करें':'Begin the Journey'}</h1>
        <p class="apply-subtitle">${lang==='ur'
          ? 'یہ کوئی سائن اپ فارم نہیں۔ یہ ایک بات ہے۔ دروازہ کھولنے سے پہلے ہم جاننا چاہتے ہیں آپ کون ہیں۔'
          : lang==='hi'
          ? 'यह कोई साइनअप फ़ॉर्म नहीं। यह एक बात है। दरवाज़ा खोलने से पहले हम जानना चाहते हैं आप कौन हैं।'
          : "This isn't a signup form. It's a conversation. We want to know who you are before we open the door."
        }</p>
      </div>

      <form class="apply-form" id="apply-form" novalidate>

        ${questions.map((q, qi) => `
          <div class="apply-question animate-fade-up" style="animation-delay:${(qi+1)*100}ms;">
            <p class="apply-q-num">${lang==='ur'?`سوال ${qi+1}`:lang==='hi'?`सवाल ${qi+1}`:`Question ${qi+1}`}</p>
            <p class="apply-q-text">${q.text[lang]||q.text.en}</p>
            <div class="apply-options">
              ${(q.options[lang]||q.options.en).map((opt,oi)=>`
                <label class="apply-option">
                  <input type="radio" name="${q.id}" value="${oi}" />
                  <span class="apply-option-box" aria-hidden="true"></span>
                  <span class="apply-option-label">${opt}</span>
                </label>`).join('')}
            </div>
          </div>`).join('')}

        <div class="apply-question animate-fade-up" style="animation-delay:400ms;">
          <p class="apply-q-num">${lang==='ur'?'آپ کے الفاظ میں':lang==='hi'?'आपके अपने अल्फ़ाज़ में':'In your own words'}</p>
          <p class="apply-q-text">${reflQ[lang]||reflQ.en}</p>
          <textarea id="apply-reflection" rows="6"
            placeholder="${lang==='ur'?'یہاں لکھیں…':lang==='hi'?'यहाँ लिखें…':'Write here…'}"></textarea>
          <p class="apply-char-hint" id="char-hint">
            ${lang==='ur'?'کم از کم 50 حرف':lang==='hi'?'कम से कम 50 अक्षर':'Minimum 50 characters'}
          </p>
        </div>

        <div class="apply-question apply-personal animate-fade-up" style="animation-delay:500ms;">
          <p class="apply-q-num">${lang==='ur'?'آپ کے بارے میں':lang==='hi'?'आपके बारे में':'About you'}</p>
          <div class="apply-personal-fields">
            <div class="form-group">
              <label class="form-label" for="apply-name">
                ${lang==='ur'?'آپ کا نام':lang==='hi'?'आपका नाम':'Your name'}
              </label>
              <input type="text" id="apply-name" autocomplete="name"
                placeholder="${lang==='ur'?'پورا نام':lang==='hi'?'पूरा नाम':'Full name'}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="apply-email">
                ${lang==='ur'?'آپ کی ای میل':lang==='hi'?'आपकी ई-मेल':'Your email'}
              </label>
              <input type="email" id="apply-email" autocomplete="email"
                inputmode="email" placeholder="you@example.com" />
            </div>
          </div>
        </div>

        <div id="apply-error" class="login-error hidden" role="alert"></div>

        <div class="apply-submit animate-fade-up" style="animation-delay:600ms;">
          <button type="submit" class="btn btn-primary btn-lg" id="apply-submit-btn">
            ${lang==='ur'?'درخواست بھیجیں':lang==='hi'?'दरख़्वास्त भेजें':'Send my application'}
          </button>
          <p class="apply-note">
            ${lang==='ur'
              ? 'ہم ہر درخواست خود پڑھتے ہیں۔ منظور ہوئی تو ذاتی طور پر رابطہ کریں گے۔'
              : lang==='hi'
              ? 'हम हर दरख़्वास्त ख़ुद पढ़ते हैं। मंज़ूर हुई तो ज़ाती तौर पर रब्ता करेंगे।'
              : "We read every application ourselves. If approved, we'll reach out personally."
            }
          </p>
        </div>

      </form>

      <div id="apply-success" class="apply-success hidden">
        <div class="apply-success-inner animate-scale-up">
          <img src="${BASE}/icons/logo.png" alt="" width="72" height="72" class="animate-float" />
          <h2>${lang==='ur'?'جزاک اللہ خیراً':lang==='hi'?'जज़ाकअल्लाह ख़ैरन':'JazakAllah Khayran'}</h2>
          <p>${lang==='ur'
            ? 'آپ کی درخواست مل گئی۔ ہم خود پڑھیں گے اور جلد ذاتی طور پر رابطہ کریں گے۔'
            : lang==='hi'
            ? 'आपकी दरख़्वास्त मिल गई। हम ख़ुद पढ़ेंगे और जल्द ज़ाती तौर पर रब्ता करेंगे।'
            : "Your application has been received. We'll read it ourselves and reach out personally."
          }</p>
          <a href="${BASE}/" class="btn btn-outline" style="margin-top:var(--space-6);">${t('nav_home')}</a>
        </div>
      </div>

    </div>
  </div>`;
}

function wirePage(container) {
  const lang = getLang();

  // Restore any saved draft
  const draft = loadDraft();
  if (draft) {
    // Restore MCQ selections
    if (draft.answers) {
      Object.entries(draft.answers).forEach(([qid, val]) => {
        const radio = container.querySelector(`input[name="${qid}"][value="${val}"]`);
        if (radio) radio.checked = true;
      });
    }
    // Restore reflection
    const reflEl = container.querySelector('#apply-reflection');
    if (reflEl && draft.reflection) {
      reflEl.value = draft.reflection;
      reflEl.dispatchEvent(new Event('input')); // trigger char counter
    }
    // Restore name + email
    const nameEl  = container.querySelector('#apply-name');
    const emailEl = container.querySelector('#apply-email');
    if (nameEl  && draft.name)  nameEl.value  = draft.name;
    if (emailEl && draft.email) emailEl.value = draft.email;
  }

  // Lang toggle
  container.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      import('../core/i18n.js').then(({ setLang }) => {
        setLang(btn.dataset.lang);
        container.innerHTML = buildPage();
        wirePage(container);
      });
    });
  });

  // Char counter
  const reflEl   = container.querySelector('#apply-reflection');
  const hintEl   = container.querySelector('#char-hint');
  reflEl?.addEventListener('input', () => {
    const n = reflEl.value.length;
    if (!hintEl) return;
    if (n >= 50) {
      hintEl.style.color = 'var(--success)';
      hintEl.textContent = lang==='ur'?`${n} حرف ✓`:lang==='hi'?`${n} अक्षर ✓`:`${n} characters ✓`;
    } else {
      hintEl.style.color = 'var(--text-muted)';
      const r = 50-n;
      hintEl.textContent = lang==='ur'?`${r} مزید درکار`:lang==='hi'?`${r} और चाहिए`:`${r} more to go`;
    }
  });

  // Auto-save draft on any change
  function persistDraft() {
    const answers = {};
    ['q1','q2','q3'].forEach(qid => {
      const sel = container.querySelector(`input[name="${qid}"]:checked`);
      if (sel) answers[qid] = sel.value;
    });
    saveDraft({
      answers,
      reflection: container.querySelector('#apply-reflection')?.value || '',
      name:       container.querySelector('#apply-name')?.value || '',
      email:      container.querySelector('#apply-email')?.value || '',
    });
  }

  container.querySelectorAll('input[type="radio"]').forEach(r =>
    r.addEventListener('change', persistDraft)
  );
  container.querySelector('#apply-reflection')?.addEventListener('input', persistDraft);
  container.querySelector('#apply-name')?.addEventListener('input', persistDraft);
  container.querySelector('#apply-email')?.addEventListener('input', persistDraft);

  // Submit
  const form   = container.querySelector('#apply-form');
  const btnEl  = container.querySelector('#apply-submit-btn');
  const errEl  = container.querySelector('#apply-error');
  const succEl = container.querySelector('#apply-success');

  const showErr = (msg) => { if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); } };

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl?.classList.add('hidden');

    const questions = getQuestions(lang);
    const answers   = {};
    let allAnswered  = true;

    questions.forEach(q => {
      const sel = form.querySelector(`input[name="${q.id}"]:checked`);
      if (!sel) { allAnswered = false; return; }
      const opts = q.options[lang] || q.options.en;
      answers[q.text[lang]||q.text.en] = opts[parseInt(sel.value)];
    });

    if (!allAnswered) return showErr(
      lang==='ur'?'براہ کرم تمام سوالوں کے جواب دیں۔':
      lang==='hi'?'कृपया सभी सवालों के जवाब दें।':
      'Please answer all questions.'
    );

    const reflection = container.querySelector('#apply-reflection')?.value.trim();
    const name       = container.querySelector('#apply-name')?.value.trim();
    const email      = container.querySelector('#apply-email')?.value.trim();

    if (!reflection || reflection.length < 50) return showErr(
      lang==='ur'?'براہ کرم کم از کم 50 حرف لکھیں۔':
      lang==='hi'?'कृपया कम से कम 50 अक्षर लिखें।':
      'Please write at least 50 characters in your reflection.'
    );

    if (!name) return showErr(
      lang==='ur'?'براہ کرم اپنا نام لکھیں۔':
      lang==='hi'?'कृपया अपना नाम लिखें।':
      'Please enter your name.'
    );

    if (!email || !email.includes('@')) return showErr(
      lang==='ur'?'براہ کرم درست ای میل لکھیں۔':
      lang==='hi'?'कृपया सही ई-मेल लिखें।':
      'Please enter a valid email.'
    );

    btnEl.disabled = true;
    btnEl.innerHTML = '<span class="btn-spinner"></span>';

    try {
      await db.collection('applications').add({
        name, email, language: lang,
        answers, reflection,
        submitted_at: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending', uid: null, reviewed_by: null, reviewed_at: null,
      });

      // Send confirmation email via Worker — non-blocking
      fetch(WORKER_URL + '/send-confirmation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, language: lang }),
      }).catch(err => console.warn('[QWV] Confirmation email failed:', err));

      form.classList.add('hidden');
      succEl?.classList.remove('hidden');
    } catch (err) {
      btnEl.disabled = false;
      btnEl.textContent = lang==='ur'?'درخواست بھیجیں':lang==='hi'?'दरख़्वास्त भेजें':'Send my application';
      showErr(lang==='ur'?'کچھ گڑبڑ ہوئی۔ دوبارہ کوشش کریں۔':
        lang==='hi'?'कुछ गड़बड़ हुई। दोबारा कोशिश करें।':
        'Something went wrong. Please try again.');
    }
  });
}
