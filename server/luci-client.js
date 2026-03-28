import fetch from 'node-fetch';

/**
 * LuCI JSON-RPC API client for OpenWRT routers.
 * Handles authentication, session management, and data retrieval.
 */
export class LuciClient {
  constructor(host, username, password) {
    if (host.startsWith('http://') || host.startsWith('https://')) {
      this.baseUrl = host;
    } else {
      this.baseUrl = `http://${host}`;
    }
    this.username = username;
    this.password = password;
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * Authenticate with the router and obtain a session token.
   */
  async login() {
    try {
      const res = await fetch(`${this.baseUrl}/cgi-bin/luci/rpc/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          method: 'login',
          params: [this.username, this.password],
        }),
      });

      const data = await res.json();
      if (data.result && data.result !== '00000000000000000000000000000000') {
        this.token = data.result;
        // Sessions typically last 300s on OpenWRT; refresh at 240s
        this.tokenExpiry = Date.now() + 240_000;
        return true;
      }
      throw new Error('Authentication failed — invalid credentials or RPC not enabled');
    } catch (err) {
      console.error('[LuCI] Login error:', err.message);
      this.token = null;
      throw err;
    }
  }

  /**
   * Ensure we have a valid session token, re-authenticating if needed.
   */
  async ensureAuth() {
    if (!this.token || Date.now() > this.tokenExpiry) {
      await this.login();
    }
  }

  /**
   * Generic JSON-RPC call to a LuCI endpoint.
   */
  async rpcCall(endpoint, method, params = []) {
    await this.ensureAuth();

    const url = `${this.baseUrl}/cgi-bin/luci/rpc/${endpoint}?auth=${this.token}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, method, params }),
      });

