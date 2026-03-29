import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'monitor.db');

let db;

/**
 * Initialize the SQLite database and create tables if they don't exist.
 */
export function initDatabase() {
  console.log(`[DB] Opening database at ${DB_PATH}`);
  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      cpu_usage REAL,
      cpu_cores INTEGER,
      mem_total INTEGER,
      mem_used INTEGER,
      mem_available INTEGER,
      mem_usage_percent REAL,
      load_1 REAL,
      load_5 REAL,
      load_15 REAL,
      uptime_seconds INTEGER,
      temp_max REAL,
      temp_avg REAL,
      conntrack_current INTEGER,
      conntrack_max INTEGER
    );

    CREATE TABLE IF NOT EXISTS traffic_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      interface TEXT NOT NULL,
      rx_bytes INTEGER,
      tx_bytes INTEGER,
      rx_rate REAL DEFAULT 0,
      tx_rate REAL DEFAULT 0,
      rx_packets INTEGER,
      tx_packets INTEGER,
      rx_errors INTEGER,
      tx_errors INTEGER
    );

    CREATE TABLE IF NOT EXISTS device_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      mac TEXT,
      ip TEXT,
      hostname TEXT,
      rx_bytes INTEGER DEFAULT 0,
      tx_bytes INTEGER DEFAULT 0,
      signal_dbm INTEGER,
      interface TEXT
    );

    CREATE TABLE IF NOT EXISTS dashboard_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      layout_json TEXT,
      theme TEXT DEFAULT 'dark',
      poll_interval INTEGER DEFAULT 10,
      updated_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_system_ts ON system_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_traffic_ts ON traffic_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_device_ts ON device_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_traffic_iface ON traffic_snapshots(interface, timestamp);
  `);

  // Ensure settings row exists
  const row = db.prepare('SELECT id FROM dashboard_settings WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO dashboard_settings (id, theme, poll_interval, updated_at) VALUES (1, ?, ?, ?)').run(
      'dark',
      10,
      Date.now()
    );
  }

  return db;
}

/**
 * Insert a full system + traffic + device snapshot.
 */
export function insertSnapshot(data) {
  const { timestamp, cpu, memory, loadUptime, temperature, conntrack, traffic, leases, wireless } =
    data;

  // System snapshot
  const insertSystem = db.prepare(`
    INSERT INTO system_snapshots
      (timestamp, cpu_usage, cpu_cores, mem_total, mem_used, mem_available, mem_usage_percent,
       load_1, load_5, load_15, uptime_seconds, temp_max, temp_avg, conntrack_current, conntrack_max)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSystem.run(
    timestamp,
    cpu?.usage ?? null,
    cpu?.cores ?? null,
    memory?.total ?? null,
    memory?.used ?? null,
    memory?.available ?? null,
    memory?.usagePercent ?? null,
    loadUptime?.load1 ?? null,
    loadUptime?.load5 ?? null,
    loadUptime?.load15 ?? null,
    loadUptime?.uptimeSeconds ?? null,
    temperature?.max ?? null,
    temperature?.avg ?? null,
    conntrack?.current ?? null,
    conntrack?.max ?? null
  );

  // Traffic snapshots (per interface)
  if (traffic) {
    const insertTraffic = db.prepare(`
      INSERT INTO traffic_snapshots
        (timestamp, interface, rx_bytes, tx_bytes, rx_rate, tx_rate, rx_packets, tx_packets, rx_errors, tx_errors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [iface, stats] of Object.entries(traffic)) {
      // Calculate rate from the last snapshot
      const lastTraffic = db
        .prepare(
          'SELECT rx_bytes, tx_bytes, timestamp FROM traffic_snapshots WHERE interface = ? ORDER BY timestamp DESC LIMIT 1'
        )
        .get(iface);

      let rxRate = 0;
      let txRate = 0;
      if (lastTraffic) {
        const timeDelta = (timestamp - lastTraffic.timestamp) / 1000;
        if (timeDelta > 0) {
          const rxDelta = stats.rxBytes - lastTraffic.rx_bytes;
          const txDelta = stats.txBytes - lastTraffic.tx_bytes;
          // Handle counter wraps (32-bit counters on some routers)
          rxRate = rxDelta >= 0 ? rxDelta / timeDelta : 0;
          txRate = txDelta >= 0 ? txDelta / timeDelta : 0;
        }
      }

      insertTraffic.run(
        timestamp,
        iface,
        stats.rxBytes,
        stats.txBytes,
        rxRate,
        txRate,
        stats.rxPackets,
        stats.txPackets,
        stats.rxErrors,
        stats.txErrors
      );
    }
  }

  // Device snapshots — merge lease + wireless info
  if (leases && leases.length > 0) {
    const insertDevice = db.prepare(`
      INSERT INTO device_snapshots (timestamp, mac, ip, hostname, signal_dbm, interface)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const wirelessMap = new Map();
    if (wireless) {
      for (const client of wireless) {
        wirelessMap.set(client.mac?.toUpperCase(), client);
      }
    }

    for (const lease of leases) {
      const wClient = wirelessMap.get(lease.mac?.toUpperCase());
      insertDevice.run(
        timestamp,
        lease.mac,
        lease.ip,
        lease.hostname,
        wClient?.signal ?? null,
        wClient?.interface ?? null
      );
    }
  }
}

