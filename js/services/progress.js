/**
 * QUR'AN WORLD VIEW — progress.js
 * ─────────────────────────────────────────────────────────────
 * The ONLY file that writes progress data to users/{uid}.
 *
 * RULE (Golden Rule 3): No other file writes to users/{uid}.
 *   All progress updates, flags, and stage changes go through here.
 *
 * Current functions:
 *   setFirstLoginComplete(uid) — called by welcome.js after modal Step 4
 *
 * Future functions (added as each app is built):
 *   updateStreak(uid, streak)
 *   updateStage(uid, stage)
 *   updateGateStatus(uid, app, status)
 *   addGem(uid)
 *   updateLanguage(uid, lang)
 * ─────────────────────────────────────────────────────────────
 */

import { db, COLLECTIONS } from '../core/firebase.js';

/**
 * setFirstLoginComplete(uid)
 * Called by welcome.js after the student clicks "Enter the Dashboard"
 * on Step 4 of the orientation modal.
 *
 * Sets first_login: false on users/{uid}.
 * After this, the student routes directly to /dashboard on all future logins.
 *
 * RULE: This is the ONLY place first_login is ever set to false.
 */
export async function setFirstLoginComplete(uid) {
  if (!uid) throw new Error('[QWV progress] setFirstLoginComplete: uid is required');

  await db.collection(COLLECTIONS.USERS).doc(uid).update({
    first_login: false,
  });
}
