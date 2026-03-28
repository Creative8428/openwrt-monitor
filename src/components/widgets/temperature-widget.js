/**
 * Temperature Widget — gauge with color-coded thresholds.
 */
import { gaugeClass, getChartDefaults, formatTime } from '../../utils.js';

const charts = {};

export function init(container, id) {
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem">
      <div class="metric-group">
        <div style="display:flex;align-items:baseline;gap:0.25rem">
          <span class="metric-value" id="${id}-value">—</span>
          <span class="metric-unit">°C</span>
        </div>
        <span class="metric-label" id="${id}-status">—</span>
      </div>
    </div>
    <div class="gauge-bar" style="height:10px;margin-bottom:0.75rem">
      <div class="gauge-fill" id="${id}-gauge" style="width:0%"></div>
    </div>
    <div class="chart-container"><canvas id="${id}-chart"></canvas></div>
  `;
}

export async function update(container, id, status) {
  const temp = status?.temperature;
  if (!temp) {
    const valueEl = document.getElementById(`${id}-value`);
    if (valueEl) valueEl.textContent = 'N/A';
    const statusEl = document.getElementById(`${id}-status`);
    if (statusEl) statusEl.textContent = 'No thermal sensor found';
    return;
  }

  const maxTemp = temp.max;
  const valueEl = document.getElementById(`${id}-value`);
  if (valueEl) valueEl.textContent = maxTemp.toFixed(1);

  // Status text
  const statusEl = document.getElementById(`${id}-status`);
  if (statusEl) {
    if (maxTemp < 50) {
      statusEl.textContent = 'Normal';
      statusEl.style.color = 'var(--color-success)';
    } else if (maxTemp < 70) {
      statusEl.textContent = 'Warm';
      statusEl.style.color = 'var(--color-warning)';
    } else {
      statusEl.textContent = 'Hot!';
      statusEl.style.color = 'var(--color-danger)';
    }
  }

  // Gauge (0-100°C mapped to 0-100%)
  const gaugeEl = document.getElementById(`${id}-gauge`);
  if (gaugeEl) {
    const percent = Math.min(100, (maxTemp / 100) * 100);
    gaugeEl.style.width = `${percent}%`;
    if (maxTemp >= 70) gaugeEl.className = 'gauge-fill danger';
    else if (maxTemp >= 50) gaugeEl.className = 'gauge-fill warning';
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
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--chart-5').trim(),
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
          y: { ...defaults.scales.y, ticks: { ...defaults.scales.y.ticks, callback: v => `${v}°C` } },
        },
      },
    });
  }

  const chart = charts[id].chart;
  const history = charts[id].history;

  history.push({ time: Date.now(), value: maxTemp });
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