      if (res.status === 403 || res.status === 401) {
        // Token expired — re-auth and retry once
        this.token = null;
        await this.ensureAuth();
        const retryRes = await fetch(
          `${this.baseUrl}/cgi-bin/luci/rpc/${endpoint}?auth=${this.token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 1, method, params }),
          }
        );
        return (await retryRes.json()).result;
      }

      const data = await res.json();
      return data.result;
    } catch (err) {
      console.error(`[LuCI] RPC ${endpoint}.${method} error:`, err.message);
      return null;
    }
  }

  /**
   * Call a UCI method (for reading router configuration).
   */
  async uciCall(method, params = []) {
    return this.rpcCall('uci', method, params);
  }

  /**
   * Call a sys method (for system information).
   */
  async sysCall(method, params = []) {
    return this.rpcCall('sys', method, params);
  }

  /**
   * Execute a shell command on the router and return output.
   */
  async exec(command) {
    return this.sysCall('exec', [command]);
  }

  // ─── High-level data methods ───────────────────────────────────────

  /**
   * Get CPU utilization from /proc/stat.
   * Returns { usage, cores, raw } — usage is 0-100%.
   */
  async getCpuInfo() {
    try {
      const stat = await this.exec('cat /proc/stat');
      if (!stat) return null;

      const lines = stat.trim().split('\n');
      const cpuLine = lines[0]; // "cpu  user nice system idle iowait irq softirq steal"
      const parts = cpuLine.split(/\s+/).slice(1).map(Number);
      const [user, nice, system, idle, iowait, irq, softirq, steal] = parts;

      const total = user + nice + system + idle + iowait + irq + softirq + steal;
      const active = total - idle - iowait;

      return {
        usage: Math.round((active / total) * 100),
        total,
        active,
        idle: idle + iowait,
        cores: lines.filter(l => l.startsWith('cpu') && l !== cpuLine).length,
        raw: { user, nice, system, idle, iowait, irq, softirq, steal },
      };
    } catch (err) {
      console.error('[LuCI] getCpuInfo error:', err.message);
      return null;
    }
  }

  /**
   * Get memory usage from /proc/meminfo.
   * Returns { total, free, used, available, buffers, cached, usagePercent }.
   */
  async getMemoryInfo() {
    try {
      const meminfo = await this.exec('cat /proc/meminfo');
      if (!meminfo) return null;

      const parse = (key) => {
        const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
        return match ? parseInt(match[1], 10) * 1024 : 0; // Convert kB to bytes
      };

      const total = parse('MemTotal');
      const free = parse('MemFree');
      const buffers = parse('Buffers');
      const cached = parse('Cached');
      const available = parse('MemAvailable') || (free + buffers + cached);
      const used = total - available;

      return {
        total,
        free,
        used,
        available,
        buffers,
        cached,
        usagePercent: Math.round((used / total) * 100),
      };
    } catch (err) {
      console.error('[LuCI] getMemoryInfo error:', err.message);
      return null;
    }
  }

  /**
   * Get system load averages and uptime.
   */
  async getLoadAndUptime() {
    try {
      const uptime = await this.exec('cat /proc/uptime');
      const loadavg = await this.exec('cat /proc/loadavg');

      if (!uptime || !loadavg) return null;

      const uptimeSeconds = Math.floor(parseFloat(uptime.split(' ')[0]));
      const [load1, load5, load15] = loadavg.split(' ').slice(0, 3).map(Number);

      return {
        uptimeSeconds,
        load1,
        load5,
        load15,
      };
    } catch (err) {
      console.error('[LuCI] getLoadAndUptime error:', err.message);
      return null;
    }
  }

  /**
   * Get temperature readings from thermal zones.
   */
  async getTemperature() {
    try {
      const temp = await this.exec(
        'for f in /sys/class/thermal/thermal_zone*/temp; do cat "$f" 2>/dev/null; done'
      );
      if (!temp || !temp.trim()) return null;

      const temps = temp
        .trim()
        .split('\n')
        .map((t) => parseFloat(t) / 1000) // millidegrees → degrees
        .filter((t) => !isNaN(t) && t > 0 && t < 150);

      return {
        zones: temps,
        max: Math.max(...temps),
        avg: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
      };
    } catch (err) {
      console.error('[LuCI] getTemperature error:', err.message);
      return null;
    }
  }

  /**
   * Get per-interface network traffic from /proc/net/dev.
   * Returns an object keyed by interface name.
   */
  async getNetworkTraffic() {
    try {
      const netdev = await this.exec('cat /proc/net/dev');
      if (!netdev) return null;

      const interfaces = {};
      const lines = netdev.trim().split('\n').slice(2); // Skip headers

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const name = parts[0].replace(':', '');
        if (name === 'lo') continue; // Skip loopback

        interfaces[name] = {
          rxBytes: parseInt(parts[1], 10),
          rxPackets: parseInt(parts[2], 10),
          rxErrors: parseInt(parts[3], 10),
          rxDropped: parseInt(parts[4], 10),
          txBytes: parseInt(parts[9], 10),
          txPackets: parseInt(parts[10], 10),
          txErrors: parseInt(parts[11], 10),
          txDropped: parseInt(parts[12], 10),
        };
      }

      return interfaces;
    } catch (err) {
      console.error('[LuCI] getNetworkTraffic error:', err.message);
      return null;
    }
  }

  /**
   * Get connected devices from DHCP leases.
   */
  async getDHCPLeases() {
    try {
      const leases = await this.exec('cat /tmp/dhcp.leases');
      if (!leases || !leases.trim()) return [];

      return leases
        .trim()
        .split('\n')
        .map((line) => {
          const parts = line.split(' ');
          return {
            expires: parseInt(parts[0], 10),
            mac: parts[1],
            ip: parts[2],
            hostname: parts[3] === '*' ? 'Unknown' : parts[3],
          };
        });
    } catch (err) {
      console.error('[LuCI] getDHCPLeases error:', err.message);
      return [];
    }
  }

  /**
   * Get wireless client information.
   */
  async getWirelessClients() {
    try {
      const output = await this.exec(
        'for iface in $(iwinfo | grep ESSID | cut -d" " -f1); do echo "IFACE:$iface"; iwinfo "$iface" assoclist; done'
      );
      if (!output || !output.trim()) return [];

      const clients = [];
      let currentIface = '';

      for (const line of output.trim().split('\n')) {
        if (line.startsWith('IFACE:')) {
          currentIface = line.replace('IFACE:', '');
        } else if (line.includes('dBm')) {
          const mac = line.trim().split(' ')[0];
          const signalMatch = line.match(/(-?\d+)\s*dBm/);
          const rxRateMatch = line.match(/RX:\s*([\d.]+)\s*MBit/);
          const txRateMatch = line.match(/TX:\s*([\d.]+)\s*MBit/);

          clients.push({
            mac,
            interface: currentIface,
            signal: signalMatch ? parseInt(signalMatch[1], 10) : null,
            rxRate: rxRateMatch ? parseFloat(rxRateMatch[1]) : null,
            txRate: txRateMatch ? parseFloat(txRateMatch[1]) : null,
          });
        }
      }

      return clients;
    } catch (err) {
      console.error('[LuCI] getWirelessClients error:', err.message);
      return [];
    }
  }

  /**
   * Get connection tracking count.
   */
  async getConntrackCount() {
    try {
      const count = await this.exec('cat /proc/sys/net/netfilter/nf_conntrack_count');
      const max = await this.exec('cat /proc/sys/net/netfilter/nf_conntrack_max');

      return {
        current: parseInt((count || '0').trim(), 10),
        max: parseInt((max || '0').trim(), 10),
      };
    } catch (err) {
      console.error('[LuCI] getConntrackCount error:', err.message);
      return { current: 0, max: 0 };
    }
  }

  /**
   * Get storage/disk usage.
   */
  async getStorageInfo() {
    try {
      const df = await this.exec('df -B1 2>/dev/null || df');
      if (!df) return [];

      const lines = df.trim().split('\n').slice(1);
      const mounts = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) continue;

        const filesystem = parts[0];
        // Skip pseudo-filesystems
        if (['tmpfs', 'devtmpfs', 'proc', 'sysfs', 'devpts', 'none'].includes(filesystem))
          continue;

        mounts.push({
          filesystem,
          total: parseInt(parts[1], 10),
          used: parseInt(parts[2], 10),
          available: parseInt(parts[3], 10),
          usagePercent: parseInt(parts[4], 10),
          mount: parts[5],
        });
      }

      return mounts;
    } catch (err) {
      console.error('[LuCI] getStorageInfo error:', err.message);
      return [];
    }
  }

  /**
   * Collect all metrics in a single call.
   */
  async collectAll() {
    const [cpu, memory, loadUptime, temperature, traffic, leases, wireless, conntrack, storage] =
      await Promise.all([
        this.getCpuInfo(),
        this.getMemoryInfo(),
        this.getLoadAndUptime(),
        this.getTemperature(),
        this.getNetworkTraffic(),
        this.getDHCPLeases(),
        this.getWirelessClients(),
        this.getConntrackCount(),
        this.getStorageInfo(),
      ]);

    return {
      timestamp: Date.now(),
      cpu,
      memory,
      loadUptime,
      temperature,
      traffic,
      leases,
      wireless,
      conntrack,
      storage,
    };
  }
}
