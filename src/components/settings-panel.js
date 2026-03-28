/**
 * Settings panel — theme toggle, router config, layout reset.
 */
import { resetLayout, setUpdateInterval } from './widget-manager.js';
import { api } from '../api.js';

export function initSettingsPanel() {
  const overlay = document.getElementById('settings-overlay');
  const btnSettings = document.getElementById('btn-settings');
  const btnClose = document.getElementById('settings-close');

  btnSettings.addEventListener('click', () => {
    overlay.classList.add('active');
    loadSettings();
  });

  btnClose.addEventListener('click', () => overlay.classList.remove('active'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });

  // Theme toggles
  const themeButtons = document.querySelectorAll('[data-theme-value]');
  themeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.themeValue;
      setTheme(theme);
      themeButtons.forEach((b) => b.classList.toggle('active', b.dataset.themeValue === theme));
    });
  });

  // Reset layout
  document.getElementById('btn-reset-layout').addEventListener('click', async () => {
    if (confirm('Reset dashboard layout to defaults?')) {
      await resetLayout();
      overlay.classList.remove('active');
    }
  });

  // Poll interval change
  const pollInput = document.getElementById('setting-poll-interval');
  pollInput.addEventListener('change', () => {
    const val = parseInt(pollInput.value, 10);
    if (val >= 5 && val <= 300) {
      setUpdateInterval(val);
      saveSettingsToServer();
    }
  });
}

export function initThemeToggle() {
  const btn = document.getElementById('btn-theme');
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);

    // Sync settings panel buttons
    document.querySelectorAll('[data-theme-value]').forEach((b) => {
      b.classList.toggle('active', b.dataset.themeValue === next);
    });
  });

  // Load saved theme
  const saved = localStorage.getItem('owrt-monitor-theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('owrt-monitor-theme', theme);

  // Update meta theme-color for PWA
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'dark' ? '#0a0f1e' : '#f1f5f9';
  }
}

async function loadSettings() {
  const settings = await api.getSettings();
  if (settings) {
    const pollInput = document.getElementById('setting-poll-interval');
    if (pollInput && settings.poll_interval) pollInput.value = settings.poll_interval;
  }
}

async function saveSettingsToServer() {
  const pollInput = document.getElementById('setting-poll-interval');
  await api.saveSettings({
    theme: document.documentElement.getAttribute('data-theme') || 'dark',
    poll_interval: parseInt(pollInput.value, 10) || 10,
  });
}
