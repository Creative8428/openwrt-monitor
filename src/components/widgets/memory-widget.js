/**
 * Memory Widget — donut chart + usage breakdown.
 */
import { formatBytes, gaugeClass, getChartDefaults } from '../../utils.js';

const charts = {};

export function init(container, id) {
  container.innerHTML = `
    <div style="display:flex;gap:1rem;align-items:center;height:100%">
      <div style="width:120px;height:120px;flex-shrink:0;position:relative">
        <canvas id="${id}-donut"></canvas>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">
          <span class="metric-value small" id="${id}-percent">—</span>
          <span class="metric-unit" style="margin-left:0">%</span>
        </div>
      </div>
      <div class="metric-group" style="flex:1;gap:0.5rem;font-size:0.8rem" id="${id}-details">
        <div style="color:var(--text-muted)">Loading...</div>
      </div>
    </div>
  `;
}

export async function update(container, id, status) {
  const mem = status?.memory;
  if (!mem || !mem.total) {
    container.innerHTML = '<div style="padding:1rem;color:var(--color-danger)">Memory data unavailable</div>';
    return;
  }

  // Update percentage
  const percentEl = document.getElementById(`${id}-percent`);
  if (percentEl) percentEl.textContent = mem.usagePercent;

  // Update details
  const detailsEl = document.getElementById(`${id}-details`);
  if (detailsEl) {
    detailsEl.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text-muted)">Used</span>
        <span style="color:var(--text-primary);font-weight:500">${formatBytes(mem.used)}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text-muted)">Available</span>
        <span style="color:var(--text-primary);font-weight:500">${formatBytes(mem.available)}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text-muted)">Total</span>
        <span style="color:var(--text-primary);font-weight:500">${formatBytes(mem.total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text-muted)">Buffers</span>
        <span style="color:var(--text-primary);font-weight:500">${formatBytes(mem.buffers)}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--text-muted)">Cached</span>
        <span style="color:var(--text-primary);font-weight:500">${formatBytes(mem.cached)}</span>
      </div>
    `;
  }

  // Donut chart
  const canvas = document.getElementById(`${id}-donut`);
  if (!canvas) return;

  const style = getComputedStyle(document.documentElement);

  if (!charts[id]) {
    charts[id] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Used', 'Buffers', 'Cached', 'Free'],
        datasets: [{
          data: [0, 0, 0, 0],
          backgroundColor: [
            style.getPropertyValue('--chart-1').trim(),
            style.getPropertyValue('--chart-2').trim(),
            style.getPropertyValue('--chart-3').trim(),
            style.getPropertyValue('--chart-grid').trim(),
          ],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '72%',
        animation: { duration: 400 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  }

  try {
    const usedReal = mem.used - (mem.buffers + mem.cached);
    charts[id].data.datasets[0].data = [
      Math.max(0, usedReal),
      mem.buffers,
      mem.cached,
      mem.free,
    ];
    charts[id].update('none');
  } catch (err) {
    console.error('[MemoryWidget] Chart update failed:', err);
  }
}

export function destroy(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}
