/**
 * Traffic Widget — real-time upload/download line chart with historical range selector.
 */
import { formatRate, formatBytes, formatTime, getChartDefaults } from '../../utils.js';
import { api } from '../../api.js';

const charts = {};
const RANGES = [
  { key: 'live', label: 'Live' },
  { key: '1h', label: '1H' },
  { key: '6h', label: '6H' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
];

/**
 * Format a timestamp for chart labels — includes date for multi-day ranges.
 */
function formatLabel(timestamp, range) {
  const d = new Date(timestamp);
  if (range === '7d' || range === '30d') {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  if (range === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function init(container, id) {
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap" id="${id}-rates">
        <div class="metric-group">
          <span class="metric-label" style="color:var(--chart-4)">\u2193 Download</span>
          <span class="metric-value small" id="${id}-rx">\u2014</span>
        </div>
        <div class="metric-group">
          <span class="metric-label" style="color:var(--chart-6)">\u2191 Upload</span>
          <span class="metric-value small" id="${id}-tx">\u2014</span>
        </div>
      </div>
      <div id="${id}-range-btns" style="display:flex;gap:2px;background:var(--bg-input);border-radius:6px;padding:2px;flex-shrink:0">
        ${RANGES.map(
          (r) =>
            `<button class="traffic-range-btn${r.key === 'live' ? ' active' : ''}" data-range="${r.key}" style="
              padding:3px 8px;border:none;border-radius:4px;cursor:pointer;
              font-size:11px;font-family:Inter,sans-serif;font-weight:500;
              color:var(--text-secondary);background:transparent;transition:all 0.2s;
            ">${r.label}</button>`
        ).join('')}
      </div>
    </div>
    <div id="${id}-totals" style="display:none;gap:1.5rem;margin-bottom:0.75rem;flex-wrap:wrap">
      <div class="metric-group">
        <span class="metric-label" style="color:var(--chart-4)">\u2193 Total Down</span>
        <span class="metric-value small" id="${id}-total-rx">\u2014</span>
      </div>
      <div class="metric-group">
        <span class="metric-label" style="color:var(--chart-6)">\u2191 Total Up</span>
        <span class="metric-value small" id="${id}-total-tx">\u2014</span>
      </div>
    </div>
    <div class="chart-container"><canvas id="${id}-chart"></canvas></div>
  `;

  // Wire up range buttons
  const btnContainer = document.getElementById(`${id}-range-btns`);
  btnContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.traffic-range-btn');
    if (!btn) return;
    const range = btn.dataset.range;
    // Update active state
    btnContainer.querySelectorAll('.traffic-range-btn').forEach((b) => {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.color = 'var(--text-secondary)';
    });
    btn.classList.add('active');
    btn.style.background = 'var(--accent-primary)';
    btn.style.color = '#fff';

    // Store selected range and clear history cache
    if (charts[id]) {
      charts[id].selectedRange = range;
      charts[id].history = [];
      charts[id].historyLoaded = false;
    }

    // Toggle totals row
    const totalsEl = document.getElementById(`${id}-totals`);
    if (totalsEl) {
      totalsEl.style.display = range === 'live' ? 'none' : 'flex';
    }

    // Immediately fetch new data
    fetchAndRender(id);
  });

  // Set initial active button style
  const activeBtn = btnContainer.querySelector('.traffic-range-btn.active');
  if (activeBtn) {
    activeBtn.style.background = 'var(--accent-primary)';
    activeBtn.style.color = '#fff';
  }
}

async function fetchAndRender(id) {
  const state = charts[id];
  if (!state || !state.chart) return;

  const range = state.selectedRange || 'live';
  const chart = state.chart;

  if (range === 'live') {
    // Live mode — just use what's in the rolling history buffer
    chart.data.labels = state.history.map((h) => formatTime(h.time));
    chart.data.datasets[0].data = state.history.map((h) => h.rx);
    chart.data.datasets[1].data = state.history.map((h) => h.tx);
    chart.options.scales.y.ticks.callback = (v) => formatRate(v);

    // Update tooltip to show rate
    chart.options.plugins.tooltip.callbacks = {
      label: (ctx) => `${ctx.dataset.label}: ${formatRate(ctx.raw)}`,
    };
    chart.update('none');
    return;
  }

  // Historical mode — fetch from API
  const data = await api.trafficHistory(range);
  if (!data || data.length === 0) return;

  // Aggregate across all interfaces per timestamp
  const byTime = new Map();
  for (const row of data) {
    const existing = byTime.get(row.timestamp) || { rx_rate: 0, tx_rate: 0, rx_bytes: 0, tx_bytes: 0 };
    existing.rx_rate += row.rx_rate || 0;
    existing.tx_rate += row.tx_rate || 0;
    existing.rx_bytes += row.rx_bytes || 0;
    existing.tx_bytes += row.tx_bytes || 0;
    byTime.set(row.timestamp, existing);
  }

  const timestamps = [...byTime.keys()].sort((a, b) => a - b);
  const aggregated = timestamps.map((ts) => ({ time: ts, ...byTime.get(ts) }));

  // Calculate total transferred in the period (delta between first and last snapshot)
  let totalRxBytes = 0;
  let totalTxBytes = 0;
  if (aggregated.length >= 2) {
    // Sum the average rate * time delta across intervals for an estimate
    for (let i = 1; i < aggregated.length; i++) {
      const dt = (aggregated[i].time - aggregated[i - 1].time) / 1000; // seconds
      totalRxBytes += aggregated[i].rx_rate * dt;
      totalTxBytes += aggregated[i].tx_rate * dt;
    }
  }

  // Update totals display
  const totalRxEl = document.getElementById(`${id}-total-rx`);
  const totalTxEl = document.getElementById(`${id}-total-tx`);
  if (totalRxEl) totalRxEl.textContent = formatBytes(totalRxBytes);
  if (totalTxEl) totalTxEl.textContent = formatBytes(totalTxBytes);

  // Update chart with rate data
  chart.data.labels = aggregated.map((h) => formatLabel(h.time, range));
  chart.data.datasets[0].data = aggregated.map((h) => h.rx_rate);
  chart.data.datasets[1].data = aggregated.map((h) => h.tx_rate);
  chart.options.scales.y.ticks.callback = (v) => formatRate(v);

  chart.options.plugins.tooltip.callbacks = {
    label: (ctx) => `${ctx.dataset.label}: ${formatRate(ctx.raw)}`,
  };
  chart.update('none');
}

export async function update(container, id, status) {
  // Fetch latest traffic data for live rates
  const trafficData = await api.traffic();
  if (!trafficData || trafficData.length === 0) return;

  // Sum rates across all interfaces
  let totalRx = 0,
    totalTx = 0;
  for (const iface of trafficData) {
    totalRx += iface.rx_rate || 0;
    totalTx += iface.tx_rate || 0;
  }

  // Always update the current rate display
  const rxEl = document.getElementById(`${id}-rx`);
  const txEl = document.getElementById(`${id}-tx`);
  if (rxEl) rxEl.textContent = formatRate(totalRx);
  if (txEl) txEl.textContent = formatRate(totalTx);

  // Chart setup
  const canvas = document.getElementById(`${id}-chart`);
  if (!canvas) return;

  const style = getComputedStyle(document.documentElement);

  if (!charts[id]) {
    const defaults = getChartDefaults();
    charts[id] = { history: [], chart: null, selectedRange: 'live', historyLoaded: false };

    charts[id].chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Download',
            data: [],
            borderColor: style.getPropertyValue('--chart-4').trim(),
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            label: 'Upload',
            data: [],
            borderColor: style.getPropertyValue('--chart-6').trim(),
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
          },
        ],
      },
      options: {
        ...defaults,
        plugins: {
          ...defaults.plugins,
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              padding: 12,
              color: style.getPropertyValue('--text-secondary').trim(),
              font: { family: 'Inter', size: 11 },
            },
          },
        },
        scales: {
          ...defaults.scales,
          y: {
            ...defaults.scales.y,
            min: 0,
            ticks: { ...defaults.scales.y.ticks, callback: (v) => formatRate(v) },
          },
        },
      },
    });
  }

  const state = charts[id];
  const range = state.selectedRange || 'live';

  if (range === 'live') {
    // Rolling in-memory buffer for live view
    state.history.push({ time: Date.now(), rx: totalRx, tx: totalTx });
    if (state.history.length > 60) state.history.shift();

    fetchAndRender(id);
  } else {
    // In historical mode, re-fetch periodically (data updates each poll)
    fetchAndRender(id);
  }
}

export function destroy(id) {
  if (charts[id]?.chart) {
    charts[id].chart.destroy();
    delete charts[id];
  }
}
