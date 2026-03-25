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
    const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);

    if (url.includes('easylogin')) {
      console.log('[INJECT] EasyLogin WS detected!');

      // Capture the onmessage handler when the app sets it
      let capturedHandler = null;
      const origDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage') ||
                             Object.getOwnPropertyDescriptor(OrigWS.prototype, 'onmessage');

      Object.defineProperty(ws, 'onmessage', {
        get() { return capturedHandler; },
        set(handler) {
          console.log('[INJECT] onmessage handler captured!');
          capturedHandler = handler;

          // Also set it on the real WS so normal messages work
          if (origDescriptor && origDescriptor.set) {
            origDescriptor.set.call(ws, handler);
          }
        }
      });

      // Also intercept addEventListener for 'message'
      const origAddEvent = ws.addEventListener.bind(ws);
      ws.addEventListener = function(type, handler, options) {
        if (type === 'message') {
          console.log('[INJECT] addEventListener("message") captured!');
          capturedHandler = capturedHandler || handler;
        }
        return origAddEvent(type, handler, options);
      };

      // When WS opens, wait and inject the token
      ws.addEventListener('open', () => {
        console.log('[INJECT] WS opened, injecting token in 3s...');
        setTimeout(() => {
          const fakeMsg = JSON.stringify({
            method: "flowaccesstoken",
            data: { flowaccesstoken: token }
          });

          console.log('[INJECT] Calling onmessage handler directly...');
          const event = new MessageEvent('message', { data: fakeMsg });

          if (capturedHandler) {
            // Call onmessage directly
            if (typeof capturedHandler === 'function') {
              capturedHandler(event);
            } else if (capturedHandler.handleEvent) {
              capturedHandler.handleEvent(event);
            }
            console.log('[INJECT] Handler called successfully!');
          } else {
            console.log('[INJECT] WARNING: no handler captured, dispatching event');
            ws.dispatchEvent(event);
          }
        }, 3000);
      });
    }

    return ws;
  };

  window.WebSocket.CONNECTING = 0;
  window.WebSocket.OPEN = 1;
  window.WebSocket.CLOSING = 2;
  window.WebSocket.CLOSED = 3;
  Object.setPrototypeOf(window.WebSocket, OrigWS);
  Object.setPrototypeOf(window.WebSocket.prototype, OrigWS.prototype);
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
