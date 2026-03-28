/**
 * Uptime Widget — formatted uptime display.
 */
import { formatUptime } from '../../utils.js';

export function init(container, id) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:0.5rem">
      <span class="metric-value" id="${id}-value" style="font-size:1.75rem">—</span>
      <span class="metric-label" id="${id}-since">—</span>
    </div>
  `;
}

export async function update(container, id, status) {
  const uptime = status?.loadUptime?.uptimeSeconds;
  if (uptime == null) return;

  const valueEl = document.getElementById(`${id}-value`);
  if (valueEl) valueEl.textContent = formatUptime(uptime);

  const sinceEl = document.getElementById(`${id}-since`);
  if (sinceEl) {
    const bootTime = new Date(Date.now() - uptime * 1000);
    sinceEl.textContent = `Since ${bootTime.toLocaleDateString()} ${bootTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

export function destroy(id) {}
