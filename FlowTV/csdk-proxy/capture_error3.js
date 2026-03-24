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

  // Enable network logging for ALL requests
  await page.setRequestInterception(true);
  page.on('request', r => r.continue());
  page.on('response', async r => {
    const url = r.url();
    if (!url.includes('.js') && !url.includes('.css') && !url.includes('.png') &&
        !url.includes('.svg') && !url.includes('.woff') && !url.includes('.ico') &&
        !url.includes('metrics') && !url.includes('ping') && !url.includes('google-analytics')) {
      console.log(`[NET] ${r.status()} ${url.substring(0, 150)}`);
      // Show response body for API calls
      if (url.includes('sdk') || url.includes('login') || url.includes('cdn') ||
          url.includes('channel') || url.includes('session') || url.includes('auth')) {
        try {
          const body = await r.text();
          console.log(`[BODY] ${body.substring(0, 300)}`);
        } catch {}
      }
    }
  });

  // Inject WebSocket + wrap the easyLogin function
  await page.evaluateOnNewDocument((token) => {
    // Track if we've injected
    let injected = false;

    const origOnMessageDesc = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
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

            console.log('[Bridge] Calling onmessage handler with token');
            const msgData = JSON.stringify({
              method: 'flowaccesstoken',
              data: { flowaccesstoken: token, accountId: accountId, crm: 'personal' }
            });

            // Create event that matches what real WebSocket sends
            const evt = { data: msgData, type: 'message', target: self, currentTarget: self,
                         srcElement: self, isTrusted: false, bubbles: false, cancelable: false };

            try {
              fn.call(self, evt);
              console.log('[Bridge] Handler called successfully');
            } catch(e) {
              console.error('[Bridge] Handler error:', e.message, e.stack);
            }
          }, 3000);
        }
        origOnMessageDesc?.set?.call(this, fn);
      },
      configurable: true
    });

    // Wrap Promise to catch async errors in the easyLogin flow
    const origThen = Promise.prototype.then;
    const origCatch = Promise.prototype.catch;
    Promise.prototype.catch = function(handler) {
      return origCatch.call(this, function(err) {
        if (err?.message?.includes('sdk') || err?.message?.includes('SDK') ||
            err?.message?.includes('initialize') || err?.message?.includes('login') ||
            err?.message?.includes('CSDK')) {
          console.error('[Promise.catch] SDK/login error:', err.message, err.stack?.substring(0, 300));
        }
        return handler?.(err);
      });
    };

    window.addEventListener('unhandledrejection', e => {
      console.error('[UNHANDLED]', e.reason?.message || String(e.reason));
    });
  }, TOKEN);

  // Listen for console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Bridge') || text.includes('Error') || text.includes('error') ||
        text.includes('sdk') || text.includes('SDK') || text.includes('login') ||
        text.includes('CSDK') || text.includes('initialize') || text.includes('UNHANDLED') ||
        text.includes('Promise') || text.includes('uiError') || text.includes('flowAuth')) {
      console.log(`[PAGE] ${text.substring(0, 500)}`);
    }
  });

  page.on('pageerror', e => console.log(`[ERR] ${e.message.substring(0, 500)}`));

  await page.goto('https://fenix-smarttv.dev.app.flow.com.ar/', {
    waitUntil: 'networkidle2', timeout: 60000
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 20000));
  console.log('FINAL URL:', await page.url());

  // Check localStorage state
  const state = await page.evaluate(() => ({
    token: !!localStorage.getItem('fenix_flowAccessToken'),
    flowId: localStorage.getItem('fenix_flow_id'),
    deviceId: localStorage.getItem('FENIX_DEVICE_ID_KEY')
  }));
  console.log('STATE:', JSON.stringify(state));

  await browser.close();
})();
