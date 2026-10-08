// ============================================================
// TherapyAdmin AI — tor.js
// Tor Exit Node checking utility with in-memory caching
// ============================================================

const https = require('https');

let torExitNodes = new Set();
let lastFetchTime = 0;
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Fetches the Tor bulk exit list from check.torproject.org
 * @returns {Promise<boolean>} Success status
 */
function fetchTorExitNodes() {
  return new Promise((resolve) => {
    console.log('[TOR] Fetching exit nodes list...');
    https.get('https://check.torproject.org/torbulkexitlist', (res) => {
      if (res.statusCode !== 200) {
        console.error(`[TOR] Failed to fetch Tor exit nodes: HTTP ${res.statusCode}`);
        return resolve(false);
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const ips = data.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
          
          torExitNodes = new Set(ips);
          lastFetchTime = Date.now();
          console.log(`[TOR] Successfully cached ${torExitNodes.size} Tor exit nodes.`);
          resolve(true);
        } catch (err) {
          console.error('[TOR] Parsing error:', err);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error('[TOR] Fetch error:', err.message);
      resolve(false);
    });
  });
}

// Trigger initial fetch
fetchTorExitNodes();

// Automatically update cache every 6 hours
setInterval(async () => {
  await fetchTorExitNodes();
}, CACHE_DURATION_MS);

/**
 * Checks if an IP is a known Tor Exit Node.
 * Supports loopback detection and simulated Tor checks for local developer convenience.
 * @param {string} ip Client IP address
 * @param {object} [req] Express request object to check for simulation headers/query
 * @returns {boolean}
 */
function isTorIp(ip, req = null) {
  // 1. Check for local testing headers or query overrides
  if (req) {
    if (req.headers['x-simulated-tor'] === 'true' || req.query.simulated_tor === 'true') {
      console.log(`[TOR SIMULATION] Tor status simulated for request from ${ip}`);
      return true;
    }
  }

  // 2. Normalize IPv4-mapped IPv6 addresses (e.g., "::ffff:127.0.0.1")
  let cleanIp = ip || '';
  if (cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.substring(7);
  }
  cleanIp = cleanIp.trim();

  // 3. Loopback exceptions (usually not Tor, unless simulation header is sent above)
  if (cleanIp === '127.0.0.1' || cleanIp === '::1') {
    return false;
  }

  // 4. Perform live cache lookup
  return torExitNodes.has(cleanIp);
}

module.exports = {
  isTorIp,
  refresh: fetchTorExitNodes,
  getCacheSize: () => torExitNodes.size,
  getLastUpdated: () => lastFetchTime
};
