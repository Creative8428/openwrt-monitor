/**
 * OpenWRT Monitor — Main entry point.
 * Initializes the dashboard, widget manager, and settings.
 */

import { initWidgetManager } from './components/widget-manager.js';
import { initSettingsPanel, initThemeToggle } from './components/settings-panel.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Theme (load first to avoid flash)
  initThemeToggle();

  // Widget grid
  initWidgetManager();

  // Settings panel
  initSettingsPanel();

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('[PWA] Service worker registered'))
      .catch((err) => console.warn('[PWA] SW registration failed:', err));
  }
});
