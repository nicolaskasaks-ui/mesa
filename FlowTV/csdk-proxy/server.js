#!/usr/bin/env node
/**
 * FlowTV CSDK Proxy Server
 *
 * Runs the Minerva CSDK in a headless Chrome browser and exposes
 * real Flow API data via a local REST endpoint.
 *
 * The Apple TV app connects to this server to get real channel data,
 * session tokens, and playback URLs.
 */

const puppeteer = require('puppeteer-core');
const express = require('express');
const path = require('path');

const app = express();
const PORT = 8765;

let browser = null;
let page = null;
let isReady = false;
let capturedData = {
  channels: [],
  session: null,
  apiResponses: {},
  fetchLog: []
};

// Chrome path on macOS
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SMARTTV_URL = 'https://fenix-smarttv.dev.app.flow.com.ar/';

// Read token from command line or file
const TOKEN = process.argv[2] || (() => {
  try { return require('fs').readFileSync('/tmp/flow_token.txt', 'utf8').trim(); }
  catch { return null; }
})();

if (!TOKEN) {
  console.error('Usage: node server.js <flow_access_token>');
  console.error('  Or place token in /tmp/flow_token.txt');
  process.exit(1);
}

console.log(`[CSDK Proxy] Token loaded (${TOKEN.length} chars)`);

// =====================
// Express API endpoints
// =====================

app.get('/status', (req, res) => {
  res.json({
    ready: isReady,
    channelCount: capturedData.channels.length,
    hasSession: !!capturedData.session,
    fetchLog: capturedData.fetchLog.slice(-20)
  });
});

app.get('/channels', (req, res) => {
  res.json(capturedData.channels);
});

app.get('/session', (req, res) => {
  res.json(capturedData.session || { error: 'No session yet' });
});

app.get('/api/:category', (req, res) => {
  const data = capturedData.apiResponses[req.params.category];
  if (data) {
    res.json(data);
  } else {
    res.json({ error: `No data for ${req.params.category}`, available: Object.keys(capturedData.apiResponses) });
  }
});

