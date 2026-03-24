/**
 * QUR'AN WORLD VIEW — auth.js
 * ─────────────────────────────────────────────────────────────
 * Auth state management for the entire QWV ecosystem.
 *
 * Responsibilities:
 *  - Listen to Firebase auth state once on boot
 *  - Fetch and cache users/{uid} profile in module-level state
 *  - Expose getCurrentUser() for all pages — no repeated Firestore calls
 *  - Provide authGuard() and adminGuard() for route protection
 *  - Handle login, logout, password reset
 *
 * RULE: All Firebase auth calls go through this file.
 * RULE: No other file reads users/{uid} directly on boot.
 *       They call getCurrentUser() from here.
 * ─────────────────────────────────────────────────────────────
 */

import { auth, db, COLLECTIONS } from './firebase.js';

// ── Module-level state ───────────────────────────────────────
// Single source of truth for auth state across the app session.
let _currentUser   = null;   // Firebase Auth user object
let _userProfile   = null;   // users/{uid} Firestore document
let _authReady     = false;  // true once first auth check resolves
let _authCallbacks = [];     // queued callbacks waiting for auth to resolve

// ── Auth state listener ──────────────────────────────────────
// Called once from app.js on boot. Sets up the persistent listener.
export function initAuth() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        _currentUser = firebaseUser;
        _userProfile = await _fetchUserProfile(firebaseUser.uid);
      } else {
        _currentUser = null;
        _userProfile = null;
      }

      _authReady = true;

      // Resolve the boot promise on first call
      resolve({ user: _currentUser, profile: _userProfile });

      // Drain queued callbacks
      _authCallbacks.forEach(cb => cb({ user: _currentUser, profile: _userProfile }));
      _authCallbacks = [];
    });
  });
}

// ── Fetch user profile from Firestore ────────────────────────
async function _fetchUserProfile(uid) {
  try {
    const doc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (doc.exists) {
      return { uid, ...doc.data() };
    }
    // Profile not yet created (new user) — return minimal object
    return { uid, member_tier: 'student', stage: 1 };
  } catch (err) {
    console.error('[QWV auth] Failed to fetch user profile:', err);
    return { uid, member_tier: 'student', stage: 1 };
  }
}

// ── Public getters ───────────────────────────────────────────

/**
 * Returns { user, profile } synchronously if auth is already resolved.
 * If called before initAuth() resolves, queues and returns a Promise.
 */
export function getCurrentUser() {
  if (_authReady) {
    return { user: _currentUser, profile: _userProfile };
  }
  return new Promise((resolve) => {
    _authCallbacks.push(resolve);
  });
}

/** True if a user is currently logged in */
export function isLoggedIn() {
  return _authReady && _currentUser !== null;
}

/** True if logged in and member_tier is 'admin' */
export function isAdmin() {
  return isLoggedIn() && _userProfile?.member_tier === 'admin';
}

/** True if logged in and member_tier is 'sabiqun' or 'core' or 'admin' */
export function canSeeFounderInsights() {
  const tier = _userProfile?.member_tier;
  return isLoggedIn() && ['sabiqun', 'core', 'admin'].includes(tier);
}

/** Refresh the cached profile — call after progress.js updates users/{uid} */
export async function refreshUserProfile() {
  if (!_currentUser) return null;
  _userProfile = await _fetchUserProfile(_currentUser.uid);
  return _userProfile;
}

// ── Route guards ─────────────────────────────────────────────

/**
 * authGuard(loader)
 * Wraps a dynamic page import. Redirects to /login if not authenticated.
 * Usage: authGuard(() => import('./pages/dashboard.js'))
 */
export function authGuard(loader) {
  const { user } = getCurrentUser();
  if (!user) {
    // Store intended destination for post-login redirect
    sessionStorage.setItem('qwv_redirect_after_login', window.location.pathname);
    window.history.replaceState(null, '', '/login');
    return import('./pages/login.js');
  }
  return loader();
}

/**
 * adminGuard(loader)
 * Wraps a dynamic page import. Only allows through for admin users.
 * Redirects to /dashboard if logged in but not admin, or /login if not logged in.
 */
export function adminGuard(loader) {
  const { user, profile } = getCurrentUser();
  if (!user) {
    sessionStorage.setItem('qwv_redirect_after_login', '/admin');
    window.history.replaceState(null, '', '/login');
    return import('./pages/login.js');
  }
  if (profile?.member_tier !== 'admin') {
    window.history.replaceState(null, '', '/dashboard');
    return import('./pages/dashboard.js');
  }
  return loader();
}

// ── Auth actions ─────────────────────────────────────────────

/**
 * loginWithEmail(email, password)
 * Returns { success: true } or { success: false, error: string }
 */
export async function loginWithEmail(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    return { success: true };
  } catch (err) {
    return { success: false, error: _friendlyAuthError(err.code) };
  }
}

/**
 * logout()
 * Signs out and redirects to home.
 */
export async function logout() {
  try {
    await auth.signOut();
    _currentUser = null;
    _userProfile = null;
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new CustomEvent('qwv:navigate', { detail: { path: '/' } }));
  } catch (err) {
    console.error('[QWV auth] Logout error:', err);
  }
}

/**
 * sendPasswordReset(email)
 * Returns { success: true } or { success: false, error: string }
 */
export async function sendPasswordReset(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: true };
  } catch (err) {
    return { success: false, error: _friendlyAuthError(err.code) };
  }
}

// ── Error messages ───────────────────────────────────────────
// Human-friendly auth error messages. All three languages handled
// via t() in the login page — these are just the keys.
function _friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'auth_error_not_found',
    'auth/wrong-password':       'auth_error_wrong_password',
    'auth/invalid-email':        'auth_error_invalid_email',
    'auth/user-disabled':        'auth_error_disabled',
    'auth/too-many-requests':    'auth_error_too_many',
    'auth/network-request-failed': 'auth_error_network',
    'auth/invalid-credential':   'auth_error_wrong_password',
  };
  return map[code] || 'auth_error_generic';
}
