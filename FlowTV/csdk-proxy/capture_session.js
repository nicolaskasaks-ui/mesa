#!/usr/bin/env node
/**
 * Captures Flow CSDK session by loading the SmartTV web app in headless Chrome,
 * injecting the EasyLogin token, and intercepting the CSDK's API calls.
 *
 * Usage: node capture_session.js <flowAccessToken>
 *
 * Outputs: JSON with session token, channels, and gateway URLs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const TOKEN = process.argv[2] || fs.readFileSync('/tmp/flow_token.txt', 'utf8').trim();
const SMARTTV_URL = 'https://fenix-smarttv.dev.app.flow.com.ar/';
const TIMEOUT = 60000;

(async () => {
  console.error('[CSDK] Starting headless capture...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set SmartTV user agent
  await page.setUserAgent('Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36');

  // Capture all network requests to find CSDK API calls
  const apiCalls = [];
  const channels = [];
  let sessionToken = null;
  let gatewayURL = null;

  await page.setRequestInterception(true);

  page.on('request', req => {
    const url = req.url();

    // Log interesting requests
    if (url.includes('cdn.bo') || url.includes('provision') || url.includes('channel') ||
        url.includes('epg') || url.includes('session') || url.includes('login') ||
        url.includes('sdkConfig')) {
      console.error(`[CSDK] REQ ${req.method()} ${url}`);
    }

    req.continue();
  });

  page.on('response', async res => {
    const url = res.url();
    const status = res.status();

    if (url.includes('cdn.bo') || url.includes('provision') || url.includes('channel') ||
        url.includes('epg') || url.includes('session') || url.includes('sdkConfig')) {
      console.error(`[CSDK] RES ${status} ${url}`);

      try {
        const body = await res.text();

        // Capture sdkConfig response (contains gateway URL)
        if (url.includes('sdkConfig') && status === 200) {
          try {
            const config = JSON.parse(body);
            console.error('[CSDK] Got sdkConfig!');
            fs.writeFileSync('/tmp/flow_sdkconfig.json', JSON.stringify(config, null, 2));
          } catch(e) {}
        }

        // Capture session/token responses
        if (body.includes('"token"') || body.includes('"session"')) {
          try {
            const data = JSON.parse(body);
            if (data.token || data.tokens?.session) {
              sessionToken = data.tokens?.session || data.token;
              console.error(`[CSDK] Got session token! Length: ${sessionToken.length}`);
            }
          } catch(e) {}
        }

        // Capture channel data
        if ((url.includes('channel') || url.includes('epg')) && status === 200) {
          try {
            const data = JSON.parse(body);
            if (data.channels || data.channel) {
              const ch = data.channels || data.channel;
              if (Array.isArray(ch)) {
                channels.push(...ch);
                console.error(`[CSDK] Got ${ch.length} channels!`);
              }
            }
          } catch(e) {}
        }

        apiCalls.push({ url, status, bodyLength: body.length });
      } catch(e) {
        apiCalls.push({ url, status, error: e.message });
      }
    }
  });

  // Navigate to SmartTV app
  console.error('[CSDK] Loading SmartTV app...');
  await page.goto(SMARTTV_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });

  // Wait for the app to initialize
  await page.waitForTimeout(3000);

  // Inject the token as if EasyLogin just completed
  console.error('[CSDK] Injecting token via EasyLogin flow...');

  await page.evaluate((token) => {
    // Store the token the same way the SmartTV app does
    localStorage.setItem('fenix_flowAccessToken', token);

    // Extract flowId from JWT
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const flowId = payload.sub || '';
      localStorage.setItem('fenix_flow_id', flowId);
      console.log('[INJECT] Set flowAccessToken and flowId:', flowId);
    } catch(e) {
      console.log('[INJECT] Error parsing token:', e.message);
    }
  }, TOKEN);

  // Reload to trigger the CSDK initialization with the token
  console.error('[CSDK] Reloading with token...');
  await page.reload({ waitUntil: 'networkidle2', timeout: TIMEOUT });

  // Wait for CSDK to initialize and make API calls
  console.error('[CSDK] Waiting for CSDK to initialize...');
  await page.waitForTimeout(10000);

  // Check if we got session data
  const sessionData = await page.evaluate(() => {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.includes('fenix') || key.includes('flow') || key.includes('m11') || key.includes('session')) {
        result[key] = localStorage.getItem(key);
      }
    }
    // Also check cookies
    result._cookies = document.cookie;
    return result;
  });

  console.error('[CSDK] localStorage/cookies:', JSON.stringify(Object.keys(sessionData)));

  // Try to get channel data from the CSDK directly
  const csdkChannels = await page.evaluate(async () => {
    // The CSDK might be available as a global
    if (typeof window._t !== 'undefined' && window._t.request) {
      try {
        const result = await window._t.request('epg', 'channels', {
          size: 500, restricted: false, showAdultContent: false, contentType: 'live_tv'
        });
        return result;
      } catch(e) {
        return { error: e.message };
      }
    }
    return { error: '_t not found in global scope' };
  });

  console.error('[CSDK] Direct CSDK query result:', JSON.stringify(csdkChannels)?.substring(0, 200));

  // Output results
  const result = {
    sessionToken,
    gatewayURL,
    channelCount: channels.length,
    channels: channels.slice(0, 5),
    apiCalls,
    sessionData,
    csdkChannels: typeof csdkChannels === 'object' ? csdkChannels : null
  };

  console.log(JSON.stringify(result, null, 2));

  await browser.close();
  console.error('[CSDK] Done.');
})().catch(err => {
  console.error('[CSDK] Fatal error:', err.message);
  process.exit(1);
});
