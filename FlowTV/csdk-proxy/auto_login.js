#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SMARTTV_URL = 'https://fenix-smarttv.dev.app.flow.com.ar/';
const PORT = 8770;
const TOKEN = fs.readFileSync('/tmp/flow_token.txt', 'utf8').trim();

const capturedData = { sessionToken: null, channels: [], logs: [] };
const log = (msg) => { console.log(msg); capturedData.logs.push(msg); };

const app = express();
app.get('/status', (req, res) => res.json({
  ready: capturedData.channels.length > 0,
  channelCount: capturedData.channels.length,
  hasSession: !!capturedData.sessionToken,
  logs: capturedData.logs.slice(-30)
}));
app.get('/channels', (req, res) => res.json(capturedData.channels));
app.listen(PORT, () => log(`[Proxy] http://localhost:${PORT}`));

(async () => {
  log(`[Auto] Token: ${TOKEN.length} chars`);
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1280, height: 720 }
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36');

  // CRITICAL: Inject WebSocket interceptor BEFORE page loads
  // This patches the WebSocket constructor to intercept EasyLogin connections
  // and automatically send the token
  await page.evaluateOnNewDocument((token) => {
    const OrigWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
      
      // If this is an EasyLogin WebSocket, auto-inject the token
      if (url.includes('easylogin')) {
        console.log('[INJECT] Intercepted EasyLogin WebSocket:', url);
        
        const origAddEventListener = ws.addEventListener.bind(ws);
        const origOnMessage = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
        
        // After the WebSocket opens and gets the code, 
        // wait a moment then send the flowaccesstoken message
        ws.addEventListener('open', () => {
          console.log('[INJECT] EasyLogin WebSocket opened');
          
          // Wait for the initial code message, then inject token
          setTimeout(() => {
            console.log('[INJECT] Injecting flowaccesstoken...');
            
            // Create a fake MessageEvent with the token
            const fakeMsg = JSON.stringify({
              method: 'flowaccesstoken',
              data: { flowaccesstoken: token }
            });
            
            // Dispatch to all listeners
            const event = new MessageEvent('message', { data: fakeMsg });
            ws.dispatchEvent(event);
            
            console.log('[INJECT] Token injected!');
          }, 3000);
        });
      }
      
      return ws;
    };
    window.WebSocket.prototype = OrigWS.prototype;
    window.WebSocket.CONNECTING = OrigWS.CONNECTING;
    window.WebSocket.OPEN = OrigWS.OPEN;
    window.WebSocket.CLOSING = OrigWS.CLOSING;
    window.WebSocket.CLOSED = OrigWS.CLOSED;
  }, TOKEN);

  // Capture console logs from the page
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('INJECT') || text.includes('CSDK') || text.includes('login') || 
        text.includes('channel') || text.includes('error') || text.includes('Error')) {
      log(`[PAGE] ${text}`);
    }
  });

  // Capture API responses  
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    if (/\.(js|css|png|jpg|svg|woff|ico|gif|ttf|map)(\?|$)/.test(url)) return;
    if (url.startsWith('data:')) return;

    try {
      const text = await response.text();
      if (!text || text.length < 10) return;
      let data;
      try { data = JSON.parse(text); } catch { return; }

      // Channels
      if (data.channels || (Array.isArray(data) && data[0]?.channelNumber)) {
        const items = data.channels || data;
        if (Array.isArray(items) && items.length > 0) {
          capturedData.channels = items;
          log(`>>> ${items.length} CHANNELS CAPTURED! <<<`);
          fs.writeFileSync('/tmp/flow_channels.json', JSON.stringify(items, null, 2));
        }
      }

      // Session token
      if (data.tokens?.session || data.token) {
        const tok = data.tokens?.session || data.token;
        if (tok && tok.length > 50) {
          capturedData.sessionToken = tok;
          log(`>>> SESSION TOKEN (${tok.length} chars) <<<`);
          fs.writeFileSync('/tmp/flow_session_token.txt', tok);
        }
      }

      // Log interesting responses
      if (url.includes('channel') || url.includes('epg') || url.includes('login') ||
          url.includes('provision') || url.includes('session') || url.includes('content')) {
        log(`[API] ${status} ${url.substring(0, 120)} (${text.length}b)`);
      }
    } catch {}
  });

  log('[Auto] Navigating to SmartTV app...');
  await page.goto(SMARTTV_URL, { waitUntil: 'networkidle0', timeout: 60000 }).catch(e => log(`[Nav] ${e.message}`));
  
  log('[Auto] Page loaded. WebSocket interceptor active. Waiting for CSDK...');

  // Monitor for 90 seconds
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pageUrl = page.url();
    
    if (i % 5 === 0) log(`[Check ${i}] URL: ${pageUrl}, channels: ${capturedData.channels.length}`);
    
    if (capturedData.channels.length > 0) {
      log('[Auto] SUCCESS!');
      break;
    }
  }

  log(`[Auto] Done. Channels: ${capturedData.channels.length}, Session: ${!!capturedData.sessionToken}`);
})().catch(e => log(`[FATAL] ${e.message}`));
