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

  // Hook WebSocket to intercept EasyLogin and auto-inject token
  await page.evaluateOnNewDocument((token) => {
    const OrigWS = window.WebSocket;
    
    window.WebSocket = function(url, protocols) {
      const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
      
      if (url.includes('easylogin')) {
        console.log('[INJECT] Intercepted EasyLogin WS:', url);
        
        // Hook the onmessage setter to capture the handler
        let realHandler = null;
        const origOnmessage = Object.getOwnPropertyDescriptor(OrigWS.prototype, 'onmessage');
        
        Object.defineProperty(ws, 'onmessage', {
          get: () => realHandler,
          set: (handler) => {
            console.log('[INJECT] onmessage handler registered!');
            realHandler = handler;
            
            // Also set the real one
            if (origOnmessage && origOnmessage.set) {
              origOnmessage.set.call(ws, handler);
            }
          }
        });
        
        // Also hook addEventListener
        const origAddEventListener = ws.addEventListener.bind(ws);
        const messageListeners = [];
        ws.addEventListener = function(type, listener, options) {
          if (type === 'message') {
            messageListeners.push(listener);
            console.log('[INJECT] addEventListener("message") registered');
          }
          return origAddEventListener(type, listener, options);
        };
        
        // When the WS opens, wait for handlers to register, then inject
        ws.addEventListener('open', () => {
          console.log('[INJECT] EasyLogin WS opened, waiting for handlers...');
          
          setTimeout(() => {
            console.log('[INJECT] Injecting flowaccesstoken to all handlers...');
            
            const fakeData = JSON.stringify({
              method: 'flowaccesstoken',
              data: { flowaccesstoken: token }
            });
            
            const fakeEvent = { data: fakeData, type: 'message', target: ws };
            
            // Call onmessage handler if set
            if (realHandler) {
              console.log('[INJECT] Calling onmessage handler');
              try { realHandler(fakeEvent); } catch(e) { console.log('[INJECT] onmessage error:', e); }
            }
            
            // Call all addEventListener handlers  
            messageListeners.forEach((listener, i) => {
              console.log(`[INJECT] Calling addEventListener handler ${i}`);
              try { listener(fakeEvent); } catch(e) { console.log(`[INJECT] listener ${i} error:`, e); }
            });
            
            // Also try dispatchEvent
            try {
              ws.dispatchEvent(new MessageEvent('message', { data: fakeData }));
              console.log('[INJECT] dispatchEvent done');
            } catch(e) {}
            
            console.log('[INJECT] All injection attempts complete');
          }, 5000); // Wait 5s for handlers to register
        });
      }
      
      return ws;
    };
    // Copy static properties
    Object.setPrototypeOf(window.WebSocket, OrigWS);
    Object.defineProperty(window.WebSocket, 'prototype', { value: OrigWS.prototype });
    window.WebSocket.CONNECTING = 0;
    window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSING = 2;
    window.WebSocket.CLOSED = 3;
  }, TOKEN);

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('INJECT') || text.includes('error') || text.includes('Error') ||
        text.includes('login') || text.includes('channel') || text.includes('session') ||
        text.includes('SDK') || text.includes('sdk') || text.includes('provision')) {
      log(`[PAGE] ${text.substring(0, 200)}`);
    }
  });

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

      if (data.channels || (Array.isArray(data) && data[0]?.channelNumber)) {
        const items = data.channels || data;
        if (Array.isArray(items) && items.length > 0) {
          capturedData.channels = items;
          log(`>>> ${items.length} CHANNELS! <<<`);
          fs.writeFileSync('/tmp/flow_channels.json', JSON.stringify(items, null, 2));
        }
      }

      if (data.tokens?.session || data.token) {
        const tok = data.tokens?.session || data.token;
        if (tok && tok.length > 50) {
          capturedData.sessionToken = tok;
          log(`>>> SESSION TOKEN <<<`);
          fs.writeFileSync('/tmp/flow_session_token.txt', tok);
        }
      }

      if (status >= 400 || url.includes('channel') || url.includes('epg') || 
          url.includes('login') || url.includes('provision') || url.includes('session')) {
        log(`[API] ${status} ${url.substring(0, 120)} (${text.length}b)`);
      }
    } catch {}
  });

  log('[Auto] Loading SmartTV...');
  await page.goto(SMARTTV_URL, { waitUntil: 'networkidle0', timeout: 60000 }).catch(e => log(`[Nav] ${e.message}`));
  log('[Auto] Loaded. Waiting for injection...');

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    if (i % 5 === 0) log(`[Check ${i}] ${page.url()}, ch: ${capturedData.channels.length}`);
    if (capturedData.channels.length > 0) { log('[SUCCESS]'); break; }
  }

  log(`[Final] ${capturedData.channels.length} channels`);
})().catch(e => log(`[FATAL] ${e.message}`));
