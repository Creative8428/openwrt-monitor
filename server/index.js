import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, closeDatabase } from './database.js';
import { LuciClient } from './luci-client.js';
import { startPolling, stopPolling } from './poller.js';
import apiRoutes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Serve frontend in production
if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Initialize database
console.log('[Server] Initializing database...');
initDatabase();

// Initialize LuCI client and start polling
const routerIp = process.env.ROUTER_IP || '192.168.1.1';
const routerUser = process.env.ROUTER_USERNAME || 'root';
const routerPass = process.env.ROUTER_PASSWORD || '';
const pollInterval = parseInt(process.env.POLL_INTERVAL_SECONDS || '10', 10);

const luciClient = new LuciClient(routerIp, routerUser, routerPass);

async function start() {
  try {
    console.log(`[Server] Connecting to router at ${routerIp}...`);
    await luciClient.login();
    console.log('[Server] Router connection successful!');
  } catch (err) {
    console.warn(
      `[Server] Could not connect to router: ${err.message}. Will retry on next poll cycle.`
    );
  }

  startPolling(luciClient, pollInterval);

  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    if (!isProduction) {
      console.log(`[Server] Frontend dev server: http://localhost:5173`);
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  stopPolling();
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopPolling();
  closeDatabase();
  process.exit(0);
});

start();
