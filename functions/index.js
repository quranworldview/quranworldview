/**
 * QUR'AN WORLD VIEW — Cloud Functions
 * ─────────────────────────────────────────────────────────────
 * Single Cloud Function: createStudentAccount
 *
 * Purpose: Create a Firebase Auth account for an approved applicant.
 * The client SDK cannot create Auth accounts for other users.
 * This requires the Admin SDK — hence the Cloud Function.
 *
 * Deploy:
 *   cd functions
 *   npm install
 *   firebase deploy --only functions
 *
 * Requirements:
 *   - Firebase CLI installed: npm install -g firebase-tools
 *   - Logged in: firebase login
 *   - Project set: firebase use quranworldview-home
 * ─────────────────────────────────────────────────────────────
 */

const functions  = require('firebase-functions');
const admin      = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── createStudentAccount ──────────────────────────────────────
exports.createStudentAccount = functions.https.onCall(async (data, context) => {

  // 1. Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to perform this action.'
    );
  }

  // 2. Verify caller is admin
  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().member_tier !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can create student accounts.'
    );
  }

  // 3. Validate input
  const { name, email, password, applicationId, language } = data;

  if (!name || !email || !password || !applicationId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'name, email, password, and applicationId are required.'
    );
  }

  if (password.length < 8) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Password must be at least 8 characters.'
    );
  }

  // 4. Create Firebase Auth user
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
    });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError(
        'already-exists',
        'An account with this email already exists.'
      );
    }
    throw new functions.https.HttpsError('internal', err.message);
  }

  const uid = userRecord.uid;
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 5. Create users/{uid} Firestore document
  const userProfile = {
    name,
    contact:         email,
    language:        language || 'hi',
    joined_at:       now,
    stage:           1,
    stage_unlocked:  { iqra: true, alif: false, aamaal: false, ahad: false, miftah: false },
    streak:          0,
    total_gems:      0,
    last_active:     now,
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
    application_id:         applicationId,
  };

  await db.collection('users').doc(uid).set(userProfile);

  // 6. Update application status
  await db.collection('applications').doc(applicationId).update({
    status:      'approved',
    uid,
    reviewed_by: context.auth.uid,
    reviewed_at: now,
  });

  // 7. Return success
  return {
    success:  true,
    uid,
    email,
    name,
    message: `Account created for ${name}. Share these credentials: Email: ${email} | Password: ${password}`,
  };
});
