/**
 * QUR'AN WORLD VIEW — admin.js
 * ─────────────────────────────────────────────────────────────
 * Admin Panel — 8 modules, single-file SPA within /admin.
 *
 * Modules:
 *   1. Overview        — stats dashboard
 *   2. Blog            — Quill rich text editor
 *   3. Ayah of the Day — Firestore config update
 *   4. Students        — list, detail, tier editing
 *   5. Gate Approvals  — pending queue
 *   6. Reflections     — moderation queue
 *   7. Sabiqun         — form responses + active members
 *   8. Founder Insights — private posts
 *
 * Auth: adminGuard() in app.js guarantees admin-only reach.
 *       Every module re-verifies member_tier on render.
 *
 * RULES (from Admin Architecture Document):
 *   - Always verify member_tier === 'admin' on every module render
 *   - Blog: always write both body (Quill delta) and body_html
 *   - All user writes include updated_by + updated_at
 *   - Ahad Content Manager: does NOT exist yet
 *   - Pagination mandatory for Student List
 * ─────────────────────────────────────────────────────────────
 */

import { getCurrentUser, logout }   from '../core/auth.js';
import { db, COLLECTIONS }         from '../core/firebase.js';
import { t, getLang }              from '../core/i18n.js';

const BASE       = window.QWV_BASE || '';
const WORKER_URL = 'https://qwv-worker.YOUR-SUBDOMAIN.workers.dev'; // ← update after wrangler deploy

// ── Active module state ───────────────────────────────────────
let _activeModule = 'overview';
let _quillInstance = null;

// ── Entry point ───────────────────────────────────────────────
export default async function render(container) {
  const { profile } = getCurrentUser();

  // Double-check admin status
  if (profile?.member_tier !== 'admin') {
    window.history.replaceState(null, '', BASE + '/dashboard');
    window.dispatchEvent(new CustomEvent('qwv:navigate', { detail: { path: '/dashboard' } }));
    return;
  }

  container.innerHTML = buildAdminShell();
  wireAdminShell(container, profile);

  // Load overview by default
  loadModule(container, 'overview', profile);
}

// ── Shell ─────────────────────────────────────────────────────
function buildAdminShell() {
  return `
    <div class="admin-page">

      <!-- Sidebar -->
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="admin-sidebar-header">
          <a href="${BASE}/" class="admin-logo">
            <img src="${BASE}/icons/logo.png" alt="" width="28" height="28" />
            <div>
              <p class="admin-logo-title">Qur'an World View</p>
              <span class="badge badge-crimson" style="font-size:10px;">ADMIN</span>
            </div>
          </a>
          <button class="admin-sidebar-close" id="admin-sidebar-close" aria-label="Close menu">✕</button>
        </div>

        <nav class="admin-nav" id="admin-nav">
          ${_buildNavItems()}
        </nav>

        <div class="admin-sidebar-footer">
          <div class="admin-user-info" id="admin-user-info">
            <p class="admin-user-name">Loading…</p>
          </div>
          <button class="admin-logout-btn" id="admin-logout-btn">Sign Out</button>
        </div>
      </aside>

      <!-- Mobile overlay -->
      <div class="admin-sidebar-overlay" id="admin-sidebar-overlay"></div>

      <!-- Main -->
      <div class="admin-main-wrap">
        <!-- Top bar (mobile) -->
        <header class="admin-topbar">
          <button class="admin-hamburger" id="admin-hamburger" aria-label="Open menu">
            <span></span><span></span><span></span>
          </button>
          <p class="admin-topbar-title" id="admin-topbar-title">Overview</p>
          <a href="${BASE}/" class="admin-topbar-home" title="View site">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </a>
        </header>

        <!-- Module content -->
        <main class="admin-main" id="admin-main">
          <div class="admin-loading">
            <div class="spinner"></div>
          </div>
        </main>
      </div>

    </div>
  `;
}

function _buildNavItems() {
  const items = [
    { id: 'overview',    label: 'Overview',         icon: '◈', badge: null },
    { id: 'applications', label: 'Applications',      icon: '✦', badge: 'applications' },
    { id: 'blog',        label: 'Blog',              icon: '✍', badge: null },
    { id: 'ayah',        label: 'Ayah of the Day',  icon: '☽', badge: null },
    { id: 'students',    label: 'Students',          icon: '◎', badge: null },
    { id: 'gates',       label: 'Gate Approvals',    icon: '⊙', badge: 'gates' },
    { id: 'reflections', label: 'Reflections',       icon: '◇', badge: 'reflections' },
    { id: 'sabiqun',     label: 'Sabiqun',           icon: '★', badge: null },
    { id: 'insights',    label: 'Founder Insights',  icon: '◈', badge: null },
  ];

  return items.map(item => `
    <button class="admin-nav-item" data-module="${item.id}" id="nav-${item.id}">
      <span class="admin-nav-icon" aria-hidden="true">${item.icon}</span>
      <span class="admin-nav-label">${item.label}</span>
      ${item.badge ? `<span class="admin-nav-badge hidden" id="badge-${item.badge}">0</span>` : ''}
    </button>
  `).join('');
}

// ── Shell wiring ──────────────────────────────────────────────
function wireAdminShell(container, profile) {
  const sidebar        = container.querySelector('#admin-sidebar');
  const overlay        = container.querySelector('#admin-sidebar-overlay');
  const hamburger      = container.querySelector('#admin-hamburger');
  const sidebarClose   = container.querySelector('#admin-sidebar-close');
  const logoutBtn      = container.querySelector('#admin-logout-btn');
  const userInfo       = container.querySelector('#admin-user-info');

  // User info
  if (userInfo) {
    userInfo.innerHTML = `
      <p class="admin-user-name">${profile?.name || 'Admin'}</p>
      <p class="admin-user-email">${profile?.contact || ''}</p>
    `;
  }

  // Sidebar toggle
  const openSidebar = () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  const closeSidebar = () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
  };

  hamburger?.addEventListener('click', openSidebar);
  sidebarClose?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // Nav item clicks
  container.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const mod = btn.dataset.module;
      loadModule(container, mod, profile);
      closeSidebar();
    });
  });

  // Logout
  logoutBtn?.addEventListener('click', () => logout());

  // Load pending badges
  loadBadges(container);
}

function setActiveNav(container, moduleId) {
  container.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.module === moduleId);
  });
  const labels = {
    overview: 'Overview', blog: 'Blog', ayah: 'Ayah of the Day',
    students: 'Students', gates: 'Gate Approvals',
    reflections: 'Reflections', sabiqun: 'Sabiqun', insights: 'Founder Insights',
  };
  const topbarTitle = container.querySelector('#admin-topbar-title');
  if (topbarTitle) topbarTitle.textContent = labels[moduleId] || moduleId;
}

async function loadBadges(container) {
  try {
    // Gate approvals count
    const gatesSnap = await db.collection(COLLECTIONS.USERS)
      .where('gate_status.alif', '==', 'pending_approval').get();
    const gatesSnap2 = await db.collection(COLLECTIONS.USERS)
      .where('gate_status.aamaal', '==', 'pending_approval').get();
    const gatesSnap3 = await db.collection(COLLECTIONS.USERS)
      .where('gate_status.miftah', '==', 'pending_approval').get();
    const gateCount = gatesSnap.size + gatesSnap2.size + gatesSnap3.size;

    // Reflections pending count
    const refSnap = await db.collection(COLLECTIONS.USER_REFLECTIONS)
      .where('status', '==', 'pending').get();

    _setBadge(container, 'gates', gateCount);
    _setBadge(container, 'reflections', refSnap.size);

    // Applications pending count
    const appSnap = await db.collection('applications').where('status','==','pending').get();
    _setBadge(container, 'applications', appSnap.size);
  } catch (e) {
    console.warn('[QWV admin] Badge load failed:', e);
  }
}

