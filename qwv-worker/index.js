/**
 * QUR'AN WORLD VIEW — Cloudflare Worker
 * ─────────────────────────────────────────────────────────────
 * The ONLY server-side code in the QWV ecosystem.
 *
 * Endpoints:
 *   POST /send-confirmation  — confirmation email after application
 *   POST /create-account     — account creation + welcome email after admin approval
 *
 * Uses Firebase REST API (no Admin SDK npm package needed).
 * Uses Resend REST API for transactional email.
 *
 * Secrets (set via: wrangler secret put SECRET_NAME):
 *   RESEND_API_KEY
 *   FIREBASE_API_KEY
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_SERVICE_ACCOUNT_JSON
 *
 * RULE: Never add endpoints without a design session.
 * RULE: This is the only place Firebase Auth accounts are created.
 * ─────────────────────────────────────────────────────────────
 */

// ── CORS ──────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://quranworldview.pages.dev',
  'https://quranworldview.github.io',
  'http://localhost:8000',
  'http://localhost:3000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function respond(body, status = 200, origin = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// ── Main handler ──────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return respond({ error: 'Method not allowed' }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return respond({ error: 'Invalid JSON body' }, 400, origin);
    }

    if (url.pathname === '/send-confirmation') {
      return handleSendConfirmation(body, env, origin);
    }

    if (url.pathname === '/create-account') {
      return handleCreateAccount(body, env, origin);
    }

    return respond({ error: 'Not found' }, 404, origin);
  }
};

// ══════════════════════════════════════════════════════════════
// ENDPOINT 1 — /send-confirmation
// Called by apply.js after Firestore write succeeds.
// Sends a warm, Qur'anic confirmation email to the applicant.
// ══════════════════════════════════════════════════════════════

async function handleSendConfirmation(body, env, origin) {
  const { name, email, language = 'en' } = body;

  if (!name || !email) {
    return respond({ error: 'name and email are required' }, 400, origin);
  }

  const emailHtml = buildConfirmationEmail(name, language);

  try {
    await sendEmail(env, {
      to:      email,
      subject: getConfirmationSubject(language),
      html:    emailHtml,
    });
    return respond({ success: true });
  } catch (err) {
    console.error('[QWV Worker] Confirmation email failed:', err);
    // Non-blocking in the grand scheme — application was saved to Firestore
    return respond({ success: false, error: err.message }, 500, origin);
  }
}

// ══════════════════════════════════════════════════════════════
// ENDPOINT 2 — /create-account
// Called by admin.js on approval. Verifies admin, creates Firebase
// Auth user + Firestore profile, sends welcome email, returns credentials.
// ══════════════════════════════════════════════════════════════

async function handleCreateAccount(body, env, origin) {
  const { idToken, name, email, applicationId, language = 'hi' } = body;

  if (!idToken || !name || !email || !applicationId) {
    return respond({ error: 'idToken, name, email, and applicationId are required' }, 400, origin);
  }

  // 1. Verify caller is authenticated + is admin
  let callerUid;
  try {
    callerUid = await verifyAdminToken(idToken, env);
  } catch (err) {
    return respond({ error: err.message }, 403, origin);
  }

  // 2. Check if email already exists
  try {
    const existing = await firebaseGetUserByEmail(email, env);
    if (existing) {
      return respond({ error: 'An account with this email already exists.' }, 409, origin);
    }
  } catch (err) {
    // If lookup throws because user doesn't exist, that's what we want — continue
    if (!err.message.includes('EMAIL_NOT_FOUND') && !err.message.includes('not found')) {
      return respond({ error: 'Error checking existing account: ' + err.message }, 500, origin);
    }
  }

  // 3. Generate password
  const password = generatePassword();

  // 4. Create Firebase Auth user
  let uid;
  try {
    uid = await firebaseCreateUser({ email, password, displayName: name }, env);
  } catch (err) {
    return respond({ error: 'Failed to create auth account: ' + err.message }, 500, origin);
  }

  const now = new Date().toISOString();

  // 5. Create Firestore users/{uid} profile
  const profile = {
    name,
    contact:         email,
    language,
    joined_at:       { __type: 'timestamp', value: now },
    stage:           1,
    stage_unlocked:  { iqra: true, alif: false, aamaal: false, ahad: false, miftah: false },
    streak:          0,
    total_gems:      0,
    last_active:     { __type: 'timestamp', value: now },
    source:          'application',
    is_sabiqun:      false,
    member_tier:     'student',
    gate_status: {
      alif:   'locked',
      aamaal: 'locked',
      ahad:   'locked',
      miftah: 'locked',
    },
    core_member_applied:    false,
    core_member_applied_at: null,
    first_login:            true,
  };

  try {
    await firestoreSet(`users/${uid}`, profile, env);
  } catch (err) {
    // Rollback: delete the auth account
    await firebaseDeleteUser(uid, env).catch(() => {});
    return respond({ error: 'Failed to create user profile: ' + err.message }, 500, origin);
  }

  // 6. Mark application as approved
  try {
    await firestoreUpdate(`applications/${applicationId}`, {
      status:      'approved',
      uid,
      reviewed_by: callerUid,
      reviewed_at: { __type: 'timestamp', value: now },
    }, env);
  } catch (err) {
    // Non-critical — account was created, just log
    console.error('[QWV Worker] Failed to update application status:', err);
  }

  // 7. Send welcome email
  try {
    const welcomeHtml = buildWelcomeEmail(name, email, password, language);
    await sendEmail(env, {
      to:      email,
      subject: getWelcomeSubject(language),
      html:    welcomeHtml,
    });
  } catch (err) {
    console.error('[QWV Worker] Welcome email failed:', err);
    // Non-critical — account was created. Admin has credentials in the card.
  }

  // 8. Return credentials to admin panel
  return respond({
    success:  true,
    uid,
    name,
    email,
    password,
    message: `Account created for ${name}. Welcome email sent.`,
  }, 200, origin);
}

