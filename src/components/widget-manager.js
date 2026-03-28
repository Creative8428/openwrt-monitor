/**
 * Widget Manager — handles widget lifecycle, Gridstack integration,
 * and the Add Widget modal.
 */

import { api } from '../api.js';

// Widget registry — lazy-loaded modules
const WIDGET_REGISTRY = [
  { type: 'cpu', name: 'CPU Usage', icon: '⚡', desc: 'Real-time CPU utilization', w: 4, h: 3, minW: 2, minH: 2 },
  { type: 'memory', name: 'Memory', icon: '🧠', desc: 'RAM usage breakdown', w: 4, h: 3, minW: 2, minH: 2 },
  { type: 'traffic', name: 'Traffic', icon: '📶', desc: 'Network traffic per interface', w: 6, h: 3, minW: 3, minH: 2 },
  { type: 'temperature', name: 'Temperature', icon: '🌡️', desc: 'Thermal zone readings', w: 3, h: 3, minW: 2, minH: 2 },
  { type: 'devices', name: 'Devices', icon: '📱', desc: 'Connected devices & top consumer', w: 6, h: 4, minW: 3, minH: 3 },
  { type: 'uptime', name: 'Uptime', icon: '⏱️', desc: 'System uptime display', w: 3, h: 2, minW: 2, minH: 2 },
  { type: 'storage', name: 'Storage', icon: '💾', desc: 'Disk / flash usage', w: 3, h: 3, minW: 2, minH: 2 },
  { type: 'connections', name: 'Connections', icon: '🔗', desc: 'Active connection count', w: 3, h: 3, minW: 2, minH: 2 },
  { type: 'wireless', name: 'Wireless', icon: '📡', desc: 'WiFi clients & signal strength', w: 6, h: 4, minW: 3, minH: 3 },
  { type: 'load', name: 'System Load', icon: '📊', desc: 'Load average (1/5/15 min)', w: 4, h: 3, minW: 2, minH: 2 },
];

// Widget module cache
const moduleCache = {};

// Active widgets on the grid
const activeWidgets = new Map();

let grid = null;
let updateInterval = null;

/**
 * Initialize the widget manager.
 */
export function initWidgetManager() {
  // Initialize Gridstack
  grid = GridStack.init({
    column: 12,
    cellHeight: 80,
    margin: 8,
    animate: true,
    float: false,
    draggable: { handle: '.widget-header' },
    resizable: { handles: 'se,sw' },
    removable: false,
    acceptWidgets: false,
  }, '#grid-stack');

  // Save layout on change
  grid.on('change', saveLayout);

  // Setup modal
  setupAddWidgetModal();

  // Load saved layout or use defaults
  loadLayout();

  // Start update loop
  startUpdating();
}

/**
 * Load a widget module dynamically.
 */
async function loadWidgetModule(type) {
  if (moduleCache[type]) return moduleCache[type];

  try {
    const module = await import(`./widgets/${type}-widget.js`);
    moduleCache[type] = module;
    return module;
  } catch (err) {
    console.error(`[WidgetManager] Failed to load widget "${type}":`, err);
    return null;
  }
}

/**
 * Add a widget to the grid.
 */
export async function addWidget(type, opts = {}) {
  const reg = WIDGET_REGISTRY.find((w) => w.type === type);
  if (!reg) return;

  const module = await loadWidgetModule(type);
  if (!module) return;

  const id = `widget-${type}-${Date.now()}`;

  // Create widget content
  const content = document.createElement('div');
  content.id = id;
  content.dataset.widgetType = type;

  // Widget header
  content.innerHTML = `
    <div class="widget-header">
      <span class="widget-title">${reg.icon} ${reg.name}</span>
      <div class="widget-actions">
        <button class="widget-action-btn" data-action="remove" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="widget-body" id="${id}-body"></div>
  `;

  // Add to grid
  const gridItem = grid.addWidget({
    content: content.outerHTML,
    w: opts.w ?? reg.w,
    h: opts.h ?? reg.h,
    x: opts.x,
    y: opts.y,
    minW: reg.minW,
    minH: reg.minH,
    id: id,
  });

  // Initialize widget
  const bodyEl = document.getElementById(`${id}-body`);
  if (bodyEl && module.init) {
    module.init(bodyEl, id);
  }

  // Store active widget
  activeWidgets.set(id, { type, module, bodyEl });

  // Bind remove button
  const removeBtn = gridItem.querySelector('[data-action="remove"]');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => removeWidget(id));
  }

  saveLayout();
  return id;
}

/**
 * Remove a widget from the grid.
 */
