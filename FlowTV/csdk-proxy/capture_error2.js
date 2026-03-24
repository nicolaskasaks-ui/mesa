const puppeteer = require('puppeteer-core');
const TOKEN = require('fs').readFileSync('/tmp/flow_token.txt', 'utf8').trim();

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36');

  // Inject: intercept WebSocket AND capture all errors globally
  await page.evaluateOnNewDocument((token) => {
    // Capture all errors thrown
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[UNHANDLED_REJECTION]', e.reason?.message || e.reason?.toString() || JSON.stringify(e.reason));
    });

    window.addEventListener('error', (e) => {
      console.error('[GLOBAL_ERROR]', e.message, e.filename, e.lineno);
    });

    // Intercept console.error to capture error objects
    const origError = console.error;
    console.error = function(...args) {
      origError.apply(this, args);
    };

    // Intercept console.info to capture the uiError metric with full details
    const origInfo = console.info;
    console.info = function(...args) {
      const str = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
      if (str.includes('uiError') || str.includes('flowAuthService')) {
        console.log('[CAPTURED_INFO]', str.substring(0, 2000));
      }
      origInfo.apply(this, args);
    };

    // WebSocket interception
    const origOnMessageDesc = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
    let injected = false;
    if (origOnMessageDesc) {
      Object.defineProperty(WebSocket.prototype, 'onmessage', {
        get() { return this._bom; },
        set(fn) {
          this._bom = fn;
          if (this.url?.includes('easylogin') && !injected) {
            injected = true;
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
              console.log('[Bridge] Injecting token once, accountId=' + accountId);
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

  // Capture ALL page console with full object expansion
  page.on('console', async (msg) => {
    const type = msg.type();
    const args = msg.args();
    const texts = [];
    for (const arg of args) {
      try {
        const val = await arg.jsonValue().catch(() => null);
        if (val !== null && typeof val === 'object') {
          texts.push(JSON.stringify(val).substring(0, 1000));
        } else {
          texts.push(String(val || await arg.evaluate(a => String(a)).catch(() => '?')));
        }
      } catch {
        texts.push('?');
      }
    }
    const text = texts.join(' ');
    if (text.includes('uiError') || text.includes('CAPTURED_INFO') || text.includes('Bridge') ||
        text.includes('UNHANDLED') || text.includes('GLOBAL_ERROR') || text.includes('Error') ||
        text.includes('flowAuth') || text.includes('sdk') || text.includes('login')) {
      console.log(`[PAGE:${type}] ${text.substring(0, 1500)}`);
    }
  });

  page.on('pageerror', e => console.log(`[PAGE_ERROR] ${e.message.substring(0, 500)}`));

  await page.goto('https://fenix-smarttv.dev.app.flow.com.ar/', {
    waitUntil: 'networkidle2', timeout: 60000
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 15000));
  console.log('FINAL URL:', await page.url());
  await browser.close();
})();
