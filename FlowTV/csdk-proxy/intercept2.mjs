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

page.on('response', async (res) => {
  const url = res.url();
  const status = res.status();
  if (url.includes('google') || url.includes('font') || url.includes('.png') ||
      url.includes('.gif') || url.includes('.svg') || url.includes('.css') ||
      url.includes('metrics') || url.includes('analytics')) return;

  const entry = { method: res.request().method(), url, status };
  try {
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') || ct.includes('text')) {
      const body = await res.text();
      entry.bodyPreview = body.substring(0, 500);

      // Check for session tokens
      if (body.includes('"token"') || body.includes('"session"') || body.includes('"tokens"')) {
        try {
          const d = JSON.parse(body);
          if (d.tokens?.session || d.token) {
            captured.session = d;
            console.error('*** SESSION TOKEN ***');
          }
        } catch(e) {}
      }

      // Check for channels
      if (url.includes('channel') || url.includes('epg')) {
        try {
          const d = JSON.parse(body);
          const ch = d.channels || d.channel;
          if (Array.isArray(ch) && ch.length > 0) {
            captured.channels = ch;
            console.error(`*** ${ch.length} CHANNELS ***`);
          }
        } catch(e) {}
      }
    }
  } catch(e) {}
  captured.requests.push(entry);
  console.error(`${status} ${entry.method} ${url.substring(0, 150)}`);
});

console.error('Loading SmartTV app...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

// Instead of injecting into localStorage and reloading,
// directly call the SmartTV app's login function with the token
console.error('Calling easyLogin function directly...');

const loginResult = await page.evaluate(async (token) => {
  // The SmartTV app has a global navigation/auth system
  // After EasyLogin, the WS message handler calls the auth module
  // Let me find and trigger it

  // Set the token first
  localStorage.setItem('fenix_flowAccessToken', token);

  // Extract flowId
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    localStorage.setItem('fenix_flow_id', p.sub || '');
  } catch(e) {}

  // Try to find the easyLogin function in the app's module system
  // The SmartTV app uses a routing system. Let's navigate to /home
  // which triggers auth check and loads content

  // First, simulate what happens when EasyLogin WS returns the token
  // The WS handler calls: case Th.Flowaccesstoken: x(oGe(It)), H()
  // Where x is the state setter and oGe transforms {flowaccesstoken, crm, accountId}

  // After that, the React component calls the auth service's easyLogin function
  // which does: CSDK.login({token, providerId: "flowclient", provisionMethod: "OAuthToken"})

  // The simplest way: dispatch a custom event or navigate
  try {
    window.history.pushState({}, '', '/home');
    window.dispatchEvent(new PopStateEvent('popstate'));
    return { action: 'navigated to /home' };
  } catch(e) {
    return { error: e.message };
  }
}, TOKEN);

console.error('Login result:', JSON.stringify(loginResult));

// Wait for any API calls triggered by navigation
console.error('Waiting 20s for API calls...');
await new Promise(r => setTimeout(r, 20000));

// Check what happened
const storage = await page.evaluate(() => {
  const r = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    r[k] = localStorage.getItem(k)?.substring(0, 300);
  }
  return r;
});
captured.localStorage = storage;

const cookies = await ctx.cookies();
captured.cookies = cookies.filter(c =>
  c.name.includes('m11') || c.name.includes('session') ||
  c.name.includes('flow') || c.name.includes('prm') || c.name.includes('minerva')
);

// Check page state
const pageState = await page.evaluate(() => ({
  url: window.location.href,
  title: document.title,
  bodyText: document.body?.innerText?.substring(0, 500)
}));
captured.pageState = pageState;

console.log(JSON.stringify(captured, null, 2));
await browser.close();
