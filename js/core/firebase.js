/**
 * QUR'AN WORLD VIEW — firebase.js
 * ─────────────────────────────────────────────────────────────
 * Single Firebase initialisation for the entire QWV ecosystem.
 * Every other file imports { db, auth, storage } from here.
 * Never initialise Firebase anywhere else.
 *
 * Stack: Firebase v8 compat SDK — loaded via CDN script tags
 * in index.html BEFORE this module is imported.
 *
 * RULE: No other file calls firebase.initializeApp().
 * ─────────────────────────────────────────────────────────────
 */

// ── Firebase config ──────────────────────────────────────────
// Replace all values below with your actual Firebase project config.
// Get from: Firebase Console → Project Settings → Your Apps → SDK setup
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCqxgyulLw6nitLSjn89M1u0A7bxbWlt_U",
  authDomain:        "quranworldview-home.firebaseapp.com",
  projectId:         "quranworldview-home",
  storageBucket:     "quranworldview-home.firebasestorage.app",
  messagingSenderId: "349899904697",
  appId:             "1:349899904697:web:b78d66af8f9af2cb80ad68",
  measurementId:     "G-X21FH00JJ5",
};

// ── Initialise ───────────────────────────────────────────────
// Guard against double-initialisation (e.g. hot-reload scenarios)
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

// ── Exported service references ──────────────────────────────
export const db      = firebase.firestore();
export const auth    = firebase.auth();
export const storage = firebase.storage();

// ── Firestore settings ───────────────────────────────────────
// Enable offline persistence for PWA / mobile users
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence available in one tab only
    console.warn('[QWV] Firestore persistence: multiple tabs open.');
  } else if (err.code === 'unimplemented') {
    // Browser does not support persistence
    console.warn('[QWV] Firestore persistence: not supported in this browser.');
  }
});

// ── Collection helpers ───────────────────────────────────────
// Centralised collection references — use these everywhere,
// never hardcode collection names in other files.
export const COLLECTIONS = {
  USERS:             'users',
  LIBRARY:           'library',
  BLOG:              'blog',
  USER_REFLECTIONS:  'user_reflections',
  FOUNDER_INSIGHTS:  'founder_insights',
  CORE_APPLICATIONS: 'core_applications',
  SABIQUN_RESPONSES: 'sabiqun_responses',
  IQRA_SESSIONS:     'iqra_sessions',
  ALIF_PROGRESS:     'alif_progress',
  AAMAAL:            'aamaal',
  AHAD_MONTHS:       'ahad_months',
  MIFTAH:            'miftah',
};

// Sub-collection names
export const SUB_COLLECTIONS = {
  PROGRESS: 'progress',
  MONTHS:   'months',
  SURAHS:   'surahs',
  RESPONSES:'responses',
};
