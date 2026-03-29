import { Router } from 'express';
import {
  getLatestSystem,
  getSystemHistory,
  getLatestTraffic,
  getTrafficHistory,
  getLatestDevices,
  getTopDevices,
  getSettings,
  saveSettings,
} from './database.js';
import { getLatestSnapshot, setPollingInterval } from './poller.js';

const router = Router();

// ─── Time range parser ───────────────────────────────────────────────
function parseRange(rangeStr) {
  const ranges = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return ranges[rangeStr] || ranges['1h'];
}

// ─── Health check ────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  const snapshot = getLatestSnapshot();
  res.json({
    status: 'ok',
    routerConnected: !!snapshot,
    lastPoll: snapshot?.timestamp || null,
    uptime: process.uptime(),
  });
});

// ─── Current system status ───────────────────────────────────────────
router.get('/status', (req, res) => {
  const snapshot = getLatestSnapshot();
  if (!snapshot) {
    return res.json({ status: 'waiting', message: 'Waiting for first data poll...' });
  }

  res.json({
    timestamp: snapshot.timestamp,
    cpu: snapshot.cpu,
    memory: snapshot.memory,
    loadUptime: snapshot.loadUptime,
    temperature: snapshot.temperature,
    conntrack: snapshot.conntrack,
    storage: snapshot.storage,
  });
});

// ─── System history ──────────────────────────────────────────────────
router.get('/system/history', (req, res) => {
  const range = parseRange(req.query.range);
  const history = getSystemHistory(range);

  // Downsample if too many points (max ~500 for chart performance)
  const result = downsample(history, 500);
  res.json(result);
});

// ─── Current traffic ─────────────────────────────────────────────────
router.get('/traffic', (req, res) => {
  const traffic = getLatestTraffic();
  res.json(traffic);
});

// ─── Traffic history ─────────────────────────────────────────────────
router.get('/traffic/history', (req, res) => {
  const range = parseRange(req.query.range);
  const iface = req.query.interface || null;
  const history = getTrafficHistory(range, iface);
  const result = downsample(history, 500);
  res.json(result);
});

// ─── Connected devices ──────────────────────────────────────────────
router.get('/devices', (req, res) => {
  const snapshot = getLatestSnapshot();
  const devices = getLatestDevices();

  // Merge in-memory leases with DB device data
  const leases = snapshot?.leases || [];
  const wireless = snapshot?.wireless || [];

  // Build map of wireless clients
  const wirelessMap = new Map();
  for (const client of wireless) {
    wirelessMap.set(client.mac?.toUpperCase(), client);
  }

  // Enrich devices with wireless info
  const enriched = leases.map((lease) => {
    const wClient = wirelessMap.get(lease.mac?.toUpperCase());
    return {
      ...lease,
      signal: wClient?.signal ?? null,
      rxRate: wClient?.rxRate ?? null,
      txRate: wClient?.txRate ?? null,
      wifiInterface: wClient?.interface ?? null,
      isWireless: !!wClient,
    };
  });

  res.json(enriched);
});

// ─── Top devices by activity ─────────────────────────────────────────
router.get('/devices/top', (req, res) => {
  const range = parseRange(req.query.range || '24h');
  const top = getTopDevices(range, 10);
  res.json(top);
});

// ─── Wireless clients ───────────────────────────────────────────────
router.get('/wireless', (req, res) => {
  const snapshot = getLatestSnapshot();
  res.json(snapshot?.wireless || []);
});

// ─── Storage ─────────────────────────────────────────────────────────
router.get('/storage', (req, res) => {
  const snapshot = getLatestSnapshot();
  res.json(snapshot?.storage || []);
});

// ─── Connections ─────────────────────────────────────────────────────
router.get('/connections', (req, res) => {
  const snapshot = getLatestSnapshot();
  res.json(snapshot?.conntrack || { current: 0, max: 0 });
});

// ─── Settings ────────────────────────────────────────────────────────
router.get('/settings', (req, res) => {
  const settings = getSettings();
  res.json({
    ...settings,
    router_ip: process.env.ROUTER_IP || 'Unknown',
  });
});

router.post('/settings', (req, res) => {
  saveSettings(req.body);

  const interval = parseInt(req.body.poll_interval, 10);
  if (interval >= 5 && interval <= 300) {
    setPollingInterval(interval);
  }

  res.json({ success: true });
});

// ─── Utility: Downsample an array to max N points ───────────────────
function downsample(data, maxPoints) {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  const result = [];
  for (let i = 0; i < data.length; i += step) {
    result.push(data[i]);
  }
  // Always include the last point
  if (result[result.length - 1] !== data[data.length - 1]) {
    result.push(data[data.length - 1]);
  }
  return result;
}

export default router;
