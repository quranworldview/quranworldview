/**
 * QUR'AN WORLD VIEW — login.js (stub)
 * To be built in its dedicated step.
 */
import { t } from '../core/i18n.js';

export default function render(container) {
  container.innerHTML = `
    <div style="
      min-height: calc(100vh - var(--navbar-height));
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: var(--space-4); text-align: center;
      padding: var(--space-8);
    ">
      <span class="section-label">login</span>
      <h1 style="font-family:var(--font-display);color:var(--off-white);">Coming soon</h1>
      <p style="color:var(--text-muted);">This page is being built.</p>
    </div>
  `;
}
