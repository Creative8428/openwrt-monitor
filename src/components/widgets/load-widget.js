/**
 * System Load Widget — load average (1/5/15 min) with chart.
 */
import { getChartDefaults, formatTime } from '../../utils.js';

const charts = {};

export function init(container, id) {
  container.innerHTML = `
    <div style="display:flex;gap:1.5rem;margin-bottom:0.75rem;flex-wrap:wrap" id="${id}-values">
      <div class="metric-group">
        <span class="metric-label">1 min</span>
        <span class="metric-value small" id="${id}-l1">—</span>
      </div>
      <div class="metric-group">
        <span class="metric-label">5 min</span>
        <span class="metric-value small" id="${id}-l5">—</span>
      </div>
      <div class="metric-group">
        <span class="metric-label">15 min</span>
        <span class="metric-value small" id="${id}-l15">—</span>
      </div>
    </div>
    <div class="chart-container"><canvas id="${id}-chart"></canvas></div>
  `;
}

export async function update(container, id, status) {
  const load = status?.loadUptime;
  if (!load) return;

  const l1El = document.getElementById(`${id}-l1`);
  const l5El = document.getElementById(`${id}-l5`);
  const l15El = document.getElementById(`${id}-l15`);

  if (l1El) l1El.textContent = load.load1?.toFixed(2) ?? '—';
  if (l5El) l5El.textContent = load.load5?.toFixed(2) ?? '—';
  if (l15El) l15El.textContent = load.load15?.toFixed(2) ?? '—';

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
            label: '1 min',
            data: [],
            borderColor: style.getPropertyValue('--chart-1').trim(),
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            label: '5 min',
            data: [],
            borderColor: style.getPropertyValue('--chart-2').trim(),
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
          },
          {
            label: '15 min',
            data: [],
            borderColor: style.getPropertyValue('--chart-3').trim(),
            borderWidth: 2,
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
              padding: 10,
              color: style.getPropertyValue('--text-secondary').trim(),
              font: { family: 'Inter', size: 10 },
            },
          },
        },
        scales: {
          ...defaults.scales,
          y: { ...defaults.scales.y, min: 0 },
        },
      },
    });
  }

  const chart = charts[id].chart;
  const history = charts[id].history;

  history.push({ time: Date.now(), l1: load.load1, l5: load.load5, l15: load.load15 });
  if (history.length > 60) history.shift();

  chart.data.labels = history.map(h => formatTime(h.time));
  chart.data.datasets[0].data = history.map(h => h.l1);
  chart.data.datasets[1].data = history.map(h => h.l5);
  chart.data.datasets[2].data = history.map(h => h.l15);
  chart.update('none');
}

export function destroy(id) {
  if (charts[id]?.chart) {
    charts[id].chart.destroy();
    delete charts[id];
  }
}
