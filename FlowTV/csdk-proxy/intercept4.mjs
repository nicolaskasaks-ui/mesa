import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const TOKEN = readFileSync('/tmp/flow_token.txt', 'utf8').trim();
const URL = 'https://fenix-smarttv.dev.app.flow.com.ar/';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36'
});
const page = await ctx.newPage();

const captured = { requests: [], session: null, channels: [], allData: {} };

// Intercept responses
page.on('response', async (res) => {
  const url = res.url();
  const status = res.status();
  if (url.includes('google') || url.includes('font') || url.includes('.png') ||
      url.includes('.gif') || url.includes('.svg') || url.includes('.css') ||
      url.includes('metrics') || url.includes('analytics') || url.includes('.mp3') ||
      url.includes('.jpg') || url.includes('theoplayer') || url.includes('ping.txt') ||
      url.includes('.woff')) return;

  const entry = { method: res.request().method(), url, status };
  try {
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json')) {
      const body = await res.text();
      entry.bodyLen = body.length;
      if (body.length < 2000) entry.body = body;
      else entry.bodyPreview = body.substring(0, 500);

      // Capture session
      if (body.includes('"tokens"') || body.includes('"sessionToken"')) {
        writeFileSync('/tmp/flow_session_raw.json', body);
        console.error('*** POSSIBLE SESSION DATA ***');
      }

      // Capture channels
      if (url.includes('channel') || url.includes('epg')) {
        writeFileSync('/tmp/flow_channels_raw.json', body);
        console.error(`*** CHANNEL DATA (${body.length} bytes) ***`);
      }

      // Capture SDK config
      if (url.includes('sdkConfig') && !url.includes('.json')) {
        writeFileSync('/tmp/flow_sdkconfig_raw.json', body);
        console.error('*** SDK CONFIG ***');
      }
    }
  } catch(e) {}
  captured.requests.push(entry);
  console.error(`${status} ${entry.method} ${url.substring(0, 150)}`);
});

// CRITICAL: Monkey-patch WebSocket BEFORE the page loads
// When the SmartTV app connects to the EasyLogin WS, we intercept
// and inject the flowaccesstoken message as if the mobile app sent it
await page.addInitScript((token) => {
  const OrigWS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    console.log('[INJECT] WebSocket created:', url);
    const ws = new OrigWS(url, protocols);

    if (url.includes('easylogin')) {
      console.log('[INJECT] EasyLogin WS detected! Will inject token on open');

      const origOnOpen = ws.onopen;
      const origAddEventListener = ws.addEventListener.bind(ws);

      // Wait for the WS to open, then after a short delay inject the token
      ws.addEventListener('open', () => {
        console.log('[INJECT] EasyLogin WS opened, injecting token in 2s...');
        setTimeout(() => {
          // Create a fake MessageEvent with the flowaccesstoken
          const fakeMsg = JSON.stringify({
            method: "flowaccesstoken",
            data: { flowaccesstoken: token }
          });
          console.log('[INJECT] Dispatching flowaccesstoken message');

          // Dispatch a MessageEvent on the WebSocket
          const event = new MessageEvent('message', { data: fakeMsg });
          ws.dispatchEvent(event);
        }, 2000);
      });
    }

    return ws;
  };
  // Copy static properties
  window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.OPEN = OrigWS.OPEN;
  window.WebSocket.CLOSING = OrigWS.CLOSING;
  window.WebSocket.CLOSED = OrigWS.CLOSED;
  window.WebSocket.prototype = OrigWS.prototype;
}, TOKEN);

console.error('Loading SmartTV app with WS interception...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// Check console for our inject logs
page.on('console', msg => {
  if (msg.text().includes('[INJECT]')) {
    console.error(`BROWSER: ${msg.text()}`);
  }
});

console.error('Waiting 45s for CSDK initialization after token injection...');
await new Promise(r => setTimeout(r, 45000));

// Get state
const storage = await page.evaluate(() => {
  const r = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k);
    r[k] = v?.substring(0, 500);
  }
  return r;
});
captured.localStorage = storage;

const cookies = await ctx.cookies();
captured.cookies = cookies;

captured.pageURL = await page.url();
captured.pageTitle = await page.title();

// Get page text to see if we're past login
const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000));
captured.bodyText = bodyText;

console.log(JSON.stringify(captured, null, 2));
await browser.close();
