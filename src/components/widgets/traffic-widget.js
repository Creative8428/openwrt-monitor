/**
 * Traffic Widget — real-time upload/download line chart.
 */
import { formatRate, formatTime, getChartDefaults } from '../../utils.js';
import { api } from '../../api.js';

const charts = {};

export function init(container, id) {
  container.innerHTML = `
    <div style="display:flex;gap:1.5rem;margin-bottom:0.75rem;flex-wrap:wrap" id="${id}-rates">
      <div class="metric-group">
        <span class="metric-label" style="color:var(--chart-4)">↓ Download</span>
        <span class="metric-value small" id="${id}-rx">—</span>
      </div>
      <div class="metric-group">
        <span class="metric-label" style="color:var(--chart-6)">↑ Upload</span>
        <span class="metric-value small" id="${id}-tx">—</span>
      </div>
    </div>
    <div class="chart-container"><canvas id="${id}-chart"></canvas></div>
  `;
}

export async function update(container, id, status) {
  // Fetch latest traffic data
  const trafficData = await api.traffic();
  if (!trafficData || trafficData.length === 0) return;

  // Sum rates across all interfaces (or pick WAN)
  let totalRx = 0, totalTx = 0;
  for (const iface of trafficData) {
    totalRx += iface.rx_rate || 0;
    totalTx += iface.tx_rate || 0;
  }

  // Update values
  const rxEl = document.getElementById(`${id}-rx`);
  const txEl = document.getElementById(`${id}-tx`);
  if (rxEl) rxEl.textContent = formatRate(totalRx);
  if (txEl) txEl.textContent = formatRate(totalTx);

  // Chart
  const canvas = document.getElementById(`${id}-chart`);
  if (!canvas) return;

  const style = getComputedStyle(document.documentElement);

  if (!charts[id]) {
    const defaults = getChartDefaults();
    charts[id] = { history: [], chart: null };

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
          legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 12, color: style.getPropertyValue('--text-secondary').trim(), font: { family: 'Inter', size: 11 } } },
        },
        scales: {
          ...defaults.scales,
          y: {
            ...defaults.scales.y,
            min: 0,
            ticks: { ...defaults.scales.y.ticks, callback: v => formatRate(v) },
          },
        },
      },
    });
  }

  const chart = charts[id].chart;
  const history = charts[id].history;

  history.push({ time: Date.now(), rx: totalRx, tx: totalTx });
  if (history.length > 60) history.shift();

  chart.data.labels = history.map(h => formatTime(h.time));
  chart.data.datasets[0].data = history.map(h => h.rx);
  chart.data.datasets[1].data = history.map(h => h.tx);
  chart.update('none');
}

export function destroy(id) {
  if (charts[id]?.chart) {
    charts[id].chart.destroy();
    delete charts[id];
  }
}
