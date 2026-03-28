/**
 * Devices Widget — table of connected devices with top consumer highlight.
 */
import { signalQuality, escapeHTML } from '../../utils.js';
import { api } from '../../api.js';

export function init(container, id) {
  container.innerHTML = `
    <div style="overflow-x:auto">
      <table class="device-table" id="${id}-table">
        <thead>
          <tr>
            <th>Hostname</th>
            <th>IP</th>
            <th>MAC</th>
            <th>Signal</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody id="${id}-tbody">
          <tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export async function update(container, id, status) {
  const devices = await api.devices();
  if (!devices) return;

  const tbody = document.getElementById(`${id}-tbody`);
  if (!tbody) return;

  if (devices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1.5rem">No devices connected</td></tr>`;
    return;
  }

  // Sort: wireless first, then by hostname
  const sorted = [...devices].sort((a, b) => {
    if (a.isWireless && !b.isWireless) return -1;
    if (!a.isWireless && b.isWireless) return 1;
    return (a.hostname || '').localeCompare(b.hostname || '');
  });

  tbody.innerHTML = sorted.map((device, i) => {
    const sq = signalQuality(device.signal);
    const signalBars = renderSignalBars(sq.level);
    const typeIcon = device.isWireless ? '📶' : '🔌';

    return `
      <tr${i === 0 ? ' class="top-consumer"' : ''}>
        <td style="font-weight:500;color:var(--text-primary)">${escapeHTML(device.hostname || 'Unknown')}</td>
        <td class="mono" style="font-size:0.75rem">${escapeHTML(device.ip)}</td>
        <td class="mono" style="font-size:0.7rem;color:var(--text-muted)">${escapeHTML(device.mac)}</td>
        <td>${device.signal != null ? `${signalBars} <span style="font-size:0.7rem;color:var(--text-muted)">${device.signal}dBm</span>` : '—'}</td>
        <td>${typeIcon}</td>
      </tr>
    `;
  }).join('');
}

function renderSignalBars(level) {
  const bars = [4, 8, 12, 16];
  return `<span class="signal-bars">${bars.map((h, i) =>
    `<span class="signal-bar${i < level ? ' active' : ''}" style="height:${h}px"></span>`
  ).join('')}</span>`;
}

export function destroy(id) {}
