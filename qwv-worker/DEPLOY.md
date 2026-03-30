# QWV Worker — Deploy & Version Control Guide
## Test locally first. Deploy with confidence. Never lose work.

---

## Prerequisites (already done)
- [x] Cloudflare account created
- [x] Wrangler installed (`npm install -g wrangler`)
- [x] Wrangler authenticated (`wrangler login`)
- [x] Resend account + API key ready

---

## PART A — LOCAL TESTING
## Test everything before touching production.

---

### A1 — Get your Firebase credentials (needed for local Worker)

You need two things from Firebase:

**A — Firebase Web API Key**
1. Firebase Console → Project Settings → General
2. Scroll to "Your apps" → find your web app
3. Copy the `apiKey` value → this is your `FIREBASE_API_KEY`

**B — Service Account JSON**
1. Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key"
3. Download the JSON file — keep it safe, never commit it to GitHub

---

### A2 — Create .dev.vars for local secrets

Create `qwv-worker/.dev.vars` (this is the local equivalent of Wrangler secrets):

```
RESEND_API_KEY=your_resend_api_key_here
FIREBASE_API_KEY=your_firebase_web_api_key_here
FIREBASE_PROJECT_ID=quranworldview-home
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"quranworldview-home",...paste entire JSON on one line...}
```

CRITICAL: Add .dev.vars to .gitignore immediately. It contains private keys.

```bash
echo ".dev.vars" >> .gitignore
```

---

### A3 — Use test email sender for local testing

In qwv-worker/index.js, find the sendEmail function and temporarily
change the from address to Resend's test address (no domain verification needed):

```javascript
from: "Qur'an World View <onboarding@resend.dev>",
```

You will update this to your real domain before production (Step B2).

---

### A4 — Point WORKER_URL at localhost

In two files, temporarily set WORKER_URL to the local Worker:

js/pages/apply.js — top of file:
```javascript
const WORKER_URL = 'http://localhost:8787';
```

js/pages/admin.js — top of file:
```javascript
const WORKER_URL = 'http://localhost:8787';
```

---

### A5 — Start both servers

You need two terminal windows open simultaneously.

Terminal 1 — Worker:
```bash
cd qwv-worker
wrangler dev
```
Worker starts at http://localhost:8787
When prompted "Do you want to use your remote secrets?" — say Yes.

Terminal 2 — App:
```bash
cd qwv-root
npx serve .
```
App starts at http://localhost:8000

---

### A6 — Full test checklist

Work through these in order. Each step confirms the previous one worked.

TEST 1 — Application form + confirmation email
1. Open localhost:8000/apply
2. Fill in the form (pick language, answer all 3 MCQs, write reflection, name + email)
3. Submit
4. Success screen appears
5. Application document appears in Firebase Console > Firestore > applications
6. Confirmation email arrives — check: warm tone, Al-Ankabut 29:69 ayah, correct language

TEST 2 — Admin approval + welcome email + account creation
1. Log in as admin > localhost:8000/admin
2. Applications module > find the Test 1 application
3. Click "Approve & Create Account"
4. Credentials card appears in admin panel (name, email, password)
5. Welcome email arrives — check: "Marhaba, [Name]", credentials, login button
6. New user appears in Firebase Console > Authentication
7. New document in Firestore > users/{uid} with first_login: true
8. Application status updated to approved in Firestore

TEST 3 — First login > Welcome screen > Orientation modal
1. Open a private/incognito browser window
2. Go to localhost:8000/login
3. Log in with the credentials from the welcome email
4. Redirected to /welcome (not /dashboard)
5. Greeting shows "Marhaba, [Name]" in gold
6. Al-Ankabut 29:69 ayah appears (Arabic + translation)
7. Click "Show me the journey"
8. Orientation modal opens — 4 progress dots visible
9. Walk through all 4 steps:
   - Step 1: All 5 stage cards visible, Stage 1 highlighted
   - Step 2: Iqra spotlight with Arabic text
   - Step 3: Gem callout with sadaqah jariyah line
   - Step 4: Gate rule callout + "Enter the Dashboard" button
10. Click "Enter the Dashboard"
11. Redirected to /dashboard
12. first_login: false in Firestore > users/{uid}

TEST 4 — Returning login goes directly to dashboard
1. Log out
2. Log back in with the same student credentials
3. Redirected directly to /dashboard — /welcome not shown again

TEST 5 — Language variants (recommended)
Repeat Test 1 with language set to Hindi, then Urdu.
Check confirmation email and welcome email arrive in the correct language.
Urdu: check that the welcome screen renders RTL.

---

### A7 — Check browser console

At each step keep the browser console open (F12 > Console).
No red errors should appear. Note any warnings but do not block on them.

---

### A8 — Revert WORKER_URL before deploying

Before production deploy, change WORKER_URL back in both files.
You will fill in the real URL after Step B3.

js/pages/apply.js:
```javascript
const WORKER_URL = 'https://qwv-worker.YOUR-SUBDOMAIN.workers.dev';
```

js/pages/admin.js:
```javascript
const WORKER_URL = 'https://qwv-worker.YOUR-SUBDOMAIN.workers.dev';
```

---

## PART B — PRODUCTION DEPLOYMENT
## Only do this after all local tests pass.

---

### B1 — Set production secrets via Wrangler

Run from inside qwv-worker/. Each command prompts you to paste the value.

