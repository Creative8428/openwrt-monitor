/**
 * CPU Usage Widget — gauge + sparkline chart.
 */
import { gaugeClass, getChartDefaults, formatTime } from '../../utils.js';
import { api } from '../../api.js';

const charts = {};

export function init(container, id) {
  container.innerHTML = `
    <div class="metric-group" style="margin-bottom: 0.75rem">
      <div style="display:flex;align-items:baseline;gap:0.5rem">
        <span class="metric-value" id="${id}-value">—</span>
        <span class="metric-unit">%</span>
      </div>
      <div class="gauge-bar">
        <div class="gauge-fill" id="${id}-gauge" style="width:0%"></div>
      </div>
    </div>
    <div class="chart-container"><canvas id="${id}-chart"></canvas></div>
  `;
}

export async function update(container, id, status) {
  const usage = status?.cpu?.usage ?? 0;

  // Update value
  const valueEl = document.getElementById(`${id}-value`);
  if (valueEl) valueEl.textContent = usage;

  // Update gauge
  const gaugeEl = document.getElementById(`${id}-gauge`);
  if (gaugeEl) {
    gaugeEl.style.width = `${usage}%`;
    gaugeEl.className = `gauge-fill ${gaugeClass(usage)}`;
  }

  // Update chart
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
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-1').trim(),
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
          y: { ...defaults.scales.y, min: 0, max: 100, ticks: { ...defaults.scales.y.ticks, callback: v => `${v}%` } },
        },
      },
    });
  }

  const chart = charts[id].chart;
  const history = charts[id].history;

  history.push({ time: Date.now(), value: usage });
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