function _setBadge(container, id, count) {
  const el = container.querySelector(`#badge-${id}`);
  if (!el) return;
  if (count > 0) {
    el.textContent = count;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// ── Module loader ─────────────────────────────────────────────
async function loadModule(container, moduleId, profile) {
  _activeModule = moduleId;
  setActiveNav(container, moduleId);

  const main = container.querySelector('#admin-main');
  if (!main) return;

  main.innerHTML = `<div class="admin-loading"><div class="spinner spinner-lg"></div></div>`;

  // Re-verify admin on every module load
  if (profile?.member_tier !== 'admin') {
    main.innerHTML = `<div class="admin-access-denied">
      <h2>Access Denied</h2><p>You don't have permission to view this.</p>
    </div>`;
    return;
  }

  switch (moduleId) {
    case 'overview':    await renderOverview(main, profile);    break;
    case 'applications': await renderApplications(main, profile);  break;
    case 'blog':        await renderBlog(main, profile);        break;
    case 'ayah':        await renderAyah(main, profile);        break;
    case 'students':    await renderStudents(main, profile);    break;
    case 'gates':       await renderGates(main, profile);       break;
    case 'reflections': await renderReflections(main, profile); break;
    case 'sabiqun':     await renderSabiqun(main, profile);     break;
    case 'insights':    await renderInsights(main, profile);    break;
    default:            await renderOverview(main, profile);
  }
}


// ═══════════════════════════════════════════════════════════════
// MODULE 1 — OVERVIEW
// ═══════════════════════════════════════════════════════════════

async function renderOverview(el, profile) {
  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Overview</h1>
      <p class="admin-module-sub">As-salamu alaykum, ${profile?.name || 'Admin'}.</p>
    </div>
    <div class="admin-stats-grid" id="overview-stats">
      ${[1,2,3,4,5,6].map(() => `<div class="admin-stat-card skeleton" style="height:90px;"></div>`).join('')}
    </div>
    <div class="admin-overview-alerts" id="overview-alerts"></div>
  </div>`;

  try {
    const [usersSnap, blogSnap, refSnap, sabiqunSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).get(),
      db.collection(COLLECTIONS.BLOG).get(),
      db.collection(COLLECTIONS.USER_REFLECTIONS).where('status','==','pending').get(),
      db.collection(COLLECTIONS.USERS).where('member_tier','==','sabiqun').get(),
    ]);

    const users    = usersSnap.docs.map(d => d.data());
    const students = users.filter(u => u.member_tier === 'student').length;
    const sabiqun  = sabiqunSnap.size;
    const core     = users.filter(u => u.member_tier === 'core').length;
    const blog     = blogSnap.docs.map(d => d.data());
    const published = blog.filter(b => b.status === 'published').length;
    const drafts    = blog.filter(b => b.status === 'draft').length;

    const statsEl = el.querySelector('#overview-stats');
    if (statsEl) statsEl.innerHTML = `
      ${_statCard('Total Students', users.length, '◎')}
      ${_statCard('Sabiqun', sabiqun, '★', 'gold')}
      ${_statCard('Core Members', core, '👑', 'gold')}
      ${_statCard('Pending Reflections', refSnap.size, '◇', refSnap.size > 0 ? 'crimson' : '')}
      ${_statCard('Blog Posts', published + ' published', '✍')}
      ${_statCard('Drafts', drafts, '○')}
    `;

    // Alerts
    const alertsEl = el.querySelector('#overview-alerts');
    if (alertsEl && refSnap.size > 0) {
      alertsEl.innerHTML = `
        <div class="admin-alert admin-alert-gold">
          <strong>${refSnap.size} reflection${refSnap.size > 1 ? 's' : ''} awaiting review.</strong>
          <button class="btn btn-sm btn-outline" onclick="window._adminNav('reflections')">Review now</button>
        </div>`;
    }
  } catch (e) {
    console.error('[QWV admin] Overview load error:', e);
  }

  // Expose nav helper for inline buttons
  window._adminNav = (mod) => {
    const container = document.getElementById('app');
    const p = getCurrentUser().profile;
    loadModule(container, mod, p);
  };
}

function _statCard(label, value, icon, accent = '') {
  return `
    <div class="admin-stat-card ${accent ? 'admin-stat-' + accent : ''}">
      <span class="admin-stat-icon" aria-hidden="true">${icon}</span>
      <p class="admin-stat-value">${value}</p>
      <p class="admin-stat-label">${label}</p>
    </div>`;
}


// ═══════════════════════════════════════════════════════════════
// MODULE 2 — BLOG EDITOR
// ═══════════════════════════════════════════════════════════════

async function renderBlog(el, profile) {
  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Blog</h1>
      <button class="btn btn-primary btn-sm" id="new-post-btn">+ New Post</button>
    </div>
    <div id="blog-list-view">
      <div class="admin-loading"><div class="spinner"></div></div>
    </div>
    <div id="blog-editor-view" class="hidden"></div>
  </div>`;

  el.querySelector('#new-post-btn')?.addEventListener('click', () => {
    showBlogEditor(el, profile, null);
  });

  await loadBlogList(el, profile);
}

async function loadBlogList(el, profile) {
  const listEl = el.querySelector('#blog-list-view');
  if (!listEl) return;

  try {
    const snap = await db.collection(COLLECTIONS.BLOG)
      .orderBy('created_at', 'desc').limit(50).get();

    if (snap.empty) {
      listEl.innerHTML = `<div class="admin-empty">No posts yet. Create your first post.</div>`;
      return;
    }

    listEl.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Title</th><th>Status</th><th>Author</th><th>Date</th><th></th>
          </tr></thead>
          <tbody>
            ${snap.docs.map(doc => {
              const p = doc.data();
              const title = p.title?.en || p.title?.hi || p.title?.ur || '(Untitled)';
              const date  = p.published_at?.toDate?.()?.toLocaleDateString() || p.created_at?.toDate?.()?.toLocaleDateString() || '—';
              return `<tr>
                <td class="admin-table-title">${title}</td>
                <td><span class="badge ${p.status==='published'?'badge-success':'badge-muted'}">${p.status}</span></td>
                <td>${p.author || '—'}</td>
                <td>${date}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" data-edit="${doc.id}">Edit</button>
                  <button class="btn btn-ghost btn-sm" data-delete="${doc.id}" style="color:var(--error)">Delete</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    // Wire edit/delete buttons
    listEl.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const doc = snap.docs.find(d => d.id === btn.dataset.edit);
        if (doc) showBlogEditor(el, profile, { id: doc.id, ...doc.data() });
      });
    });

    listEl.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this post? This cannot be undone.')) return;
        await db.collection(COLLECTIONS.BLOG).doc(btn.dataset.delete).delete();
        loadBlogList(el, profile);
      });
    });

  } catch (e) {
    listEl.innerHTML = `<div class="admin-error">Failed to load posts: ${e.message}</div>`;
  }
}

async function showBlogEditor(el, profile, post) {
  const listEl   = el.querySelector('#blog-list-view');
  const editorEl = el.querySelector('#blog-editor-view');
  if (!listEl || !editorEl) return;

  listEl.classList.add('hidden');
  editorEl.classList.remove('hidden');

  const isNew  = !post;
  const postId = post?.id || db.collection(COLLECTIONS.BLOG).doc().id;

  editorEl.innerHTML = `
    <div class="admin-blog-editor">
      <div class="admin-editor-topbar">
        <button class="btn btn-ghost btn-sm" id="back-to-list">← Back to list</button>
        <div class="admin-editor-actions">
          <span class="admin-save-status" id="save-status"></span>
          <select id="post-status" class="admin-select">
            <option value="draft"     ${post?.status==='draft'||isNew?'selected':''}>Draft</option>
            <option value="published" ${post?.status==='published'?'selected':''}>Published</option>
          </select>
          <button class="btn btn-primary btn-sm" id="save-post-btn">Save</button>
        </div>
      </div>

      <!-- Title — trilingual tabs -->
      <div class="admin-field">
        <label class="form-label">Title</label>
        <div class="admin-lang-tabs">
          ${['en','hi','ur'].map(lang => `
            <button class="admin-lang-tab ${lang==='en'?'active':''}" data-lang="${lang}">
              ${lang.toUpperCase()}
            </button>`).join('')}
        </div>
        <input type="text" id="title-en" class="admin-title-input" placeholder="Title in English"
          value="${post?.title?.en || ''}" />
        <input type="text" id="title-hi" class="admin-title-input hidden" placeholder="हिन्दी में शीर्षक"
          value="${post?.title?.hi || ''}" />
        <input type="text" id="title-ur" class="admin-title-input hidden" dir="rtl" placeholder="اردو میں عنوان"
          value="${post?.title?.ur || ''}" />
      </div>

      <!-- Author + Tags -->
      <div class="admin-field-row">
        <div class="admin-field">
          <label class="form-label">Author</label>
          <input type="text" id="post-author" value="${post?.author || profile?.name || ''}" />
        </div>
        <div class="admin-field">
          <label class="form-label">Tags (comma separated)</label>
          <input type="text" id="post-tags" value="${(post?.tags||[]).join(', ')}" placeholder="quran, tafsir, reflection" />
        </div>
      </div>

      <!-- Cover image -->
      <div class="admin-field">
        <label class="form-label">Cover Image</label>
        <div class="admin-cover-wrap">
          ${post?.cover_image_url ? `<img src="${post.cover_image_url}" class="admin-cover-preview" id="cover-preview" alt="Cover" />` : `<div class="admin-cover-placeholder" id="cover-preview">No cover image</div>`}
          <label class="btn btn-outline btn-sm admin-cover-upload-btn">
            Upload Image
            <input type="file" id="cover-image-input" accept="image/*" style="display:none;" />
          </label>
        </div>
        <input type="hidden" id="cover-image-url" value="${post?.cover_image_url || ''}" />
      </div>

      <!-- Rich text editor -->
      <div class="admin-field">
        <label class="form-label">Body</label>
        <div id="quill-toolbar">
          <button class="ql-bold"></button>
          <button class="ql-italic"></button>
          <button class="ql-underline"></button>
          <select class="ql-header">
            <option selected></option>
            <option value="2">H2</option>
            <option value="3">H3</option>
          </select>
          <button class="ql-blockquote"></button>
          <button class="ql-list" value="ordered"></button>
          <button class="ql-list" value="bullet"></button>
          <button class="ql-link"></button>
          <button class="ql-image"></button>
          <button class="ql-clean"></button>
          <button id="arabic-btn" title="Insert Arabic text" style="font-family:Amiri,serif;font-size:16px;">ع</button>
        </div>
        <div id="quill-editor" style="min-height:320px;"></div>
      </div>

      <div id="editor-error" class="login-error hidden"></div>
    </div>
  `;

  // Back button
  editorEl.querySelector('#back-to-list')?.addEventListener('click', () => {
    editorEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    _quillInstance = null;
  });

  // Title lang tabs
  editorEl.querySelectorAll('.admin-lang-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      editorEl.querySelectorAll('.admin-lang-tab').forEach(t => t.classList.remove('active'));
      editorEl.querySelectorAll('.admin-title-input').forEach(i => i.classList.add('hidden'));
      tab.classList.add('active');
      editorEl.querySelector(`#title-${tab.dataset.lang}`)?.classList.remove('hidden');
    });
  });

  // Load Quill
  await loadQuill();
  _quillInstance = new Quill('#quill-editor', {
    theme: 'snow',
    modules: { toolbar: '#quill-toolbar' },
    placeholder: 'Write your reflection here…',
  });

  // Restore existing content
  if (post?.body) {
    try { _quillInstance.setContents(JSON.parse(post.body)); }
    catch { _quillInstance.clipboard.dangerouslyPasteHTML(post.body_html || ''); }
  }

  // Arabic button
  editorEl.querySelector('#arabic-btn')?.addEventListener('click', () => {
    const range = _quillInstance.getSelection(true);
    const selected = _quillInstance.getText(range.index, range.length);
    if (selected) {
      _quillInstance.deleteText(range.index, range.length);
      _quillInstance.insertText(range.index, selected, {
        direction: 'rtl',
        font: 'amiri',
        color: 'var(--gold)',
      });
    } else {
      const arabic = prompt('Enter Arabic text:');
      if (arabic) _quillInstance.insertText(range.index, arabic, { direction: 'rtl', font: 'amiri' });
    }
  });

  // Cover image upload
  editorEl.querySelector('#cover-image-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = editorEl.querySelector('#save-status');
    if (statusEl) statusEl.textContent = 'Uploading image…';
    try {
      const ref = firebase.storage().ref(`blog-images/${postId}/cover-${Date.now()}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();
      editorEl.querySelector('#cover-image-url').value = url;
      const preview = editorEl.querySelector('#cover-preview');
      if (preview) {
        preview.outerHTML = `<img src="${url}" class="admin-cover-preview" id="cover-preview" alt="Cover" />`;
      }
      if (statusEl) statusEl.textContent = 'Image uploaded.';
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Image upload failed.';
    }
  });

  // Save
  editorEl.querySelector('#save-post-btn')?.addEventListener('click', async () => {
    await saveBlogPost(editorEl, postId, profile, isNew);
    await loadBlogList(el, profile);
  });
}

async function saveBlogPost(editorEl, postId, profile, isNew) {
  const saveStatus = editorEl.querySelector('#save-status');
  const errorEl    = editorEl.querySelector('#editor-error');
  if (saveStatus) saveStatus.textContent = 'Saving…';

  const titleEn = editorEl.querySelector('#title-en')?.value.trim();
  const titleHi = editorEl.querySelector('#title-hi')?.value.trim();
  const titleUr = editorEl.querySelector('#title-ur')?.value.trim();
  const author  = editorEl.querySelector('#post-author')?.value.trim();
  const tagsRaw = editorEl.querySelector('#post-tags')?.value;
  const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const status  = editorEl.querySelector('#post-status')?.value || 'draft';
  const coverUrl = editorEl.querySelector('#cover-image-url')?.value || '';

  if (!titleEn) {
    if (errorEl) { errorEl.textContent = 'English title is required.'; errorEl.classList.remove('hidden'); }
    if (saveStatus) saveStatus.textContent = '';
    return;
  }

  if (!_quillInstance) return;
  const delta    = JSON.stringify(_quillInstance.getContents());
  const bodyHtml = _quillInstance.root.innerHTML;

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const data = {
      title:           { en: titleEn, hi: titleHi, ur: titleUr },
      body:            delta,
      body_html:       bodyHtml,
      author:          author || profile?.name || 'Admin',
      status,
      tags,
      cover_image_url: coverUrl,
      updated_at:      now,
      updated_by:      profile?.uid || '',
      published_at:    status === 'published' ? now : null,
    };

    if (isNew) data.created_at = now;

    await db.collection(COLLECTIONS.BLOG).doc(postId).set(data, { merge: true });
    if (errorEl) errorEl.classList.add('hidden');
    if (saveStatus) saveStatus.textContent = `Saved ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    if (errorEl) { errorEl.textContent = 'Save failed: ' + e.message; errorEl.classList.remove('hidden'); }
    if (saveStatus) saveStatus.textContent = 'Save failed.';
  }
}

async function loadQuill() {
  if (window.Quill) return;
  await Promise.all([
    _loadCSS('https://cdn.quilljs.com/1.3.6/quill.snow.css'),
    _loadScript('https://cdn.quilljs.com/1.3.6/quill.min.js'),
  ]);
}


// ═══════════════════════════════════════════════════════════════
// MODULE 3 — AYAH OF THE DAY
// ═══════════════════════════════════════════════════════════════

async function renderAyah(el, profile) {
  let current = {};
  try {
    const doc = await db.collection('config').doc('ayah_of_day').get();
    if (doc.exists) current = doc.data();
  } catch (e) {}

  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Ayah of the Day</h1>
    </div>

    <div class="admin-ayah-wrap">
      <div class="admin-ayah-form">

        <div class="admin-field-row">
          <div class="admin-field">
            <label class="form-label">Surah Number (1–114)</label>
            <input type="number" id="ayah-surah" min="1" max="114" value="${current.surah||2}" />
          </div>
          <div class="admin-field">
            <label class="form-label">Ayah Number</label>
            <input type="number" id="ayah-ayah" min="1" value="${current.ayah||255}" />
          </div>
          <div class="admin-field" style="align-self:flex-end;">
            <button class="btn btn-outline btn-sm" id="fetch-ayah-btn">Fetch from API</button>
          </div>
        </div>

        <div class="admin-field">
          <label class="form-label">Arabic Text</label>
          <textarea id="ayah-arabic" rows="3" dir="rtl" style="font-family:var(--font-arabic);font-size:1.4rem;line-height:1.8;"
            placeholder="Arabic text">${current.arabic||''}</textarea>
        </div>

        <div class="admin-field">
          <label class="form-label">Surah Name — English</label>
          <input type="text" id="ayah-surah-en" value="${current.surah_name?.en||''}" />
        </div>
        <div class="admin-field">
          <label class="form-label">Surah Name — Hindi</label>
          <input type="text" id="ayah-surah-hi" value="${current.surah_name?.hi||''}" />
        </div>
        <div class="admin-field">
          <label class="form-label">Surah Name — Urdu</label>
          <input type="text" id="ayah-surah-ur" dir="rtl" value="${current.surah_name?.ur||''}" />
        </div>

        <div class="admin-field">
          <label class="form-label">Translation — English</label>
          <textarea id="ayah-trans-en" rows="3">${current.translation?.en||''}</textarea>
        </div>
        <div class="admin-field">
          <label class="form-label">Translation — Hindi</label>
          <textarea id="ayah-trans-hi" rows="3">${current.translation?.hi||''}</textarea>
        </div>
        <div class="admin-field">
          <label class="form-label">Translation — Urdu</label>
          <textarea id="ayah-trans-ur" rows="3" dir="rtl">${current.translation?.ur||''}</textarea>
        </div>

        <div class="admin-field-row">
          <div class="admin-field">
            <label class="form-label">Social URL</label>
            <input type="url" id="ayah-social-url" value="${current.social_url||''}" placeholder="https://instagram.com/p/..." />
          </div>
          <div class="admin-field">
            <label class="form-label">Platform</label>
            <select id="ayah-platform" class="admin-select">
              <option value="instagram" ${current.platform==='instagram'||!current.platform?'selected':''}>Instagram</option>
              <option value="youtube"   ${current.platform==='youtube'?'selected':''}>YouTube</option>
            </select>
          </div>
        </div>

        <div id="ayah-status" class="admin-status-msg"></div>
        <button class="btn btn-primary" id="save-ayah-btn">Save Ayah of the Day</button>
      </div>

      <!-- Live preview -->
      <div class="admin-ayah-preview">
        <p class="section-label" style="margin-bottom:var(--space-4);">Preview</p>
        <div class="ayah-card" id="ayah-preview-card">
          <div class="ayah-arabic" id="preview-arabic">
            <p style="font-family:var(--font-arabic);font-size:var(--arabic-xl);direction:rtl;text-align:center;color:var(--off-white);line-height:1.85;">
              ${current.arabic||'Arabic text will appear here'}
            </p>
          </div>
          <p class="ayah-translation" id="preview-trans">${current.translation?.en||'Translation will appear here'}</p>
          <p class="ayah-reference" id="preview-ref">${current.surah_name?.en||'Surah'} · ${current.surah||''}:${current.ayah||''}</p>
        </div>
      </div>
    </div>
  </div>`;

  // Live preview update
  const updatePreview = () => {
    el.querySelector('#preview-arabic').innerHTML = `
      <p style="font-family:var(--font-arabic);font-size:var(--arabic-xl);direction:rtl;text-align:center;color:var(--off-white);line-height:1.85;">
        ${el.querySelector('#ayah-arabic')?.value || ''}
      </p>`;
    el.querySelector('#preview-trans').textContent = el.querySelector('#ayah-trans-en')?.value || '';
    const s = el.querySelector('#ayah-surah')?.value;
    const a = el.querySelector('#ayah-ayah')?.value;
    const n = el.querySelector('#ayah-surah-en')?.value;
    el.querySelector('#preview-ref').textContent = `${n||'Surah'} · ${s||''}:${a||''}`;
  };

  ['#ayah-arabic','#ayah-trans-en','#ayah-surah-en','#ayah-surah','#ayah-ayah'].forEach(sel => {
    el.querySelector(sel)?.addEventListener('input', updatePreview);
  });

  // Fetch from API
  el.querySelector('#fetch-ayah-btn')?.addEventListener('click', async () => {
    const surah = el.querySelector('#ayah-surah')?.value;
    const ayah  = el.querySelector('#ayah-ayah')?.value;
    if (!surah || !ayah) return;
    const statusEl = el.querySelector('#ayah-status');
    if (statusEl) statusEl.textContent = 'Fetching…';
    try {
      const [arabicRes, translationRes] = await Promise.all([
        fetch(`https://api.qurancdn.com/api/qdc/verses/by_key/${surah}:${ayah}?words=false&translations=131,158,180&fields=text_uthmani`),
        fetch(`https://api.qurancdn.com/api/qdc/chapters/${surah}`),
      ]);
      const arabicData = await arabicRes.json();
      const chapterData = await translationRes.json();

      const verse = arabicData?.verse;
      if (verse?.text_uthmani) {
        el.querySelector('#ayah-arabic').value = verse.text_uthmani;
      }

      const translations = verse?.translations || [];
      const en = translations.find(t => t.resource_id === 131)?.text?.replace(/<[^>]*>/g,'') || '';
      const ur = translations.find(t => t.resource_id === 158)?.text?.replace(/<[^>]*>/g,'') || '';
      const hi = translations.find(t => t.resource_id === 180)?.text?.replace(/<[^>]*>/g,'') || '';
      if (en) el.querySelector('#ayah-trans-en').value = en;
      if (ur) el.querySelector('#ayah-trans-ur').value = ur;
      if (hi) el.querySelector('#ayah-trans-hi').value = hi;

      const chapter = chapterData?.chapter;
      if (chapter?.name_simple) el.querySelector('#ayah-surah-en').value = chapter.name_simple;

      updatePreview();
      if (statusEl) statusEl.textContent = 'Fetched. Review and save.';
    } catch (e) {
      if (statusEl) statusEl.textContent = 'API fetch failed. Enter manually.';
    }
  });

  // Save
  el.querySelector('#save-ayah-btn')?.addEventListener('click', async () => {
    const statusEl = el.querySelector('#ayah-status');
    if (statusEl) statusEl.textContent = 'Saving…';
    try {
      await db.collection('config').doc('ayah_of_day').set({
        surah:       parseInt(el.querySelector('#ayah-surah')?.value),
        ayah:        parseInt(el.querySelector('#ayah-ayah')?.value),
        arabic:      el.querySelector('#ayah-arabic')?.value.trim(),
        surah_name: {
          en: el.querySelector('#ayah-surah-en')?.value.trim(),
          hi: el.querySelector('#ayah-surah-hi')?.value.trim(),
          ur: el.querySelector('#ayah-surah-ur')?.value.trim(),
        },
        translation: {
          en: el.querySelector('#ayah-trans-en')?.value.trim(),
          hi: el.querySelector('#ayah-trans-hi')?.value.trim(),
          ur: el.querySelector('#ayah-trans-ur')?.value.trim(),
        },
        social_url:  el.querySelector('#ayah-social-url')?.value.trim(),
        platform:    el.querySelector('#ayah-platform')?.value,
        updated_at:  firebase.firestore.FieldValue.serverTimestamp(),
        updated_by:  profile?.uid || '',
      });
      if (statusEl) statusEl.textContent = `Saved — ${new Date().toLocaleTimeString()}`;
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Save failed: ' + e.message;
    }
  });
}


