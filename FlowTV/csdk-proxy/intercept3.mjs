import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import https from 'https';

const TOKEN = readFileSync('/tmp/flow_token.txt', 'utf8').trim();
const URL = 'https://fenix-smarttv.dev.app.flow.com.ar/';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36'
});
const page = await ctx.newPage();

const captured = { requests: [], session: null, channels: [], sdkConfig: null };

page.on('response', async (res) => {
  const url = res.url();
  const status = res.status();
  if (url.includes('google') || url.includes('font') || url.includes('.png') ||
      url.includes('.gif') || url.includes('.svg') || url.includes('.css') ||
      url.includes('metrics') || url.includes('analytics') || url.includes('.mp3') ||
      url.includes('.jpg') || url.includes('theoplayer') || url.includes('ping.txt')) return;

  const entry = { method: res.request().method(), url, status };
  try {
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') || ct.includes('text') || ct.includes('javascript')) {
      const body = await res.text();
      entry.bodyLen = body.length;
      if (!url.includes('.js')) entry.bodyPreview = body.substring(0, 500);

      if (body.includes('"tokens"') && body.includes('"session"')) {
        try {
          const d = JSON.parse(body);
          if (d.tokens?.session) {
            captured.session = d;
            console.error('*** SESSION TOKEN FOUND ***');
            writeFileSync('/tmp/flow_session.json', JSON.stringify(d, null, 2));
          }
        } catch(e) {}
      }

      if (url.includes('sdkConfig') && !url.includes('.json')) {
        try {
          captured.sdkConfig = JSON.parse(body);
          console.error('*** SDK CONFIG ***');
          writeFileSync('/tmp/flow_sdkconfig.json', body);
        } catch(e) {}
      }

      if ((url.includes('channel') || url.includes('epg')) && status >= 200 && status < 300) {
        try {
          const d = JSON.parse(body);
          const ch = d.channels || d.channel || d.items;
          if (Array.isArray(ch) && ch.length > 0) {
            captured.channels = ch;
            console.error(`*** ${ch.length} CHANNELS ***`);
            writeFileSync('/tmp/flow_channels.json', JSON.stringify(ch.slice(0, 5), null, 2));
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

// Get the EasyLogin code and sessionID
const codeData = await page.evaluate(() => {
  const text = document.body?.innerText || '';
  // The code is displayed in the UI
  return text;
});
console.error('Page text:', codeData.substring(0, 200));

// Get the easylogin session from the page's fetch calls
const easyLoginData = captured.requests.find(r => r.url.includes('easylogin/v1/code'));
let sessionID = null;
if (easyLoginData?.bodyPreview) {
  const d = JSON.parse(easyLoginData.bodyPreview);
  sessionID = d.sessionID;
  console.error(`EasyLogin sessionID: ${sessionID}, code: ${d.code}`);
}

if (!sessionID) {
  console.error('No sessionID found, trying to get it...');
  const codeRes = await page.evaluate(async () => {
    const r = await fetch('https://easylogin.app.flow.com.ar/easylogin/v1/code');
    return await r.json();
  });
  sessionID = codeRes.sessionID;
  console.error(`Got sessionID: ${sessionID}`);
}

// Now send the token to the EasyLogin WebSocket endpoint
// The mobile app would call: POST /easylogin/v1/session/{sessionID}
// with {method: "flowaccesstoken", data: {flowaccesstoken: TOKEN}}
console.error('Sending token via EasyLogin HTTP endpoint...');

const sendToken = () => new Promise((resolve, reject) => {
  const body = JSON.stringify({
    method: "flowaccesstoken",
    data: { flowaccesstoken: TOKEN }
  });

  const req = https.request({
    hostname: 'easylogin.app.flow.com.ar',
    path: `/easylogin/v1/session/${sessionID}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.error(`EasyLogin POST: ${res.statusCode} ${data}`);
      resolve({ status: res.statusCode, body: data });
    });
  });
  req.on('error', e => { console.error('Error:', e.message); reject(e); });
  req.write(body);
  req.end();
});

const tokenResult = await sendToken();
console.error('Token sent! Waiting for CSDK to initialize...');

// Wait for the app to process the token and CSDK to make API calls
// The CSDK will call cdn.bo.flow.com.ar for sdkConfig, then login, then channels
await new Promise(r => setTimeout(r, 30000));

// Get final state
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
  c.name.includes('flow') || c.name.includes('prm')
);

captured.pageURL = await page.url();

console.log(JSON.stringify(captured, null, 2));
await browser.close();
