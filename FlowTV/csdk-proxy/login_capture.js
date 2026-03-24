#!/usr/bin/env node
/**
 * FlowTV Login Capture
 *
 * Opens Chrome with the SmartTV web app.
 * You log in via EasyLogin (scan QR code or enter code on your phone).
 * After login, this captures the CSDK session token and all API data.
 * The token is then used by the proxy server for real API calls.
 */

const puppeteer = require('puppeteer-core');
const express = require('express');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SMARTTV_URL = 'https://fenix-smarttv.dev.app.flow.com.ar/';
const PORT = 8770;

const capturedData = {
  sessionToken: null,
  channels: [],
  apiResponses: {},
  allFetches: []
};

const app = express();

app.get('/status', (req, res) => res.json({
  ready: capturedData.channels.length > 0,
  channelCount: capturedData.channels.length,
  hasSession: !!capturedData.sessionToken,
  recentFetches: capturedData.allFetches.slice(-10)
}));

app.get('/channels', (req, res) => res.json(capturedData.channels));
app.get('/session', (req, res) => res.json({ token: capturedData.sessionToken }));
app.get('/api/:key', (req, res) => {
  const d = capturedData.apiResponses[req.params.key];
  res.json(d || { error: 'not found', keys: Object.keys(capturedData.apiResponses) });
});

app.listen(PORT, () => console.log(`[Proxy] http://localhost:${PORT}`));

(async () => {
  console.log('[Login] Opening Chrome with SmartTV app...');
  console.log('[Login] Please log in by scanning the QR code or entering the code on your phone.');
  console.log('[Login] After login, the channels will be captured automatically.\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,  // VISIBLE Chrome window
    args: [
      '--no-sandbox',
      '--window-size=1280,720',
      '--app=' + SMARTTV_URL
    ],
    defaultViewport: null
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  // Set SmartTV user agent
  await page.setUserAgent('Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36');

  // Intercept responses to capture API data
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');

  // Track all non-static responses
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();

    if (/\.(js|css|png|jpg|svg|woff|ico|map|mp3|webmanifest)(\?|$)/.test(url)) return;
    if (url.includes('metrics') || url.includes('ping') || url.includes('google')) return;

    capturedData.allFetches.push({ url: url.substring(0, 200), status, t: Date.now() });
    if (capturedData.allFetches.length > 200) capturedData.allFetches.shift();

    console.log(`[NET] ${status} ${url.substring(0, 120)}`);

    try {
      const text = await response.text();
      if (!text || text.length < 2) return;

      let data;
      try { data = JSON.parse(text); } catch { return; }

      // Capture channels
      if (url.includes('channel') || url.includes('epg') || url.includes('live_tv') ||
          (data.channels || data.contents)) {
        const items = data.channels || data.contents || data.channel;
        if (Array.isArray(items) && items.length > 0) {
          capturedData.channels = items;
          capturedData.apiResponses['channels'] = data;
          console.log(`\n>>> CAPTURED ${items.length} CHANNELS! <<<\n`);
          // Save to file
          fs.writeFileSync('/tmp/flow_channels.json', JSON.stringify(items, null, 2));
          console.log('Saved to /tmp/flow_channels.json');
        }
      }

      // Capture session
      if (data.token || data.tokens?.session || data.session) {
        capturedData.sessionToken = data.token || data.tokens?.session || data.session?.token;
        capturedData.apiResponses['session'] = data;
        if (capturedData.sessionToken) {
          console.log(`\n>>> SESSION TOKEN CAPTURED (${capturedData.sessionToken.length} chars) <<<\n`);
          fs.writeFileSync('/tmp/flow_session_token.txt', capturedData.sessionToken);
        }
      }

      // Capture content lists
      if (url.includes('content') || url.includes('injector')) {
        const key = url.includes('injector') ? 'injector' :
                    url.includes('content') ? 'content' : 'other';
        capturedData.apiResponses[key] = data;
      }

      // Capture EPG data
      if (url.includes('epg')) {
        capturedData.apiResponses['epg'] = data;
      }

    } catch {}
  });

  // Navigate if not already there
  if (!page.url().includes('fenix-smarttv')) {
    await page.goto(SMARTTV_URL, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  }

  console.log('\n[Login] Waiting for you to log in...');
  console.log('[Login] The QR code/code should be visible in the Chrome window.\n');

  // Keep running and polling for login
  const interval = setInterval(async () => {
    try {
      const url = await page.url();
      if (!url.includes('prelogin') && !url.includes('login')) {
        console.log(`[Login] Detected navigation to: ${url}`);
        console.log('[Login] Login appears successful! Capturing data...');

        // Wait for data to load
        await new Promise(r => setTimeout(r, 10000));

        console.log(`\n[Login] Final state:`);
        console.log(`  Channels: ${capturedData.channels.length}`);
        console.log(`  Session: ${capturedData.sessionToken ? 'YES' : 'NO'}`);
        console.log(`  API responses: ${Object.keys(capturedData.apiResponses).join(', ')}`);
        console.log(`\n[Login] Proxy running at http://localhost:${PORT}`);
        console.log('[Login] The Apple TV app can now connect to get real data.\n');

        clearInterval(interval);
      }
    } catch {}
  }, 2000);

  // Handle browser close
  browser.on('disconnected', () => {
    console.log('[Login] Browser closed.');
    if (capturedData.channels.length > 0) {
      console.log(`[Login] Data preserved: ${capturedData.channels.length} channels`);
      console.log('[Login] Proxy still running at http://localhost:' + PORT);
    }
  });
})();