```bash
cd qwv-worker
wrangler secret put RESEND_API_KEY
wrangler secret put FIREBASE_API_KEY
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

For FIREBASE_SERVICE_ACCOUNT_JSON: paste the entire JSON on one line.

---

### B2 — Update sender email for production

In qwv-worker/index.js, update the from address to your verified domain:

```javascript
from: "Qur'an World View <noreply@quranworldview.pages.dev>",
```

To verify your domain with Resend:
1. resend.com > Domains > Add Domain
2. Enter your domain
3. Follow the DNS TXT record steps (usually takes a few minutes)

---

### B3 — Deploy the Worker

```bash
cd qwv-worker
wrangler deploy
```

Output will show:
  Successfully deployed qwv-worker
  URL: https://qwv-worker.YOUR-SUBDOMAIN.workers.dev

Copy that URL. It never changes unless you rename the Worker.

---

### B4 — Update WORKER_URL with real URL

In both files, replace the placeholder with your real Worker URL:

js/pages/apply.js and js/pages/admin.js:
```javascript
const WORKER_URL = 'https://qwv-worker.YOUR-SUBDOMAIN.workers.dev';
```

---

### B5 — Deploy qwv-root to GitHub > Cloudflare Pages

```bash
git checkout dev
git add .
git commit -m "feat: onboarding flow — Worker, welcome screen, orientation modal"
git push origin dev

git checkout main
git merge dev
git push origin main
```

Cloudflare Pages detects the push and auto-deploys within ~60 seconds.

---

### B6 — Smoke test on production

Run through Tests 1-4 from the checklist (A6) on the live site.
Use a real email address you control for the application test.

---

## PART C — VERSION CONTROL
## How QWV manages its codebase safely.

---

### C1 — Two repositories, two projects

| Repo | Contains | Deployed to |
|------|----------|-------------|
| quranworldview | qwv-root/ the app | Cloudflare Pages (auto-deploy on push to main) |
| qwv-worker | qwv-worker/ the Worker | Cloudflare Workers (manual: wrangler deploy) |

Keep them separate. Never put Worker code inside the app repo.

---

### C2 — The .gitignore rules

Both repos must have these in .gitignore:

```
.dev.vars
*.env
.env.local
*service-account*.json
*serviceAccount*.json
.wrangler/
.DS_Store
```

---

### C3 — Branching strategy

Two branches. No more complexity than this.

```
main   production. What is live on quranworldview.pages.dev.
       Every push here auto-deploys. Never push broken code here.

dev    work in progress. Test locally from here.
       Merge to main only when tests pass.
```

Day-to-day workflow:
```bash
# Start work
git checkout dev
git pull origin dev

# Build, test locally (npx serve)
# When all tests pass:
git add .
git commit -m "feat: what you built"
git push origin dev

# When ready to go live:
git checkout main
git merge dev
git push origin main
# Cloudflare Pages auto-deploys
```

---

### C4 — Commit message format

```
feat:   what you added
fix:    what you fixed
update: what you changed
remove: what you deleted
docs:   documentation only

Examples:
feat: welcome screen and orientation modal
fix: Urdu RTL layout on welcome screen
update: WORKER_URL to production endpoint
docs: updated DEPLOY.md with local testing guide
```

---

### C5 — When to deploy the Worker vs the app

| Change made | What to deploy |
|-------------|---------------|
| Email template wording | Worker only (wrangler deploy) |
| WORKER_URL update | App only (git push) |
| New Worker endpoint | Worker + App |
| UI changes — CSS, JS, HTML | App only (git push) |
| New secrets | wrangler secret put only |

The Worker and the app are independent. Deploying one does not affect the other.

---

### C6 — Rolling back the Worker

Wrangler keeps a history of Worker deployments. To roll back:

```bash
wrangler rollback
```

This is rare — the Worker is stable. But good to know.

---

### C7 — Never store these in git

| Secret | Where it lives |
|--------|---------------|
| Resend API key | Wrangler secret (cloud) + .dev.vars (local, gitignored) |
| Firebase API key | Same |
| Firebase Service Account JSON | Same |
| Any password or token | Same |

If you accidentally commit a secret:
1. Immediately rotate the key (Resend: delete + recreate, Firebase: regenerate)
2. Run: git filter-branch or use BFG Repo Cleaner to remove from history
3. Force push: git push --force
4. Update in Wrangler: wrangler secret put KEY_NAME

---

## TROUBLESHOOTING

"Invalid or expired admin token"
> Check Firestore > users/{your-uid} > member_tier must be 'admin'

"Failed to create auth account: EMAIL_EXISTS"
> Account already exists in Firebase Auth for that email

"Resend error: 403"
> Domain not verified. Use onboarding@resend.dev for testing.

CORS errors in browser console
> You are on a port not in ALLOWED_ORIGINS in Worker index.js.
> Add your port and restart wrangler dev.

Worker not responding locally
> Check Terminal 1. wrangler dev may have crashed. Restart it.

first_login still true after completing modal
> Check browser console for Firestore write errors.
> Usually a Firestore security rules issue — rules are in test mode.

Welcome screen in wrong language
> Check Firestore > users/{uid} > language field.
> Should be set by the Worker on account creation.

---

*wa ma tawfiqi illa billah*
*And my success is only through Allah.*

Quran World View - quranworldview.pages.dev