// ═══════════════════════════════════════════════════════════════
// MODULE 4 — STUDENTS
// ═══════════════════════════════════════════════════════════════

async function renderStudents(el, profile) {
  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Students</h1>
    </div>
    <div class="admin-filters">
      <input type="text" id="student-search" placeholder="Search by name or email…" class="admin-search-input" />
      <select id="student-tier-filter" class="admin-select">
        <option value="">All tiers</option>
        <option value="student">Student</option>
        <option value="sabiqun">Sabiqun</option>
        <option value="core">Core</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div id="students-list">
      <div class="admin-loading"><div class="spinner"></div></div>
    </div>
    <div id="student-detail-panel" class="hidden"></div>
  </div>`;

  await loadStudentList(el, profile);

  el.querySelector('#student-search')?.addEventListener('input', () => loadStudentList(el, profile));
  el.querySelector('#student-tier-filter')?.addEventListener('change', () => loadStudentList(el, profile));
}

async function loadStudentList(el, profile, cursor = null) {
  const listEl  = el.querySelector('#students-list');
  const search  = el.querySelector('#student-search')?.value.toLowerCase().trim();
  const tier    = el.querySelector('#student-tier-filter')?.value;

  listEl.innerHTML = `<div class="admin-loading"><div class="spinner"></div></div>`;

  try {
    let query = db.collection(COLLECTIONS.USERS).orderBy('joined_at', 'desc').limit(50);
    if (tier) query = query.where('member_tier', '==', tier);

    const snap = await query.get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (search) {
      docs = docs.filter(u =>
        (u.name||'').toLowerCase().includes(search) ||
        (u.contact||'').toLowerCase().includes(search)
      );
    }

    if (!docs.length) {
      listEl.innerHTML = `<div class="admin-empty">No students found.</div>`;
      return;
    }

    listEl.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Name</th><th>Email</th><th>Tier</th><th>Stage</th><th>Streak</th><th>Gems</th><th>Joined</th><th></th>
          </tr></thead>
          <tbody>
            ${docs.map(u => `<tr>
              <td>${u.name||'—'}</td>
              <td style="color:var(--text-muted);font-size:var(--text-sm);">${u.contact||'—'}</td>
              <td><span class="badge ${_tierBadge(u.member_tier)}">${u.member_tier||'student'}</span></td>
              <td>${u.stage||1}</td>
              <td>${u.streak||0} 🔥</td>
              <td>${u.total_gems||0} ✨</td>
              <td style="font-size:var(--text-xs);color:var(--text-muted);">${u.joined_at?.toDate?.()?.toLocaleDateString()||'—'}</td>
              <td><button class="btn btn-ghost btn-sm" data-uid="${u.id}">View</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    listEl.querySelectorAll('[data-uid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = docs.find(d => d.id === btn.dataset.uid);
        if (u) showStudentDetail(el, u, profile);
      });
    });

  } catch (e) {
    listEl.innerHTML = `<div class="admin-error">Failed to load students: ${e.message}</div>`;
  }
}

