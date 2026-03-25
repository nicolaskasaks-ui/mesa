import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const TOKEN = readFileSync('/tmp/flow_token.txt', 'utf8').trim();
const URL = 'https://fenix-smarttv.dev.app.flow.com.ar/';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36'
});
const page = await ctx.newPage();

const captured = { requests: [], session: null, channels: [] };

// Capture ALL requests
page.on('response', async (res) => {
  const url = res.url();
  const status = res.status();

  // Skip analytics, fonts, images
  if (url.includes('google') || url.includes('font') || url.includes('.png') ||
      url.includes('.gif') || url.includes('.svg') || url.includes('.css')) return;

  const entry = { method: res.request().method(), url, status };

  try {
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') || ct.includes('text')) {
      const body = await res.text();
      entry.bodyPreview = body.substring(0, 500);

      if (body.includes('"token"') || body.includes('"session"') || body.includes('"tokens"')) {
        try {
          const d = JSON.parse(body);
          if (d.tokens?.session || d.token) {
            captured.session = d;
            console.error('*** GOT SESSION TOKEN ***');
          }
        } catch(e) {}
      }

      if (url.includes('channel') || url.includes('epg')) {
        try {
          const d = JSON.parse(body);
          if (d.channels || d.channel) {
            captured.channels = d.channels || d.channel || [];
            console.error(`*** GOT ${captured.channels.length} CHANNELS ***`);
          }
        } catch(e) {}
      }
    }
  } catch(e) {}

  captured.requests.push(entry);
  console.error(`${status} ${entry.method} ${url.substring(0, 120)}`);
});

console.error('Loading SmartTV app...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// Inject token
console.error('Injecting token...');
await page.evaluate((t) => {
  localStorage.setItem('fenix_flowAccessToken', t);
  try {
    const p = JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    localStorage.setItem('fenix_flow_id', p.sub || '');
  } catch(e) {}
}, TOKEN);

// Reload to trigger CSDK init with token
console.error('Reloading...');
await page.reload({ waitUntil: 'networkidle', timeout: 60000 });

// Wait for CSDK calls
console.error('Waiting for CSDK API calls (15s)...');
await new Promise(r => setTimeout(r, 15000));

// Get localStorage
const storage = await page.evaluate(() => {
  const r = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    r[k] = localStorage.getItem(k)?.substring(0, 200);
  }
  return r;
});
captured.localStorage = storage;

// Get cookies
const cookies = await ctx.cookies();
captured.cookies = cookies.filter(c =>
  c.name.includes('m11') || c.name.includes('session') ||
  c.name.includes('flow') || c.name.includes('prm')
);

console.log(JSON.stringify(captured, null, 2));
await browser.close();
