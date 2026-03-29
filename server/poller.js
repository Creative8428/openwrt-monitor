import cron from 'node-cron';
import { insertSnapshot, purgeOldData } from './database.js';

let pollingInterval = null;
let luciClient = null;
let latestSnapshot = null;

/**
 * Start the polling service that periodically collects data from the router.
 */
export function startPolling(client, intervalSeconds = 10) {
  luciClient = client;

  // Do an initial poll immediately
  poll();

  // Schedule subsequent polls
  // node-cron doesn't support sub-minute intervals natively, so use setInterval
  if (intervalSeconds < 60) {
    pollingInterval = setInterval(poll, intervalSeconds * 1000);
  } else {
    // For intervals >= 60s, use cron for reliability
    const minutes = Math.floor(intervalSeconds / 60);
    cron.schedule(`*/${minutes} * * * *`, poll);
  }

  // Schedule daily data purge at 3 AM
  cron.schedule('0 3 * * *', () => {
    purgeOldData(30);
    console.log('[Poller] Daily data purge completed');
  });

  console.log(`[Poller] Started — polling every ${intervalSeconds}s`);
}

/**
 * Perform a single poll cycle.
 */
async function poll() {
  try {
    const data = await luciClient.collectAll();
    if (data) {
      insertSnapshot(data);
      latestSnapshot = data;
    }
  } catch (err) {
    console.error('[Poller] Poll cycle error:', err.message);
  }
}

/**
 * Get the latest in-memory snapshot (faster than DB query).
 */
export function getLatestSnapshot() {
  return latestSnapshot;
}

/**
 * Update the polling interval at runtime.
 */
export function setPollingInterval(seconds) {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  pollingInterval = setInterval(poll, seconds * 1000);
  console.log(`[Poller] Interval updated to ${seconds}s`);
}

/**
 * Stop polling.
 */
export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  console.log('[Poller] Stopped');
}
