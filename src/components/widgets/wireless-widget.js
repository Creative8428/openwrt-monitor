/**
 * Wireless Widget — WiFi clients list with signal strength.
 */
import { signalQuality } from '../../utils.js';
import { api } from '../../api.js';

export function init(container, id) {
  container.innerHTML = `
    <div id="${id}-clients" style="display:flex;flex-direction:column;gap:0.5rem">
      <div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:1.5rem">Loading...</div>
    </div>
  `;
}

export async function update(container, id, status) {
  const clients = await api.wireless();
  const clientsEl = document.getElementById(`${id}-clients`);
  if (!clientsEl) return;

  if (!clients || clients.length === 0) {
    clientsEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:1.5rem">No wireless clients</div>`;
    return;
  }

  // Try to match MACs with DHCP leases for hostnames
  const devices = await api.devices();
  const deviceMap = new Map();
  if (devices) {
    for (const d of devices) {
      deviceMap.set(d.mac?.toUpperCase(), d);
    }
  }

  clientsEl.innerHTML = clients.map(client => {
    const sq = signalQuality(client.signal);
    const device = deviceMap.get(client.mac?.toUpperCase());
    const name = device?.hostname || client.mac;
    const signalBars = renderSignalBars(sq.level);

    const signalColor = sq.level >= 3 ? 'var(--color-success)' : sq.level >= 2 ? 'var(--color-warning)' : 'var(--color-danger)';

    return `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0.75rem;background:var(--bg-elevated);border-radius:var(--radius-md)">
        <div style="flex-shrink:0">${signalBars}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)" class="mono">${client.interface || '—'}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:0.8rem;font-weight:600;color:${signalColor}">${client.signal ?? '—'} dBm</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">${sq.label}</div>
        </div>
        ${client.rxRate ? `<div style="text-align:right;flex-shrink:0;font-size:0.7rem;color:var(--text-muted)">
          <div>↓ ${client.rxRate} Mbit</div>
          <div>↑ ${client.txRate} Mbit</div>
        </div>` : ''}
      </div>
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
