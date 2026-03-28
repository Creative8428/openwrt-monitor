/**
 * Storage Widget — disk usage bars.
 */
import { formatBytes, gaugeClass, escapeHTML } from '../../utils.js';

export function init(container, id) {
  container.innerHTML = `<div id="${id}-mounts" style="display:flex;flex-direction:column;gap:1rem">
    <div style="color:var(--text-muted);font-size:0.8rem">Loading...</div>
  </div>`;
}

export async function update(container, id, status) {
  const storage = status?.storage;
  const mountsEl = document.getElementById(`${id}-mounts`);
  if (!mountsEl) return;

  if (!storage || storage.length === 0) {
    mountsEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:1rem">No storage data</div>`;
    return;
  }

  mountsEl.innerHTML = storage.map(mount => {
    const percent = mount.usagePercent || 0;
    return `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.25rem">
          <span style="color:var(--text-primary);font-weight:500" class="mono">${escapeHTML(mount.mount)}</span>
          <span style="color:var(--text-muted)">${formatBytes(mount.used)} / ${formatBytes(mount.total)}</span>
        </div>
        <div class="gauge-bar" style="height:6px">
          <div class="gauge-fill ${gaugeClass(percent)}" style="width:${percent}%"></div>
        </div>
        <div style="text-align:right;font-size:0.7rem;color:var(--text-muted);margin-top:2px">${percent}% used</div>
      </div>
    `;
  }).join('');
}

export function destroy(id) {}
