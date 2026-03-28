/**
 * Shared utility functions.
 */

/**
 * Format bytes to a human-readable string.
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0 || bytes == null) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${units[i]}`;
}

/**
 * Format bytes per second to human-readable rate.
 */
export function formatRate(bytesPerSec, decimals = 1) {
  if (bytesPerSec === 0 || bytesPerSec == null) return '0 B/s';
  const k = 1024;
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(Math.abs(bytesPerSec)) / Math.log(k));
  return `${(bytesPerSec / Math.pow(k, i)).toFixed(decimals)} ${units[i]}`;
}

/**
 * Format seconds to human-readable uptime.
 */
export function formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

/**
 * Format a timestamp to locale time string.
 */
export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Map signal strength (dBm) to quality string.
 */
export function signalQuality(dbm) {
  if (dbm == null) return { label: 'N/A', level: 0 };
  if (dbm >= -50) return { label: 'Excellent', level: 4 };
  if (dbm >= -60) return { label: 'Good', level: 3 };
  if (dbm >= -70) return { label: 'Fair', level: 2 };
  return { label: 'Weak', level: 1 };
}

/**
 * Get gauge fill CSS class based on percentage.
 */
export function gaugeClass(percent) {
  if (percent >= 90) return 'danger';
  if (percent >= 75) return 'warning';
  return '';
}

/**
 * Create an HTML element with optional classes and attributes.
 */
export function el(tag, className = '', attrs = {}) {
  const elem = document.createElement(tag);
  if (className) elem.className = className;
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'text') elem.textContent = val;
    else if (key === 'html') elem.innerHTML = val;
    else elem.setAttribute(key, val);
  }
  return elem;
}

/**
 * Shared Chart.js defaults for our theme.
 */
export function getChartDefaults() {
  const style = getComputedStyle(document.documentElement);
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: style.getPropertyValue('--bg-elevated').trim(),
        titleColor: style.getPropertyValue('--text-primary').trim(),
        bodyColor: style.getPropertyValue('--text-secondary').trim(),
        borderColor: style.getPropertyValue('--border-color').trim(),
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        titleFont: { family: 'Inter', weight: '600' },
        bodyFont: { family: 'Inter' },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { color: style.getPropertyValue('--chart-grid').trim() },
        ticks: {
          color: style.getPropertyValue('--text-muted').trim(),
          font: { family: 'Inter', size: 10 },
          maxTicksLimit: 8,
        },
      },
      y: {
        display: true,
        grid: { color: style.getPropertyValue('--chart-grid').trim() },
        ticks: {
          color: style.getPropertyValue('--text-muted').trim(),
          font: { family: 'Inter', size: 10 },
        },
      },
    },
  };
}

/**
 * Debounce a function.
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Escape HTML characters to prevent XSS.
 */
export function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