function showStudentDetail(el, user, adminProfile) {
  const detailEl = el.querySelector('#student-detail-panel');
  const listEl   = el.querySelector('#students-list');
  if (!detailEl) return;

  detailEl.classList.remove('hidden');
  listEl.classList.add('hidden');

  detailEl.innerHTML = `
    <div class="admin-detail-panel">
      <button class="btn btn-ghost btn-sm" id="back-to-students">← Back</button>
      <div class="admin-detail-header">
        <div>
          <h2 class="admin-detail-name">${user.name||'—'}</h2>
          <p style="color:var(--text-muted);">${user.contact||'—'}</p>
        </div>
        <span class="badge ${_tierBadge(user.member_tier)}">${user.member_tier||'student'}</span>
      </div>

      <div class="admin-detail-grid">
        <div class="admin-detail-item"><p class="admin-detail-label">Stage</p><p>${user.stage||1}</p></div>
        <div class="admin-detail-item"><p class="admin-detail-label">Streak</p><p>${user.streak||0} days</p></div>
        <div class="admin-detail-item"><p class="admin-detail-label">Gems</p><p>${user.total_gems||0}</p></div>
        <div class="admin-detail-item"><p class="admin-detail-label">Language</p><p>${user.language||'hi'}</p></div>
        <div class="admin-detail-item"><p class="admin-detail-label">Source</p><p>${user.source||'—'}</p></div>
        <div class="admin-detail-item"><p class="admin-detail-label">Joined</p><p>${user.joined_at?.toDate?.()?.toLocaleDateString()||'—'}</p></div>
      </div>

      <!-- Edit tier -->
      <div class="admin-field" style="max-width:300px;margin-top:var(--space-6);">
        <label class="form-label">Change Member Tier</label>
        <div style="display:flex;gap:var(--space-3);">
          <select id="edit-tier-select" class="admin-select">
            ${['student','sabiqun','core','admin'].map(t =>
              `<option value="${t}" ${user.member_tier===t?'selected':''}>${t}</option>`
            ).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="save-tier-btn">Save</button>
        </div>
        <p id="tier-save-status" class="admin-status-msg"></p>
      </div>

      <!-- Gate status -->
      <div style="margin-top:var(--space-6);">
        <p class="form-label">Gate Status</p>
        <div class="admin-gate-grid">
          ${['alif','aamaal','ahad','miftah'].map(app => `
            <div class="admin-gate-item">
              <p class="admin-gate-app">${app}</p>
              <span class="badge ${user.gate_status?.[app]==='unlocked'?'badge-success':user.gate_status?.[app]==='pending_approval'?'badge-gold':'badge-muted'}">
                ${user.gate_status?.[app]||'locked'}
              </span>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;

  detailEl.querySelector('#back-to-students')?.addEventListener('click', () => {
    detailEl.classList.add('hidden');
    listEl.classList.remove('hidden');
  });

  detailEl.querySelector('#save-tier-btn')?.addEventListener('click', async () => {
    const newTier  = detailEl.querySelector('#edit-tier-select')?.value;
    const statusEl = detailEl.querySelector('#tier-save-status');
    if (statusEl) statusEl.textContent = 'Saving…';
    try {
      await db.collection(COLLECTIONS.USERS).doc(user.id).update({
        member_tier: newTier,
        is_sabiqun:  newTier === 'sabiqun',
        updated_by:  adminProfile?.uid || '',
        updated_at:  firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (statusEl) statusEl.textContent = `Saved — tier updated to ${newTier}.`;
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Save failed: ' + e.message;
    }
  });
}

function _tierBadge(tier) {
  return { sabiqun: 'badge-sabiqun', core: 'badge-gold', admin: 'badge-crimson' }[tier] || 'badge-muted';
}


// ═══════════════════════════════════════════════════════════════
// MODULE 5 — GATE APPROVALS
// ═══════════════════════════════════════════════════════════════

async function renderGates(el, profile) {
  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Gate Approvals</h1>
    </div>
    <div id="gates-list">
      <div class="admin-loading"><div class="spinner"></div></div>
    </div>
  </div>`;

  try {
    // Check all gate fields for pending
    const apps    = ['alif','aamaal','ahad','miftah'];
    const queries = apps.map(app =>
      db.collection(COLLECTIONS.USERS).where(`gate_status.${app}`, '==', 'pending_approval').get()
    );
    const results = await Promise.all(queries);
    const pending = [];
    results.forEach((snap, i) => {
      snap.docs.forEach(doc => pending.push({ uid: doc.id, app: apps[i], ...doc.data() }));
    });

    const listEl = el.querySelector('#gates-list');
    if (!pending.length) {
      listEl.innerHTML = `<div class="admin-empty">✓ No pending gate approvals.</div>`;
      return;
    }

    listEl.innerHTML = `
      <div class="admin-queue">
        ${pending.map(u => `
          <div class="admin-queue-card" id="gate-${u.uid}-${u.app}">
            <div class="admin-queue-header">
              <div>
                <p class="admin-queue-name">${u.name||'—'}</p>
                <p class="admin-queue-meta">${u.contact||''} · Stage ${u.stage||1} · ${u.streak||0} day streak</p>
              </div>
              <div class="admin-queue-stage">
                <span class="badge badge-gold">Requesting: ${u.app}</span>
              </div>
            </div>
            <div class="admin-queue-actions">
              <button class="btn btn-primary btn-sm" data-approve="${u.uid}" data-app="${u.app}">Approve</button>
              <button class="btn btn-ghost btn-sm"   data-reject="${u.uid}"  data-app="${u.app}">Reject</button>
            </div>
            <p class="admin-queue-status" id="gate-status-${u.uid}-${u.app}"></p>
          </div>
        `).join('')}
      </div>`;

    listEl.querySelectorAll('[data-approve]').forEach(btn => {
      btn.addEventListener('click', () => approveGate(listEl, btn.dataset.approve, btn.dataset.app, profile));
    });
    listEl.querySelectorAll('[data-reject]').forEach(btn => {
      btn.addEventListener('click', () => rejectGate(listEl, btn.dataset.reject, btn.dataset.app, profile));
    });

  } catch (e) {
    el.querySelector('#gates-list').innerHTML = `<div class="admin-error">Failed to load: ${e.message}</div>`;
  }
}

async function approveGate(el, uid, app, adminProfile) {
  const statusEl = el.querySelector(`#gate-status-${uid}-${app}`);
  if (statusEl) statusEl.textContent = 'Approving…';
  try {
    const update = {
      [`gate_status.${app}`]:    'unlocked',
      [`stage_unlocked.${app}`]: true,
      updated_by: adminProfile?.uid || '',
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection(COLLECTIONS.USERS).doc(uid).update(update);
    const card = el.querySelector(`#gate-${uid}-${app}`);
    if (card) {
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
    }
    if (statusEl) statusEl.textContent = '✓ Approved. Student can now access ' + app + '.';
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Failed: ' + e.message;
  }
}

async function rejectGate(el, uid, app, adminProfile) {
  if (!confirm(`Reject ${app} access for this student?`)) return;
  const statusEl = el.querySelector(`#gate-status-${uid}-${app}`);
  if (statusEl) statusEl.textContent = 'Rejecting…';
  try {
    await db.collection(COLLECTIONS.USERS).doc(uid).update({
      [`gate_status.${app}`]: 'locked',
      updated_by: adminProfile?.uid || '',
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (statusEl) statusEl.textContent = 'Rejected — gate set back to locked.';
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Failed: ' + e.message;
  }
}


// ═══════════════════════════════════════════════════════════════
// MODULE 6 — REFLECTION MODERATION
// ═══════════════════════════════════════════════════════════════

async function renderReflections(el, profile) {
  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Reflections</h1>
    </div>
    <div class="admin-filters">
      <div class="admin-tab-bar" id="ref-tab-bar">
        ${['pending','approved','rejected','all'].map(s => `
          <button class="admin-tab ${s==='pending'?'active':''}" data-status="${s}">
            ${s.charAt(0).toUpperCase()+s.slice(1)}
          </button>`).join('')}
      </div>
    </div>
    <div id="reflections-list">
      <div class="admin-loading"><div class="spinner"></div></div>
    </div>
  </div>`;

  el.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadReflectionList(el, tab.dataset.status, profile);
    });
  });

  loadReflectionList(el, 'pending', profile);
}

async function loadReflectionList(el, status, profile) {
  const listEl = el.querySelector('#reflections-list');
  listEl.innerHTML = `<div class="admin-loading"><div class="spinner"></div></div>`;

  try {
    // Query without orderBy to avoid composite index requirement.
    // Sort client-side instead.
    let query = db.collection(COLLECTIONS.USER_REFLECTIONS).limit(100);
    if (status !== 'all') query = query.where('status', '==', status);

    const snap = await query.get();
    // Sort client-side by submitted_at descending
    const docs = snap.docs.sort((a, b) => {
      const aTime = a.data().submitted_at?.toMillis?.() || 0;
      const bTime = b.data().submitted_at?.toMillis?.() || 0;
      return bTime - aTime;
    });

    if (!docs.length) {
      listEl.innerHTML = `<div class="admin-empty">No reflections found.</div>`;
      return;
    }

    listEl.innerHTML = `<div class="admin-queue">
      ${docs.map(doc => {
        const r    = doc.data();
        const date = r.submitted_at?.toDate?.()?.toLocaleDateString() || '—';
        return `
          <div class="admin-queue-card">
            <div class="admin-queue-header">
              <div>
                <p class="admin-queue-name">${r.title||'(Untitled)'}</p>
                <p class="admin-queue-meta">${r.published_as==='anonymous'?'Anonymous':r.uid} · ${date}</p>
              </div>
              <span class="badge ${r.status==='pending'?'badge-muted':r.status==='approved'?'badge-gold':'badge-crimson'}">${r.status}</span>
            </div>
            <p class="admin-queue-excerpt">${(r.body||'').substring(0,200)}${r.body?.length>200?'…':''}</p>
            ${r.status === 'pending' ? `
              <div class="admin-queue-actions">
                <button class="btn btn-primary btn-sm" data-publish="${doc.id}">Publish to Blog</button>
                <button class="btn btn-outline btn-sm"  data-library="${doc.id}">Add to Library</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--error)" data-reject-ref="${doc.id}">Reject</button>
              </div>
              <p class="admin-queue-status" id="ref-status-${doc.id}"></p>
            ` : ''}
          </div>`;
      }).join('')}
    </div>`;

    listEl.querySelectorAll('[data-publish]').forEach(btn => {
      btn.addEventListener('click', () => publishReflection(listEl, btn.dataset.publish, 'blog', profile));
    });
    listEl.querySelectorAll('[data-library]').forEach(btn => {
      btn.addEventListener('click', () => publishReflection(listEl, btn.dataset.library, 'library', profile));
    });
    listEl.querySelectorAll('[data-reject-ref]').forEach(btn => {
      btn.addEventListener('click', () => rejectReflection(listEl, btn.dataset.rejectRef, profile));
    });

  } catch (e) {
    listEl.innerHTML = `<div class="admin-error">Failed to load: ${e.message}</div>`;
  }
}

async function publishReflection(el, docId, destination, adminProfile) {
  const statusEl = el.querySelector(`#ref-status-${docId}`);
  if (statusEl) statusEl.textContent = 'Publishing…';
  try {
    const doc  = await db.collection(COLLECTIONS.USER_REFLECTIONS).doc(docId).get();
    const data = doc.data();
    const now  = firebase.firestore.FieldValue.serverTimestamp();

    if (destination === 'blog') {
      const blogId = db.collection(COLLECTIONS.BLOG).doc().id;
      await db.collection(COLLECTIONS.BLOG).doc(blogId).set({
        title:       { en: data.title, hi: '', ur: '' },
        body:        JSON.stringify({ ops: [{ insert: data.body }] }),
        body_html:   `<p>${(data.body||'').replace(/\n/g,'</p><p>')}</p>`,
        author:      data.published_as === 'anonymous' ? 'Anonymous' : data.uid,
        status:      'published',
        published_at: now,
        created_at:  now,
        updated_at:  now,
        updated_by:  adminProfile?.uid || '',
        tags:        ['reflection'],
        source_reflection_id: docId,
        cover_image_url: null,
      });
      await db.collection(COLLECTIONS.USER_REFLECTIONS).doc(docId).update({
        status: 'approved', blog_post_id: blogId, updated_by: adminProfile?.uid || '',
      });
    } else {
      const gemId = db.collection(COLLECTIONS.LIBRARY).doc().id;
      await db.collection(COLLECTIONS.LIBRARY).doc(gemId).set({
        uid:         data.uid,
        app_source:  'dashboard',
        text:        data.body,
        title:       data.title,
        approved_at: now,
        tags:        ['reflection'],
      });
      await db.collection(COLLECTIONS.USER_REFLECTIONS).doc(docId).update({
        status: 'approved', updated_by: adminProfile?.uid || '',
      });
    }
    if (statusEl) statusEl.textContent = `✓ Published to ${destination}.`;
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Failed: ' + e.message;
  }
}

async function rejectReflection(el, docId, adminProfile) {
  if (!confirm('Reject this reflection?')) return;
  const statusEl = el.querySelector(`#ref-status-${docId}`);
  try {
    await db.collection(COLLECTIONS.USER_REFLECTIONS).doc(docId).update({
      status: 'rejected', updated_by: adminProfile?.uid || '',
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (statusEl) statusEl.textContent = 'Rejected.';
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Failed: ' + e.message;
  }
}


// ═══════════════════════════════════════════════════════════════
// MODULE 7 — SABIQUN MANAGEMENT
// ═══════════════════════════════════════════════════════════════

async function renderSabiqun(el, profile) {
  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Sabiqun</h1>
    </div>
    <div class="admin-tab-bar">
      <button class="admin-tab active" data-tab="responses">Form Responses</button>
      <button class="admin-tab" data-tab="members">Active Sabiqun</button>
    </div>
    <div id="sabiqun-content">
      <div class="admin-loading"><div class="spinner"></div></div>
    </div>
  </div>`;

  el.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tab.dataset.tab === 'responses' ? loadSabiqunResponses(el, profile) : loadSabiqunMembers(el, profile);
    });
  });

  loadSabiqunResponses(el, profile);
}

async function loadSabiqunResponses(el, profile) {
  const contentEl = el.querySelector('#sabiqun-content');
  contentEl.innerHTML = `<div class="admin-loading"><div class="spinner"></div></div>`;

  try {
    const snap = await db.collection(COLLECTIONS.SABIQUN_RESPONSES).limit(100).get();

    if (snap.empty) {
      contentEl.innerHTML = `<div class="admin-empty">No form responses yet.</div>`;
      return;
    }

    contentEl.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Contact</th><th>Submitted</th><th>Time Taken</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${snap.docs.map(doc => {
              const r    = doc.data();
              const date = r.submitted_at?.toDate?.()?.toLocaleDateString() || '—';
              const mins = r.time_taken_seconds ? Math.round(r.time_taken_seconds/60) + ' min' : '—';
              return `<tr>
                <td>${r.name||'—'}</td>
                <td style="color:var(--text-muted);">${r.contact||'—'}</td>
                <td style="font-size:var(--text-xs);">${date}</td>
                <td style="font-size:var(--text-xs);">${mins}</td>
                <td><span class="badge ${r.status==='approved'?'badge-success':r.status==='rejected'?'badge-crimson':'badge-muted'}">${r.status||'pending'}</span></td>
                <td><button class="btn btn-ghost btn-sm" data-view-response="${doc.id}">View</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    contentEl.querySelectorAll('[data-view-response]').forEach(btn => {
      btn.addEventListener('click', () => {
        const doc = snap.docs.find(d => d.id === btn.dataset.viewResponse);
        if (doc) showSabiqunResponse(el, { id: doc.id, ...doc.data() }, profile);
      });
    });
  } catch (e) {
    contentEl.innerHTML = `<div class="admin-error">Failed to load: ${e.message}</div>`;
  }
}

function showSabiqunResponse(el, response, adminProfile) {
  const contentEl = el.querySelector('#sabiqun-content');
  const answers   = response.answers || {};

  contentEl.innerHTML = `
    <div class="admin-detail-panel">
      <button class="btn btn-ghost btn-sm" id="back-to-responses">← Back</button>
      <div class="admin-detail-header">
        <div>
          <h2 class="admin-detail-name">${response.name||'—'}</h2>
          <p style="color:var(--text-muted);">${response.contact||'—'}</p>
        </div>
        <span class="badge ${response.status==='approved'?'badge-success':'badge-muted'}">${response.status||'pending'}</span>
      </div>

      <div class="admin-response-answers">
        ${Object.entries(answers).map(([q, a]) => `
          <div class="admin-response-item">
            <p class="admin-response-q">${q}</p>
            <p class="admin-response-a">${a}</p>
          </div>`).join('')}
      </div>

      ${response.status !== 'approved' ? `
        <div class="admin-sabiqun-create" style="margin-top:var(--space-8);">
          <div class="admin-alert admin-alert-gold" style="margin-bottom:var(--space-6);">
            <strong>⚠️ Account Creation requires a Cloud Function.</strong>
            Per the Admin Architecture Document, the "Create Account" button is blocked until
            the <code>createSabiqunAccount</code> Cloud Function is deployed.
            For now, create the account manually in Firebase Console → Authentication.
          </div>
          <div class="admin-field" style="max-width:300px;">
            <label class="form-label">Mark as</label>
            <div style="display:flex;gap:var(--space-3);">
              <select id="response-status-select" class="admin-select">
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button class="btn btn-primary btn-sm" id="save-response-status">Save</button>
            </div>
            <p id="response-status-msg" class="admin-status-msg"></p>
          </div>
        </div>` : ''}
    </div>`;

  contentEl.querySelector('#back-to-responses')?.addEventListener('click', () => {
    loadSabiqunResponses(el, adminProfile);
  });

  contentEl.querySelector('#save-response-status')?.addEventListener('click', async () => {
    const status  = contentEl.querySelector('#response-status-select')?.value;
    const msgEl   = contentEl.querySelector('#response-status-msg');
    if (msgEl) msgEl.textContent = 'Saving…';
    try {
      await db.collection(COLLECTIONS.SABIQUN_RESPONSES).doc(response.id).update({
        status,
        reviewed_by: adminProfile?.uid || '',
        reviewed_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (msgEl) msgEl.textContent = `Marked as ${status}.`;
    } catch (e) {
      if (msgEl) msgEl.textContent = 'Failed: ' + e.message;
    }
  });
}

async function loadSabiqunMembers(el, profile) {
  const contentEl = el.querySelector('#sabiqun-content');
  contentEl.innerHTML = `<div class="admin-loading"><div class="spinner"></div></div>`;

  try {
    const snap = await db.collection(COLLECTIONS.USERS)
      .where('member_tier', '==', 'sabiqun')
      .orderBy('joined_at', 'desc').get();

    if (snap.empty) {
      contentEl.innerHTML = `<div class="admin-empty">No Sabiqun members yet.</div>`;
      return;
    }

    contentEl.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Stage</th><th>Streak</th><th>Last Active</th></tr></thead>
          <tbody>
            ${snap.docs.map(doc => {
              const u = doc.data();
              return `<tr>
                <td>${u.name||'—'}</td>
                <td style="color:var(--text-muted);">${u.contact||'—'}</td>
                <td>${u.stage||1}</td>
                <td>${u.streak||0} 🔥</td>
                <td style="font-size:var(--text-xs);">${u.last_active?.toDate?.()?.toLocaleDateString()||'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    contentEl.innerHTML = `<div class="admin-error">Failed to load: ${e.message}</div>`;
  }
}


// ═══════════════════════════════════════════════════════════════
// MODULE 8 — FOUNDER INSIGHTS
// ═══════════════════════════════════════════════════════════════

async function renderInsights(el, profile) {
  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Founder Insights</h1>
      <button class="btn btn-primary btn-sm" id="new-insight-btn">+ New Insight</button>
    </div>
    <div id="insights-list">
      <div class="admin-loading"><div class="spinner"></div></div>
    </div>
    <div id="insight-form" class="hidden">
      <div class="admin-insight-form">
        <button class="btn btn-ghost btn-sm" id="cancel-insight">← Cancel</button>
        <div class="admin-field" style="margin-top:var(--space-5);">
          <label class="form-label">Title</label>
          <input type="text" id="insight-title" placeholder="Note title…" />
        </div>
        <div class="admin-field">
          <label class="form-label">Body</label>
          <textarea id="insight-body" rows="6" placeholder="Write your personal note to the community…"></textarea>
        </div>
        <div class="admin-field">
          <label class="form-label">Visible to</label>
          <select id="insight-audience" class="admin-select">
            <option value="sabiqun">Sabiqun only</option>
            <option value="sabiqun_and_core">Sabiqun + Core</option>
          </select>
        </div>
        <div id="insight-status" class="admin-status-msg"></div>
        <button class="btn btn-primary" id="save-insight-btn">Post Insight</button>
      </div>
    </div>
  </div>`;

  el.querySelector('#new-insight-btn')?.addEventListener('click', () => {
    el.querySelector('#insights-list').classList.add('hidden');
    el.querySelector('#insight-form').classList.remove('hidden');
  });

  el.querySelector('#cancel-insight')?.addEventListener('click', () => {
    el.querySelector('#insights-list').classList.remove('hidden');
    el.querySelector('#insight-form').classList.add('hidden');
  });

  el.querySelector('#save-insight-btn')?.addEventListener('click', async () => {
    const title    = el.querySelector('#insight-title')?.value.trim();
    const body     = el.querySelector('#insight-body')?.value.trim();
    const audience = el.querySelector('#insight-audience')?.value;
    const statusEl = el.querySelector('#insight-status');

    if (!title || !body) {
      if (statusEl) statusEl.textContent = 'Title and body are required.';
      return;
    }
    if (statusEl) statusEl.textContent = 'Posting…';

    try {
      await db.collection(COLLECTIONS.FOUNDER_INSIGHTS).add({
        title,
        body,
        posted_at:  firebase.firestore.FieldValue.serverTimestamp(),
        posted_by:  profile?.uid || '',
        visible_to: audience === 'sabiqun' ? ['sabiqun'] : ['sabiqun','core'],
      });
      el.querySelector('#insight-title').value = '';
      el.querySelector('#insight-body').value  = '';
      if (statusEl) statusEl.textContent = '✓ Posted.';
      await loadInsightsList(el, profile);
      setTimeout(() => {
        el.querySelector('#insights-list').classList.remove('hidden');
        el.querySelector('#insight-form').classList.add('hidden');
      }, 1000);
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Failed: ' + e.message;
    }
  });

  await loadInsightsList(el, profile);
}

async function loadInsightsList(el, profile) {
  const listEl = el.querySelector('#insights-list');
  listEl.innerHTML = `<div class="admin-loading"><div class="spinner"></div></div>`;

  try {
    const snap = await db.collection(COLLECTIONS.FOUNDER_INSIGHTS)
      .orderBy('posted_at', 'desc').limit(20).get();

    if (snap.empty) {
      listEl.innerHTML = `<div class="admin-empty">No insights posted yet.</div>`;
      return;
    }

    listEl.innerHTML = `<div class="admin-queue">
      ${docs.map(doc => {
        const i    = doc.data();
        const date = i.posted_at?.toDate?.()?.toLocaleDateString() || '—';
        const audience = (i.visible_to||[]).includes('core') ? 'Sabiqun + Core' : 'Sabiqun only';
        return `
          <div class="admin-queue-card">
            <div class="admin-queue-header">
              <p class="admin-queue-name">${i.title||'—'}</p>
              <div style="display:flex;gap:var(--space-2);align-items:center;">
                <span class="badge badge-gold">${audience}</span>
                <span style="font-size:var(--text-xs);color:var(--text-muted);">${date}</span>
              </div>
            </div>
            <p class="admin-queue-excerpt">${(i.body||'').substring(0,150)}…</p>
            <div class="admin-queue-actions">
              <button class="btn btn-ghost btn-sm" style="color:var(--error)" data-delete-insight="${doc.id}">Delete</button>
            </div>
          </div>`;
      }).join('')}
    </div>`;

    listEl.querySelectorAll('[data-delete-insight]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this insight?')) return;
        await db.collection(COLLECTIONS.FOUNDER_INSIGHTS).doc(btn.dataset.deleteInsight).delete();
        loadInsightsList(el, profile);
      });
    });

  } catch (e) {
    listEl.innerHTML = `<div class="admin-error">Failed to load: ${e.message}</div>`;
  }
}


// ═══════════════════════════════════════════════════════════════
// MODULE 0 — APPLICATIONS (Student Application Review)
// ═══════════════════════════════════════════════════════════════

async function renderApplications(el, profile) {
  el.innerHTML = `<div class="admin-module">
    <div class="admin-module-header">
      <h1 class="admin-module-title">Applications</h1>
    </div>
    <div class="admin-tab-bar">
      <button class="admin-tab active" data-app-tab="pending">Pending</button>
      <button class="admin-tab" data-app-tab="approved">Approved</button>
      <button class="admin-tab" data-app-tab="rejected">Rejected</button>
    </div>
    <div id="applications-list">
      <div class="admin-loading"><div class="spinner"></div></div>
    </div>
  </div>`;

  el.querySelectorAll('[data-app-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('[data-app-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadApplicationsList(el, tab.dataset.appTab, profile);
    });
  });

  loadApplicationsList(el, 'pending', profile);
}

async function loadApplicationsList(el, status, profile) {
  const listEl = el.querySelector('#applications-list');
  listEl.innerHTML = `<div class="admin-loading"><div class="spinner"></div></div>`;

  try {
    let query = db.collection('applications').limit(100);
    if (status !== 'all') query = query.where('status', '==', status);
    const snap = await query.get();

    // Sort client-side
    const docs = snap.docs.sort((a,b) => {
      return (b.data().submitted_at?.toMillis()||0) - (a.data().submitted_at?.toMillis()||0);
    });

    if (!docs.length) {
      listEl.innerHTML = `<div class="admin-empty">No ${status} applications.</div>`;
      return;
    }

    listEl.innerHTML = `<div class="admin-queue">
      ${docs.map(doc => {
        const app  = doc.data();
        const date = app.submitted_at?.toDate?.()?.toLocaleDateString() || '—';
        return `
          <div class="admin-queue-card" id="app-card-${doc.id}">
            <div class="admin-queue-header">
              <div>
                <p class="admin-queue-name">${app.name||'—'}</p>
                <p class="admin-queue-meta">${app.email||'—'} · ${date} · ${app.language||'en'}</p>
              </div>
              <span class="badge ${app.status==='pending'?'badge-muted':app.status==='approved'?'badge-success':'badge-crimson'}">
                ${app.status}
              </span>
            </div>

            <!-- MCQ Answers -->
            <div class="admin-response-answers" style="margin:var(--space-4) 0;">
              ${Object.entries(app.answers||{}).map(([q,a]) => `
                <div class="admin-response-item">
                  <p class="admin-response-q">${q}</p>
                  <p class="admin-response-a">${a}</p>
                </div>`).join('')}
            </div>

            <!-- Reflection -->
            ${app.reflection ? `
              <div class="admin-response-item" style="margin-top:var(--space-3);border-left-color:var(--gold);">
                <p class="admin-response-q">Reflection</p>
                <p class="admin-response-a" style="font-style:italic;">"${app.reflection}"</p>
              </div>` : ''}

            ${app.status === 'pending' ? `
              <div class="admin-queue-actions" style="margin-top:var(--space-5);">
                <button class="btn btn-primary btn-sm" data-approve-app="${doc.id}"
                  data-name="${app.name||''}" data-email="${app.email||''}" data-lang="${app.language||'hi'}">
                  ✓ Approve & Create Account
                </button>
                <button class="btn btn-ghost btn-sm" style="color:var(--error);" data-reject-app="${doc.id}">
                  Reject
                </button>
              </div>
              <div class="admin-credentials-box hidden" id="creds-${doc.id}"></div>
              <p class="admin-queue-status" id="app-status-${doc.id}"></p>
            ` : app.status === 'approved' ? `
              <p style="color:var(--success);font-size:var(--text-sm);margin-top:var(--space-4);">
                ✓ Account created
              </p>` : ''}
          </div>`;
      }).join('')}
    </div>`;

    // Wire approve buttons
    listEl.querySelectorAll('[data-approve-app]').forEach(btn => {
      btn.addEventListener('click', () => approveApplication(
        listEl, btn.dataset.approveApp,
        btn.dataset.name, btn.dataset.email, btn.dataset.lang,
        profile
      ));
    });

    // Wire reject buttons
    listEl.querySelectorAll('[data-reject-app]').forEach(btn => {
      btn.addEventListener('click', () => rejectApplication(listEl, btn.dataset.rejectApp, profile));
    });

  } catch (e) {
    listEl.innerHTML = `<div class="admin-error">Failed to load: ${e.message}</div>`;
  }
}

async function approveApplication(el, appId, name, email, lang, adminProfile) {
  const statusEl = el.querySelector(`#app-status-${appId}`);
  const credsEl  = el.querySelector(`#creds-${appId}`);
  const btn      = el.querySelector(`[data-approve-app="${appId}"]`);

  if (statusEl) statusEl.textContent = 'Creating account…';
  if (btn)      { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span>'; }

  try {
    // Call the Cloudflare Worker (replaces Firebase Functions — free, no Blaze required)
    const idToken = await firebase.auth().currentUser.getIdToken();
    const res     = await fetch(WORKER_URL + '/create-account', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken, name, email, applicationId: appId, language: lang }),
    });
    const data = await res.json();

    if (data.success) {
      // Show credentials to admin
      if (credsEl) {
        credsEl.classList.remove('hidden');
        credsEl.innerHTML = `
          <div class="admin-creds-card">
            <p class="admin-creds-title">✓ Account created — share these credentials privately</p>
            <div class="admin-creds-row">
              <span class="admin-creds-label">Name</span>
              <span class="admin-creds-value">${data.name}</span>
            </div>
            <div class="admin-creds-row">
              <span class="admin-creds-label">Email</span>
              <span class="admin-creds-value">${data.email}</span>
            </div>
            <div class="admin-creds-row">
              <span class="admin-creds-label">Password</span>
              <span class="admin-creds-value admin-creds-password">${data.password}</span>
            </div>
            <p class="admin-creds-note">
              Share via WhatsApp or email personally. Student can change their password after first login.
            </p>
            <button class="btn btn-outline btn-sm" id="copy-creds-${appId}">Copy credentials</button>
          </div>`;

        el.querySelector(`#copy-creds-${appId}`)?.addEventListener('click', () => {
          const text = 'QWV Login Credentials' + '\n' + 'Email: ' + data.email + '\n' + 'Password: ' + data.password + '\n' + 'Login at: https://quranworldview.github.io/quranworldview/';
          navigator.clipboard.writeText(text).then(() => {
            el.querySelector(`#copy-creds-${appId}`).textContent = 'Copied!';
          });
        });
      }

      if (statusEl) statusEl.textContent = '';
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '✓ Approve & Create Account'; }
    if (statusEl) statusEl.textContent = 'Failed: ' + (err.message || err.toString());
  }
}

async function rejectApplication(el, appId, adminProfile) {
  if (!confirm('Reject this application?')) return;
  const statusEl = el.querySelector(`#app-status-${appId}`);
  try {
    await db.collection('applications').doc(appId).update({
      status:      'rejected',
      reviewed_by: adminProfile?.uid || '',
      reviewed_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    if (statusEl) statusEl.textContent = 'Application rejected.';
    const card = el.querySelector(`#app-card-${appId}`);
    if (card) card.style.opacity = '0.5';
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Failed: ' + e.message;
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s  = document.createElement('script');
    s.src    = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function _loadCSS(href) {
  return new Promise((resolve) => {
    if (document.querySelector(`link[href="${href}"]`)) { resolve(); return; }
    const l  = document.createElement('link');
    l.rel    = 'stylesheet';
    l.href   = href;
    l.onload = resolve;
    document.head.appendChild(l);
  });
}
