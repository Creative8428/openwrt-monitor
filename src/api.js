/**
 * Frontend API client — wrapper around fetch() for all backend endpoints.
 */

const BASE = '/api';

async function fetchJSON(endpoint, options = {}) {
  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[API] ${endpoint} failed:`, err.message);
    return null;
  }
}

export const api = {
  health: () => fetchJSON('/health'),
  status: () => fetchJSON('/status'),
  systemHistory: (range = '1h') => fetchJSON(`/system/history?range=${range}`),
  traffic: () => fetchJSON('/traffic'),
  trafficHistory: (range = '1h', iface = '') =>
    fetchJSON(`/traffic/history?range=${range}${iface ? `&interface=${iface}` : ''}`),
  devices: () => fetchJSON('/devices'),
  topDevices: (range = '24h') => fetchJSON(`/devices/top?range=${range}`),
  wireless: () => fetchJSON('/wireless'),
  storage: () => fetchJSON('/storage'),
  connections: () => fetchJSON('/connections'),
  getSettings: () => fetchJSON('/settings'),
  saveSettings: (data) =>
    fetchJSON('/settings', { method: 'POST', body: JSON.stringify(data) }),
};