/**
 * Get historical system data for a given time range.
 */
export function getSystemHistory(rangeMs) {
  const since = Date.now() - rangeMs;
  return db
    .prepare(
      `SELECT timestamp, cpu_usage, mem_usage_percent, mem_used, mem_total,
              load_1, load_5, load_15, uptime_seconds,
              temp_max, temp_avg, conntrack_current, conntrack_max
       FROM system_snapshots WHERE timestamp > ? ORDER BY timestamp ASC`
    )
    .all(since);
}

/**
 * Get the latest system snapshot.
 */
export function getLatestSystem() {
  return db
    .prepare(
      `SELECT * FROM system_snapshots ORDER BY timestamp DESC LIMIT 1`
    )
    .get();
}

/**
 * Get historical traffic data for a given time range, optionally filtered by interface.
 */
export function getTrafficHistory(rangeMs, iface = null) {
  const since = Date.now() - rangeMs;
  if (iface) {
    return db
      .prepare(
        `SELECT timestamp, interface, rx_bytes, tx_bytes, rx_rate, tx_rate
         FROM traffic_snapshots WHERE timestamp > ? AND interface = ? ORDER BY timestamp ASC`
      )
      .all(since, iface);
  }
  return db
    .prepare(
      `SELECT timestamp, interface, rx_bytes, tx_bytes, rx_rate, tx_rate
       FROM traffic_snapshots WHERE timestamp > ? ORDER BY timestamp ASC`
    )
    .all(since);
}

/**
 * Get the latest traffic snapshot (one entry per interface).
 */
export function getLatestTraffic() {
  return db
    .prepare(
      `SELECT t.* FROM traffic_snapshots t
       INNER JOIN (
         SELECT interface, MAX(timestamp) as max_ts
         FROM traffic_snapshots GROUP BY interface
       ) latest ON t.interface = latest.interface AND t.timestamp = latest.max_ts`
    )
    .all();
}

/**
 * Get latest connected devices.
 */
export function getLatestDevices() {
  const latestTs = db
    .prepare('SELECT MAX(timestamp) as ts FROM device_snapshots')
    .get();
  if (!latestTs?.ts) return [];

  return db
    .prepare('SELECT * FROM device_snapshots WHERE timestamp = ?')
    .all(latestTs.ts);
}

/**
 * Get top devices by total traffic in the given time range.
 */
export function getTopDevices(rangeMs, limit = 10) {
  const since = Date.now() - rangeMs;
  return db
    .prepare(
      `SELECT mac, ip, hostname,
              COUNT(*) as sample_count,
              MAX(signal_dbm) as signal_dbm,
              MAX(interface) as interface
       FROM device_snapshots
       WHERE timestamp > ?
       GROUP BY mac
       ORDER BY sample_count DESC
       LIMIT ?`
    )
    .all(since, limit);
}

/**
 * Get/save dashboard settings.
 */
export function getSettings() {
  return db.prepare('SELECT * FROM dashboard_settings WHERE id = 1').get();
}

export function saveSettings(settings) {
  const { layout_json, theme, poll_interval } = settings;
  db.prepare(
    `UPDATE dashboard_settings SET layout_json = ?, theme = ?, poll_interval = ?, updated_at = ? WHERE id = 1`
  ).run(layout_json || null, theme || 'dark', poll_interval || 10, Date.now());
}

/**
 * Purge data older than the given number of days.
 */
export function purgeOldData(days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const r1 = db.prepare('DELETE FROM system_snapshots WHERE timestamp < ?').run(cutoff);
  const r2 = db.prepare('DELETE FROM traffic_snapshots WHERE timestamp < ?').run(cutoff);
  const r3 = db.prepare('DELETE FROM device_snapshots WHERE timestamp < ?').run(cutoff);

  const total = r1.changes + r2.changes + r3.changes;
  if (total > 0) {
    console.log(`[DB] Purged ${total} records older than ${days} days`);
  }
  return total;
}

/**
 * Close the database connection.
 */
export function closeDatabase() {
  if (db) db.close();
}