// ══════════════════════════════════════════════════════════════
// FIREBASE REST API HELPERS
// ══════════════════════════════════════════════════════════════

/**
 * Verify an ID token and check that the caller is an admin.
 * Returns the caller's UID if valid and admin, throws otherwise.
 */
async function verifyAdminToken(idToken, env) {
  // Verify the token via Firebase Auth REST API
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  const data = await res.json();
  if (!res.ok || !data.users || data.users.length === 0) {
    throw new Error('Invalid or expired admin token.');
  }

  const uid = data.users[0].localId;

  // Check Firestore for admin tier
  const profile = await firestoreGet(`users/${uid}`, env);
  if (!profile || profile.member_tier !== 'admin') {
    throw new Error('Only admins can create student accounts.');
  }

  return uid;
}

/**
 * Get a Firebase Auth user by email.
 * Throws with 'EMAIL_NOT_FOUND' message if not found.
 */
async function firebaseGetUserByEmail(email, env) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: [email] }),
    }
  );
  const data = await res.json();
  if (data.error?.message === 'EMAIL_NOT_FOUND' || !data.users?.length) {
    throw new Error('EMAIL_NOT_FOUND');
  }
  return data.users[0];
}

/**
 * Create a Firebase Auth user via Admin REST API.
 * Uses the service account to get an access token first.
 * Returns the new user's UID.
 */
async function firebaseCreateUser({ email, password, displayName }, env) {
  const accessToken = await getServiceAccountToken(env);

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
        emailVerified: false,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to create Firebase Auth user');
  }
  return data.localId;
}

/**
 * Delete a Firebase Auth user (rollback on profile creation failure).
 */
async function firebaseDeleteUser(uid, env) {
  const accessToken = await getServiceAccountToken(env);
  await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/accounts/${uid}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  );
}

/**
 * Get a Firestore document. Returns the document fields or null.
 */
async function firestoreGet(path, env) {
  const accessToken = await getServiceAccountToken(env);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return firestoreDeserialize(data.fields || {});
}

/**
 * Set a Firestore document (create or overwrite).
 */
async function firestoreSet(path, fields, env) {
  const accessToken = await getServiceAccountToken(env);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields: firestoreSerialize(fields) }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Firestore set failed');
  }
}

/**
 * Update specific fields in a Firestore document.
 */
async function firestoreUpdate(path, fields, env) {
  const accessToken = await getServiceAccountToken(env);
  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}?${updateMask}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ fields: firestoreSerialize(fields) }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Firestore update failed');
  }
}

// ── Firestore serialization ───────────────────────────────────
// Converts plain JS objects to Firestore REST API format and back.

function firestoreSerialize(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      out[key] = { nullValue: null };
    } else if (typeof value === 'boolean') {
      out[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      out[key] = Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    } else if (typeof value === 'string') {
      out[key] = { stringValue: value };
    } else if (value && value.__type === 'timestamp') {
      out[key] = { timestampValue: value.value };
    } else if (Array.isArray(value)) {
      out[key] = { arrayValue: { values: value.map(v => firestoreSerializePrimitive(v)) } };
    } else if (typeof value === 'object') {
      out[key] = { mapValue: { fields: firestoreSerialize(value) } };
    }
  }
  return out;
}

