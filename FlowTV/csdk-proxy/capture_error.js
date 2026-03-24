const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TOKEN = require('fs').readFileSync('/tmp/flow_token.txt', 'utf8').trim();

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36');

  // Capture ALL errors and logs with arguments
  const cdp = await page.createCDPSession();
  await cdp.send('Runtime.enable');

  cdp.on('Runtime.consoleAPICalled', (event) => {
    const args = event.args.map(a => {
      if (a.type === 'object' && a.preview) {
        return JSON.stringify(a.preview.properties.reduce((acc, p) => {
          acc[p.name] = p.value;
          return acc;
        }, {}));
      }
      return a.value || a.description || a.type;
    });
    const text = args.join(' ');
    if (text.includes('error') || text.includes('Error') || text.includes('uiError') ||
        text.includes('login') || text.includes('Login') || text.includes('easyLogin') ||
        text.includes('sdk') || text.includes('SDK') || text.includes('CSDK') ||
        text.includes('initialize') || text.includes('Bridge') || text.includes('flow')) {
      console.log(`[CONSOLE:${event.type}] ${text.substring(0, 500)}`);
    }
  });

  cdp.on('Runtime.exceptionThrown', (event) => {
    console.log(`[EXCEPTION] ${JSON.stringify(event.exceptionDetails).substring(0, 500)}`);
  });

  // Inject WebSocket interception
  await page.evaluateOnNewDocument((token) => {
    const origOnMessageDesc = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
    if (origOnMessageDesc) {
      Object.defineProperty(WebSocket.prototype, 'onmessage', {
        get() { return this._bom; },
        set(fn) {
          this._bom = fn;
          if (this.url && this.url.includes('easylogin')) {
            console.log('[Bridge] onmessage set');
            const self = this;
            setTimeout(() => {
              let accountId = '';
              try {
                const parts = token.split('.');
                const p = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
                if (p.data?.idToken) {
                  const ip = p.data.idToken.split('.');
                  const id = JSON.parse(atob(ip[1].replace(/-/g,'+').replace(/_/g,'/')));
                  accountId = id.sub || '';
                }
              } catch(e) {}

              console.log('[Bridge] Injecting token, accountId=' + accountId);
              const msg = JSON.stringify({
                sendType: 'OUTPUT',
                method: 'flowaccesstoken',
                data: { flowaccesstoken: token, accountId: accountId, crm: 'personal' }
              });
              fn.call(self, new MessageEvent('message', { data: msg }));
            }, 3000);
          }
          origOnMessageDesc.set.call(this, fn);
        },
        configurable: true
      });
    }
  }, TOKEN);

  await page.goto('https://fenix-smarttv.dev.app.flow.com.ar/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  }).catch(() => {});

  // Wait for the flow
  await new Promise(r => setTimeout(r, 15000));

  console.log('URL:', await page.url());
  await page.screenshot({ path: '/tmp/csdk-error.png' });
  console.log('Screenshot: /tmp/csdk-error.png');

  await browser.close();
})();