// Force refresh - navigate to home to trigger channel loading
app.post('/refresh', async (req, res) => {
  if (!page) return res.json({ error: 'Browser not ready' });
  try {
    await page.evaluate(() => window.location.hash = '#/home');
    res.json({ ok: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Execute arbitrary CSDK request via the page
app.get('/csdk/:service/:operation', async (req, res) => {
  if (!page) return res.json({ error: 'Browser not ready' });
  const { service, operation } = req.params;
  const params = req.query;

  try {
    const result = await page.evaluate(async (svc, op, p) => {
      // Try to access the CSDK through the SmartTV app's module scope
      // This requires the CSDK to be exposed (see injection below)
      if (window.__csdk_request) {
        return await window.__csdk_request(svc, op, p);
      }
      return { error: 'CSDK not available' };
    }, service, operation, params);

    res.json(result);
  } catch (e) {
    res.json({ error: e.message });
  }
});

// =====================
// Puppeteer Browser Setup
// =====================

async function startBrowser() {
  console.log('[CSDK Proxy] Launching headless Chrome...');

  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080'
    ]
  });

  page = await browser.newPage();

  // Set SmartTV user agent
  await page.setUserAgent('Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  // Enable request interception to log all network traffic
  await page.setRequestInterception(true);

  page.on('request', request => {
    request.continue();
  });

  page.on('response', async response => {
    const url = response.url();
    const status = response.status();

    // Skip static assets
    if (/\.(js|css|png|jpg|svg|woff|ico|map)(\?|$)/.test(url)) return;

    const entry = { url: url.substring(0, 200), status, time: new Date().toISOString() };
    capturedData.fetchLog.push(entry);
    if (capturedData.fetchLog.length > 100) capturedData.fetchLog.shift();

    console.log(`[NET] ${status} ${url.substring(0, 120)}`);

    // Capture channel data
    if (url.includes('/channel') || url.includes('/epg') || url.includes('contentType=live_tv')) {
      try {
        const data = await response.json();
        if (data && (data.channels || data.channel || data.contents)) {
          const channels = data.channels || data.channel || data.contents;
          if (Array.isArray(channels) && channels.length > 0) {
            capturedData.channels = channels;
            capturedData.apiResponses['channels'] = data;
            console.log(`[CSDK Proxy] Captured ${channels.length} channels!`);
            isReady = true;
          }
        }
      } catch {}
    }

    // Capture content lists
    if (url.includes('/content/list') || url.includes('/injector')) {
      try {
        const data = await response.json();
        capturedData.apiResponses['contentList'] = data;
      } catch {}
    }

    // Capture session data
    if (url.includes('/session') || url.includes('/sdkConfig')) {
      try {
        const data = await response.json();
        if (data.token || data.tokens) {
          capturedData.session = data;
          console.log(`[CSDK Proxy] Session captured!`);
        }
        capturedData.apiResponses['session'] = data;
      } catch {}
    }
  });

  // Listen for ALL console messages
  page.on('console', msg => {
    const text = msg.text();
    console.log(`[PAGE:${msg.type()}] ${text.substring(0, 300)}`);
  });

  // Listen for page errors
  page.on('pageerror', err => {
    console.log(`[PAGE:ERROR] ${err.message.substring(0, 300)}`);
  });

  // Inject token into localStorage before page loads
  console.log('[CSDK Proxy] Pre-filling localStorage with token...');

  // Intercept WebSocket at prototype level BEFORE page loads
  await page.evaluateOnNewDocument((token) => {
    const origAddEventListener = WebSocket.prototype.addEventListener;
    const origOnMessageDesc = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');

    // Track all WebSocket instances and their message handlers
    const wsTracker = [];
    window.__wsTracker = wsTracker;

    // Wrap addEventListener to catch 'message' listeners
    WebSocket.prototype.addEventListener = function(type, handler, options) {
      if (type === 'message' && this.url && this.url.includes('easylogin')) {
        console.log('[Bridge] addEventListener("message") on EasyLogin WS');
        wsTracker.push({ ws: this, handler, method: 'addEventListener' });

        // After a delay, call this handler with our token
        const self = this;
        setTimeout(() => {
          console.log('[Bridge] Sending fake token via addEventListener handler');
          // Decode token to get accountId
          let accountId = '';
          try {
            const parts = token.split('.');
            const p = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
            // The nested idToken has the email
            if (p.data && p.data.idToken) {
              const ip = p.data.idToken.split('.');
              const id = JSON.parse(atob(ip[1].replace(/-/g,'+').replace(/_/g,'/')));
              accountId = id.sub || id.subname || '';
            }
          } catch(e) {}

          const msg = JSON.stringify({
            sendType: 'OUTPUT',
            method: 'flowaccesstoken',
            data: {
              flowaccesstoken: token,
              accountId: accountId,
              crm: 'personal'
            }
          });
          handler.call(self, new MessageEvent('message', { data: msg }));
        }, 4000);
      }
      return origAddEventListener.call(this, type, handler, options);
    };

    // Also wrap the onmessage setter
    if (origOnMessageDesc) {
      Object.defineProperty(WebSocket.prototype, 'onmessage', {
        get() { return this._bridgeOnMessage; },
        set(fn) {
          this._bridgeOnMessage = fn;
          if (this.url && this.url.includes('easylogin')) {
            console.log('[Bridge] onmessage setter on EasyLogin WS');
            wsTracker.push({ ws: this, handler: fn, method: 'onmessage' });

            const self = this;
            setTimeout(() => {
              console.log('[Bridge] Sending fake token via onmessage setter');
              let accountId = '';
              try {
                const parts = token.split('.');
                const p = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
                if (p.data && p.data.idToken) {
                  const ip = p.data.idToken.split('.');
                  const id = JSON.parse(atob(ip[1].replace(/-/g,'+').replace(/_/g,'/')));
                  accountId = id.sub || id.subname || '';
                }
              } catch(e) {}

              const msg = JSON.stringify({
                sendType: 'OUTPUT',
                method: 'flowaccesstoken',
                data: {
                  flowaccesstoken: token,
                  accountId: accountId,
                  crm: 'personal'
                }
              });
              fn.call(self, new MessageEvent('message', { data: msg }));
            }, 4000);
          }
          origOnMessageDesc.set.call(this, fn);
        },
        configurable: true
      });
    }
  }, TOKEN);

  // Navigate to the SmartTV app
  console.log('[CSDK Proxy] Loading SmartTV app...');
  await page.goto(SMARTTV_URL, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => {
    console.log(`[CSDK Proxy] Page load timeout (normal for SPA): ${e.message}`);
  });

  console.log('[CSDK Proxy] SmartTV app loaded. Looking for EasyLogin WebSocket...');

  // Use CDP to find and inject into the WebSocket
  const cdp = await page.createCDPSession();

  // Enable Network domain to see WebSocket frames
  await cdp.send('Network.enable');

  // Track WebSocket connections
  let easyLoginWsId = null;

  cdp.on('Network.webSocketCreated', ({ requestId, url }) => {
    console.log(`[CDP] WebSocket created: ${url} (id=${requestId})`);
    if (url.includes('easylogin')) {
      easyLoginWsId = requestId;
    }
  });

  cdp.on('Network.webSocketFrameReceived', ({ requestId, response }) => {
    console.log(`[CDP] WS frame received (${requestId}): ${response.payloadData.substring(0, 200)}`);
  });

  cdp.on('Network.webSocketFrameSent', ({ requestId, response }) => {
    console.log(`[CDP] WS frame sent (${requestId}): ${response.payloadData.substring(0, 200)}`);
  });

  // Wait for the WebSocket to be established
  await new Promise(r => setTimeout(r, 5000));

  // Now find the EasyLogin WebSocket and inject the token
  // We'll do this by evaluating JS that creates a REAL WebSocket message event
  console.log('[CSDK Proxy] Injecting token via page.evaluate...');

  const injectResult = await page.evaluate((token) => {
    // The SmartTV app's WebSocket wrapper stores the connection.
    // We need to find it and trigger the onmessage handler.
    // Let's try to find ALL WebSocket instances via a known trick.

    // Method 1: Dispatch event on the performance entries
    const wsEntries = performance.getEntriesByType('resource').filter(e =>
      e.name.includes('easylogin') && e.name.startsWith('wss://')
    );

    // Method 2: Override WebSocket.prototype.onmessage getter to find instances
    // Actually, let's try the most direct approach:
    // Call the SmartTV app's internal easyLogin handler directly

    // The SmartTV app stores state in React/framework state.
    // Let's find the React fiber tree and access the component state.
    const rootEl = document.getElementById('root') || document.querySelector('[data-reactroot]') || document.querySelector('#app');
    if (!rootEl) return { error: 'No root element found' };

    // Try to find React internals
    const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (!fiberKey) return { error: 'No React fiber found', keys: Object.keys(rootEl).slice(0, 5) };

    return {
      rootFound: true,
      fiberKey: fiberKey,
      wsEntries: wsEntries.length
    };
  }, TOKEN);

  console.log('[CSDK Proxy] Inject result:', JSON.stringify(injectResult));

  // Alternative approach: use CDP to send a WebSocket frame directly
  // This requires finding the WebSocket connection ID
  if (easyLoginWsId) {
    console.log(`[CSDK Proxy] Found EasyLogin WS (id=${easyLoginWsId}), sending token frame via CDP...`);
    // CDP doesn't have a direct "send frame to page" API.
    // But we can use Runtime.evaluate to access the WebSocket instance.
  }

  // Most reliable approach: use the page's JS context to simulate the full flow
  console.log('[CSDK Proxy] Attempting direct login call...');
  const loginResult = await page.evaluate(async (token) => {
    try {
      // Decode token to get account info
      const parts = token.split('.');
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64));
      const flowId = payload.sub || '';

      // Store token and flowId
      localStorage.setItem('fenix_flowAccessToken', token);
      localStorage.setItem('fenix_flow_id', flowId);

      // Try to find and call the SmartTV app's internal login function
      // by searching through the module registry
      // The app uses a state management library (likely Zustand or similar)

      // Look for the store in the window
      const storeKeys = Object.keys(window).filter(k =>
        k.includes('store') || k.includes('Store') || k.includes('state') || k.includes('State')
      );

      // Try to trigger a route change to /home which would force the app to check auth
      window.history.pushState({}, '', '/home');
      window.dispatchEvent(new PopStateEvent('popstate'));

      return {
        success: true,
        flowId: flowId,
        stored: {
          token: !!localStorage.getItem('fenix_flowAccessToken'),
          flowId: !!localStorage.getItem('fenix_flow_id')
        },
        storeKeys: storeKeys,
        currentUrl: window.location.href
      };
    } catch(e) {
      return { error: e.message };
    }
  }, TOKEN);

  console.log('[CSDK Proxy] Login result:', JSON.stringify(loginResult));

  // Wait for any redirects/loading
  await new Promise(r => setTimeout(r, 10000));

  const pageState = await page.evaluate(() => ({
    url: window.location.href,
    hash: window.location.hash,
    hasFlowToken: !!localStorage.getItem('fenix_flowAccessToken'),
    hasFlowId: !!localStorage.getItem('fenix_flow_id'),
    title: document.title
  }));

  console.log('[CSDK Proxy] Page state:', JSON.stringify(pageState));
  console.log(`[CSDK Proxy] Captured: ${capturedData.channels.length} channels, ${capturedData.fetchLog.length} requests`);

  // Take a screenshot for debugging
  await page.screenshot({ path: '/tmp/csdk-proxy-screenshot.png' });
  console.log('[CSDK Proxy] Screenshot saved to /tmp/csdk-proxy-screenshot.png');
}

// =====================
// Start everything
// =====================

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[CSDK Proxy] REST API listening on http://localhost:${PORT}`);
  console.log(`[CSDK Proxy] Endpoints:`);
  console.log(`  GET /status     - Check proxy status`);
  console.log(`  GET /channels   - Get channel list`);
  console.log(`  GET /session    - Get CSDK session`);
  console.log(`  POST /refresh   - Trigger content refresh`);

  try {
    await startBrowser();
  } catch (e) {
    console.error(`[CSDK Proxy] Browser error: ${e.message}`);
  }
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n[CSDK Proxy] Shutting down...');
  if (browser) await browser.close();
  process.exit(0);
});