function removeWidget(id) {
  const widget = activeWidgets.get(id);
  if (widget?.module?.destroy) {
    widget.module.destroy(id);
  }
  activeWidgets.delete(id);

  // Find and remove the grid item
  const items = grid.getGridItems();
  const item = items.find((el) => {
    const content = el.querySelector(`#${CSS.escape(id)}`);
    return !!content;
  });

  if (item) {
    grid.removeWidget(item);
  }
  saveLayout();
}

/**
 * Update all active widgets with fresh data.
 */
async function updateAllWidgets() {
  const status = await api.status();

  for (const [id, widget] of activeWidgets) {
    if (widget.module?.update) {
      try {
        await widget.module.update(widget.bodyEl, id, status);
      } catch (err) {
        console.error(`[WidgetManager] Update failed for ${widget.type}:`, err);
      }
    }
  }

  // Update health status
  updateHealthStatus(status);

  // Hide global loader once actual data has populated the widgets
  if (status && status.cpu) {
    const loader = document.getElementById('global-loader');
    if (loader && !loader.classList.contains('hidden')) {
      loader.classList.add('hidden');
    }
  }
}

/**
 * Update the router connection status indicator.
 */
function updateHealthStatus(status) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');

  if (status && status.cpu) {
    dot.className = 'status-dot connected';
    text.textContent = 'Connected';
  } else if (status?.status === 'waiting') {
    dot.className = 'status-dot';
    text.textContent = 'Waiting...';
  } else {
    dot.className = 'status-dot error';
    text.textContent = 'Disconnected';
  }
}

/**
 * Start the periodic update loop.
 */
function startUpdating() {
  updateAllWidgets(); // Immediate first update
  updateInterval = setInterval(updateAllWidgets, 10_000); // 10s default
}

/**
 * Set the polling interval.
 */
export function setUpdateInterval(seconds) {
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = setInterval(updateAllWidgets, seconds * 1000);
}

/**
 * Save current layout to localStorage.
 */
function saveLayout() {
  const items = grid.save(false);
  const layout = items.map((item) => {
    const el = typeof item.el === 'string' ? document.querySelector(item.el) : item.el;
    const widgetEl = el?.querySelector('[data-widget-type]');
    return {
      type: widgetEl?.dataset.widgetType,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    };
  }).filter((i) => i.type);

  localStorage.setItem('owrt-monitor-layout', JSON.stringify(layout));
}

/**
 * Load layout from localStorage or set up defaults.
 */
async function loadLayout() {
  const saved = localStorage.getItem('owrt-monitor-layout');

  if (saved) {
    try {
      const layout = JSON.parse(saved);
      for (const item of layout) {
        await addWidget(item.type, { x: item.x, y: item.y, w: item.w, h: item.h });
      }
      return;
    } catch (err) {
      console.warn('[WidgetManager] Failed to load saved layout:', err);
    }
  }

  // Default layout
  await addWidget('cpu', { x: 0, y: 0, w: 4, h: 3 });
  await addWidget('memory', { x: 4, y: 0, w: 4, h: 3 });
  await addWidget('uptime', { x: 8, y: 0, w: 4, h: 2 });
  await addWidget('traffic', { x: 0, y: 3, w: 6, h: 3 });
  await addWidget('temperature', { x: 6, y: 3, w: 3, h: 3 });
  await addWidget('load', { x: 9, y: 3, w: 3, h: 3 });
  await addWidget('devices', { x: 0, y: 6, w: 6, h: 4 });
  await addWidget('connections', { x: 6, y: 6, w: 3, h: 3 });
  await addWidget('storage', { x: 9, y: 6, w: 3, h: 3 });
}

/**
 * Reset the layout to defaults.
 */
export async function resetLayout() {
  // Remove all widgets
  for (const [id, widget] of activeWidgets) {
    if (widget.module?.destroy) widget.module.destroy(id);
  }
  activeWidgets.clear();
  grid.removeAll();
  localStorage.removeItem('owrt-monitor-layout');

  // Reload defaults
  await loadLayout();
}

/**
 * Setup the Add Widget modal.
 */
function setupAddWidgetModal() {
  const modal = document.getElementById('modal-add-widget');
  const picker = document.getElementById('widget-picker');
  const btnAdd = document.getElementById('btn-add-widget');
  const btnClose = document.getElementById('modal-close-add');

  // Populate widget picker
  for (const reg of WIDGET_REGISTRY) {
    const item = document.createElement('div');
    item.className = 'widget-picker-item';
    item.dataset.type = reg.type;
    item.innerHTML = `
      <span class="widget-picker-icon">${reg.icon}</span>
      <span class="widget-picker-name">${reg.name}</span>
      <span class="widget-picker-desc">${reg.desc}</span>
    `;
    item.addEventListener('click', async () => {
      await addWidget(reg.type);
      modal.classList.remove('active');
    });
    picker.appendChild(item);
  }

  btnAdd.addEventListener('click', () => modal.classList.add('active'));
  btnClose.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

export { WIDGET_REGISTRY };
