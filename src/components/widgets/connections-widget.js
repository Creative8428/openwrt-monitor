/**
 * Connections Widget — active conntrack count with trend line.
 */
import { getChartDefaults, formatTime } from '../../utils.js';

const charts = {};

export function init(container, id) {
  container.innerHTML = `
    <div style="display:flex;align-items:baseline;gap:0.5rem;margin-bottom:0.5rem">
      <span class="metric-value" id="${id}-value">—</span>
      <span class="metric-unit">active</span>
    </div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.75rem">
      Max: <span id="${id}-max" class="mono">—</span>
    </div>
    <div class="gauge-bar" style="height:6px;margin-bottom:0.75rem">
      <div class="gauge-fill" id="${id}-gauge" style="width:0%"></div>
    </div>
    <div class="chart-container"><canvas id="${id}-chart"></canvas></div>
  `;
}

export async function update(container, id, status) {
  const conn = status?.conntrack;
  if (!conn) return;

  const valueEl = document.getElementById(`${id}-value`);
  if (valueEl) valueEl.textContent = conn.current?.toLocaleString() ?? '—';

  const maxEl = document.getElementById(`${id}-max`);
  if (maxEl) maxEl.textContent = conn.max?.toLocaleString() ?? '—';

  // Gauge
  const gaugeEl = document.getElementById(`${id}-gauge`);
  if (gaugeEl && conn.max > 0) {
    const percent = Math.round((conn.current / conn.max) * 100);
    gaugeEl.style.width = `${percent}%`;
    if (percent >= 90) gaugeEl.className = 'gauge-fill danger';
    else if (percent >= 75) gaugeEl.className = 'gauge-fill warning';
    else gaugeEl.className = 'gauge-fill';
  }

  // Chart
  const canvas = document.getElementById(`${id}-chart`);
  if (!canvas) return;

  if (!charts[id]) {
    const defaults = getChartDefaults();
    charts[id] = { history: [], chart: null };

    charts[id].chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          data: [],
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-3').trim(),
          backgroundColor: 'rgba(6, 182, 212, 0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        }],
      },
      options: {
        ...defaults,
        scales: {
          ...defaults.scales,
          y: { ...defaults.scales.y, min: 0 },
        },
      },
    });
  }

  const chart = charts[id].chart;
  const history = charts[id].history;

  history.push({ time: Date.now(), value: conn.current });
  if (history.length > 60) history.shift();

  chart.data.labels = history.map(h => formatTime(h.time));
  chart.data.datasets[0].data = history.map(h => h.value);
  chart.update('none');
}

export function destroy(id) {
  if (charts[id]?.chart) {
    charts[id].chart.destroy();
    delete charts[id];
  }
}