function firestoreSerializePrimitive(value) {
  if (typeof value === 'string')  return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number')  return { integerValue: String(value) };
  return { nullValue: null };
}

function firestoreDeserialize(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if ('stringValue'  in value) out[key] = value.stringValue;
    else if ('booleanValue' in value) out[key] = value.booleanValue;
    else if ('integerValue' in value) out[key] = parseInt(value.integerValue);
    else if ('doubleValue'  in value) out[key] = value.doubleValue;
    else if ('nullValue'    in value) out[key] = null;
    else if ('mapValue'     in value) out[key] = firestoreDeserialize(value.mapValue.fields || {});
    else if ('arrayValue'   in value) out[key] = (value.arrayValue.values || []).map(v => firestoreDeserializePrimitive(v));
  }
  return out;
}

function firestoreDeserializePrimitive(v) {
  if ('stringValue'  in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue);
  return null;
}

// ── Service Account Token ─────────────────────────────────────
// Cache the access token within a single Worker invocation.
let _cachedToken = null;
let _tokenExpiry = 0;

async function getServiceAccountToken(env) {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiry - 60000) return _cachedToken;

  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);

  // Build a signed JWT
  const header  = { alg: 'RS256', typ: 'JWT' };
  const iat     = Math.floor(now / 1000);
  const exp     = iat + 3600;
  const payload = {
    iss:   sa.client_email,
    sub:   sa.client_email,
    aud:   'https://oauth2.googleapis.com/token',
    iat,
    exp,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
  };

  const jwt = await signJWT(header, payload, sa.private_key);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error('Failed to get service account token: ' + JSON.stringify(data));

  _cachedToken = data.access_token;
  _tokenExpiry = now + (data.expires_in * 1000);
  return _cachedToken;
}

// ── JWT signing (using Web Crypto API — available in Workers) ─
async function signJWT(header, payload, privateKeyPem) {
  const encode = obj => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import the private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signingInput}.${sigB64}`;
}

// ══════════════════════════════════════════════════════════════
// RESEND EMAIL HELPER
// ══════════════════════════════════════════════════════════════

async function sendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from:    'Qur\'an World View <noreply@quranworldview.pages.dev>',
      to:      [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error('Resend error: ' + JSON.stringify(err));
  }
}

// ══════════════════════════════════════════════════════════════
// PASSWORD GENERATOR
// Format: Word + 3 digits + Symbol  e.g. "Hikmah847!"
// ══════════════════════════════════════════════════════════════

function generatePassword() {
  const words   = ['Quran', 'Noor', 'Ilm', 'Hikmah', 'Sabr', 'Taqwa', 'Iman', 'Barakah'];
  const symbols = ['!', '@', '#', '$', '*'];
  const word    = words[Math.floor(Math.random() * words.length)];
  const digits  = String(Math.floor(100 + Math.random() * 900));
  const symbol  = symbols[Math.floor(Math.random() * symbols.length)];
  return `${word}${digits}${symbol}`;
}

// ══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ══════════════════════════════════════════════════════════════

function getConfirmationSubject(lang) {
  if (lang === 'ur') return 'آپ کی درخواست مل گئی — Qur\'an World View';
  if (lang === 'hi') return 'आपकी दरख़्वास्त मिल गई — Qur\'an World View';
  return 'We\'ve received your application — Qur\'an World View';
}

function getWelcomeSubject(lang) {
  if (lang === 'ur') return 'مرحبا — آپ کا QWV اکاؤنٹ تیار ہے';
  if (lang === 'hi') return 'मरहबा — आपका QWV अकाउंट तैयार है';
  return 'Ahlan — your Qur\'an World View account is ready';
}

// ── Email 1: Application Confirmation ────────────────────────
function buildConfirmationEmail(name, lang) {
  const isRTL = lang === 'ur';

  const content = {
    en: {
      greeting:   `Dear ${name},`,
      body1:      `JazakAllah khayran for taking this step. Your application to join Qur'an World View has reached us.`,
      ayahIntro:  `We leave you with the ayah that has guided this journey from the very beginning:`,
      ayahArabic: `وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا`,
      ayahRef:    `Al-Ankabut 29:69`,
      ayahTrans:  `"And those who strive for Us — We will surely guide them to Our paths."`,
      body2:      `We read every application ourselves. If approved, you will hear from us personally — insha'Allah very soon.`,
      closing:    `With du'a,<br>Yusuf<br><em>Qur'an World View</em>`,
    },
    hi: {
      greeting:   `${name},`,
      body1:      `जज़ाकअल्लाह ख़ैरन इस क़दम के लिए। क़ुरआन वर्ल्ड व्यू में शामिल होने की आपकी दरख़्वास्त हम तक पहुँच गई है।`,
      ayahIntro:  `हम आपको वो आयत याद दिलाते हैं जिसने इस सफ़र की शुरुआत से रहनुमाई की है:`,
      ayahArabic: `وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا`,
      ayahRef:    `अल-अनकबूत 29:69`,
      ayahTrans:  `"और जो लोग हमारी राह में कोशिश करते हैं, हम उन्हें अपने रास्ते ज़रूर दिखाएंगे।"`,
      body2:      `हम हर दरख़्वास्त ख़ुद पढ़ते हैं। मंज़ूर हुई तो इन्शाअल्लाह जल्द ज़ाती तौर पर रब्ता करेंगे।`,
      closing:    `दुआ के साथ,<br>यूसुफ़<br><em>क़ुरआन वर्ल्ड व्यू</em>`,
    },
    ur: {
      greeting:   `${name}،`,
      body1:      `جزاک اللہ خیراً اس قدم کے لیے۔ قرآن ورلڈ ویو میں شامل ہونے کی آپ کی درخواست ہم تک پہنچ گئی ہے۔`,
      ayahIntro:  `ہم آپ کو وہ آیت یاد دلاتے ہیں جس نے اس سفر کی شروعات سے رہنمائی کی ہے:`,
      ayahArabic: `وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا`,
      ayahRef:    `العنکبوت 29:69`,
      ayahTrans:  `"اور جو لوگ ہماری راہ میں کوشش کرتے ہیں، ہم انہیں اپنے راستے ضرور دکھائیں گے۔"`,
      body2:      `ہم ہر درخواست خود پڑھتے ہیں۔ منظور ہوئی تو انشاء اللہ جلد ذاتی طور پر رابطہ کریں گے۔`,
      closing:    `دعا کے ساتھ،<br>یوسف<br><em>قرآن ورلڈ ویو</em>`,
    },
  };

  const c = content[lang] || content.en;

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${getConfirmationSubject(lang)}</title>
</head>
<body style="margin:0;padding:0;background:#0A0C10;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0C10;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#11151C;border-radius:12px;border:1px solid rgba(201,168,76,0.20);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#780F00;padding:28px 36px;text-align:${isRTL ? 'right' : 'left'};">
            <p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:'Helvetica Neue',Arial,sans-serif;">
              Qur'an World View
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px;direction:${isRTL ? 'rtl' : 'ltr'};text-align:${isRTL ? 'right' : 'left'};">

            <p style="margin:0 0 20px;color:#F0EBE0;font-size:16px;line-height:1.7;">${c.greeting}</p>
            <p style="margin:0 0 24px;color:#CEC8BE;font-size:15px;line-height:1.8;">${c.body1}</p>

            <!-- Ayah block -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td style="background:#0A0C10;border-radius:10px;border:1px solid rgba(201,168,76,0.25);padding:24px 28px;">
                  <p style="margin:0 0 12px;color:#8A6F2E;font-size:12px;letter-spacing:1px;text-transform:uppercase;text-align:${isRTL ? 'right' : 'left'};">${c.ayahIntro}</p>
                  <p style="margin:0 0 8px;color:#C9A84C;font-size:22px;line-height:1.8;font-family:'Amiri',Georgia,serif;direction:rtl;text-align:right;">${c.ayahArabic}</p>
                  <p style="margin:0 0 8px;color:#8A6F2E;font-size:12px;text-align:${isRTL ? 'right' : 'left'};">${c.ayahRef}</p>
                  <p style="margin:0;color:#CEC8BE;font-size:14px;line-height:1.7;font-style:italic;text-align:${isRTL ? 'right' : 'left'};">${c.ayahTrans}</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;color:#CEC8BE;font-size:15px;line-height:1.8;">${c.body2}</p>
            <p style="margin:0;color:#CEC8BE;font-size:15px;line-height:1.8;">${c.closing}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
            <p style="margin:0;color:#68666E;font-size:12px;">quranworldview.pages.dev</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Email 2: Welcome + Credentials ───────────────────────────
function buildWelcomeEmail(name, email, password, lang) {
  const isRTL   = lang === 'ur';
  const loginUrl = 'https://quranworldview.pages.dev/login';

  const content = {
    en: {
      greeting:   `Marhaba, ${name}!`,
      body1:      `Your application has been approved. Welcome to Qur'an World View — the journey begins now.`,
      credTitle:  `Your login details`,
      emailLabel: `Email`,
      passLabel:  `Password`,
      passNote:   `Please change your password after your first login.`,
      loginCta:   `Begin Your Journey`,
      body2:      `When you log in for the first time, you'll be guided through a brief orientation before reaching your Dashboard.`,
      closing:    `See you on the other side.<br>— Yusuf<br><em>Qur'an World View</em>`,
    },
    hi: {
      greeting:   `मरहबा, ${name}!`,
      body1:      `आपकी दरख़्वास्त मंज़ूर हो गई। क़ुरआन वर्ल्ड व्यू में ख़ुश आमदीद — सफ़र अब शुरू होता है।`,
      credTitle:  `आपके लॉग इन की तफ़सील`,
      emailLabel: `ईमेल`,
      passLabel:  `पासवर्ड`,
      passNote:   `पहली बार लॉग इन के बाद पासवर्ड ज़रूर बदल लें।`,
      loginCta:   `सफ़र शुरू करें`,
      body2:      `पहली बार लॉग इन करने पर डैशबोर्ड से पहले एक छोटी सी रहनुमाई होगी।`,
      closing:    `उस तरफ़ मिलते हैं।<br>— यूसुफ़<br><em>क़ुरआन वर्ल्ड व्यू</em>`,
    },
    ur: {
      greeting:   `مرحبا، ${name}!`,
      body1:      `آپ کی درخواست منظور ہو گئی۔ قرآن ورلڈ ویو میں خوش آمدید — سفر اب شروع ہوتا ہے۔`,
      credTitle:  `آپ کے لاگ اِن کی تفصیل`,
      emailLabel: `ای میل`,
      passLabel:  `پاس ورڈ`,
      passNote:   `پہلی بار لاگ اِن کے بعد پاس ورڈ ضرور بدل لیں۔`,
      loginCta:   `سفر شروع کریں`,
      body2:      `پہلی بار لاگ اِن کرنے پر ڈیش بورڈ سے پہلے ایک مختصر رہنمائی ہو گی۔`,
      closing:    `اس طرف ملتے ہیں۔<br>— یوسف<br><em>قرآن ورلڈ ویو</em>`,
    },
  };

  const c = content[lang] || content.en;

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${getWelcomeSubject(lang)}</title>
</head>
<body style="margin:0;padding:0;background:#0A0C10;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0C10;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#11151C;border-radius:12px;border:1px solid rgba(201,168,76,0.20);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#780F00;padding:28px 36px;text-align:${isRTL ? 'right' : 'left'};">
            <p style="margin:0;color:#C9A84C;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
              Qur'an World View
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px;direction:${isRTL ? 'rtl' : 'ltr'};text-align:${isRTL ? 'right' : 'left'};">

            <p style="margin:0 0 8px;color:#C9A84C;font-size:22px;font-family:Georgia,serif;">${c.greeting}</p>
            <p style="margin:0 0 28px;color:#CEC8BE;font-size:15px;line-height:1.8;">${c.body1}</p>

            <!-- Credentials block -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#0A0C10;border-radius:10px;border:1px solid rgba(201,168,76,0.25);padding:24px 28px;">
                  <p style="margin:0 0 16px;color:#8A6F2E;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${c.credTitle}</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;color:#68666E;font-size:13px;width:90px;">${c.emailLabel}</td>
                      <td style="padding:8px 0;color:#F0EBE0;font-size:14px;font-family:'Courier New',monospace;">${email}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.07);color:#68666E;font-size:13px;">${c.passLabel}</td>
                      <td style="padding:8px 0;border-top:1px solid rgba(255,255,255,0.07);color:#C9A84C;font-size:16px;font-family:'Courier New',monospace;letter-spacing:1px;font-weight:bold;">${password}</td>
                    </tr>
                  </table>
                  <p style="margin:16px 0 0;color:#68666E;font-size:12px;">${c.passNote}</p>
                </td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td align="${isRTL ? 'right' : 'left'}">
                  <a href="${loginUrl}" style="display:inline-block;background:#780F00;color:#F0EBE0;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-family:'Helvetica Neue',Arial,sans-serif;">
                    ${c.loginCta} →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;color:#CEC8BE;font-size:14px;line-height:1.8;">${c.body2}</p>
            <p style="margin:0;color:#CEC8BE;font-size:15px;line-height:1.8;">${c.closing}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
            <p style="margin:0;color:#68666E;font-size:12px;">quranworldview.pages.dev</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
