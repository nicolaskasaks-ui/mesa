/**
 * csdk-bridge.js
 *
 * Uses Puppeteer + headless Chrome to run the Flow Minerva CSDK.
 * The CSDK communicates via WebSocket and provides contentSource
 * responses with proper CDN tokens.
 *
 * This is the "last resort" strategy when direct CDN URLs don't work.
 */

const puppeteer = require('puppeteer-core');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SMARTTV_URL = 'https://fenix-smarttv.dev.app.flow.com.ar/';

class CSDKBridge {
  constructor(sessionManager) {
    this.session = sessionManager;
    this.browser = null;
    this.page = null;
    this._ready = false;
    this._starting = false;
    this.contentSourceCache = new Map();
    this.capturedResponses = new Map();
  }

  isReady() {
    return this._ready;
  }

  /**
   * Start headless Chrome and load the SmartTV app
   */
  async start() {
    if (this._starting) return;
    this._starting = true;

    console.log('[CSDKBridge] Starting headless Chrome...');

    try {
      this.browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
        ],
      });

      this.page = await this.browser.newPage();

      await this.page.setUserAgent(
        'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36'
      );
      await this.page.setViewport({ width: 1920, height: 1080 });

      // Intercept network to capture contentSource responses
      await this.page.setRequestInterception(true);

      this.page.on('request', (req) => {
        req.continue();
      });

      this.page.on('response', async (res) => {
        const url = res.url();

        // Capture any contentSource or stream URL responses
        if (url.includes('contentSource') || url.includes('content/source')) {
          try {
            const data = await res.json();
            console.log(`[CSDKBridge] Captured contentSource: ${JSON.stringify(data).substring(0, 300)}`);
            // Store by channel ID if we can extract it
            if (data.content) {
              this.capturedResponses.set(url, data);
            }
          } catch (e) {
            // not JSON, ignore
          }
        }

        // Capture session/PRM data
        if (url.includes('/session') || url.includes('/register')) {
          try {
            const data = await res.json();
            if (data.tokens || data.tokenForPRM || data.token) {
              console.log(`[CSDKBridge] Captured auth response from ${url}`);
              this.capturedResponses.set('auth_' + Date.now(), data);
            }
          } catch (e) {
            // ignore
          }
        }
      });

      this.page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('content') || text.includes('stream') || text.includes('error')) {
          console.log(`[CSDKBridge:page] ${text.substring(0, 200)}`);
        }
      });

      // Inject a helper to expose CSDK contentSource function
      await this.page.evaluateOnNewDocument(() => {
        // Hook into the CSDK's contentSource calls
        window.__csdkContentSource = null;
        window.__csdkReady = false;

        // Intercept WebSocket messages to find contentSource responses
        const origSend = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
          try {
            const msg = JSON.parse(data);
            if (msg.method === 'contentSource' || msg.type === 'contentSource') {
              console.log('[CSDKBridge] WS contentSource request: ' + data.substring(0, 200));
            }
          } catch (e) {}
          return origSend.call(this, data);
        };

        // Intercept WebSocket message reception
        const origAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, handler, options) {
          if (type === 'message' && this instanceof WebSocket) {
            const wrappedHandler = function (event) {
              try {
                const msg = JSON.parse(event.data);
                if (msg.contentUrl || msg.content?.contentUrl) {
                  console.log('[CSDKBridge] WS contentSource response: ' + event.data.substring(0, 300));
                  window.__lastContentSource = msg;
                }
              } catch (e) {}
              return handler.call(this, event);
            };
            return origAddEventListener.call(this, type, wrappedHandler, options);
          }
          return origAddEventListener.call(this, type, handler, options);
        };
      });

      // Navigate to SmartTV app
      console.log('[CSDKBridge] Loading SmartTV app...');
      await this.page.goto(SMARTTV_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      }).catch((e) => {
        console.log(`[CSDKBridge] Page load: ${e.message}`);
      });

      // Wait a bit for CSDK to initialize
      await new Promise((r) => setTimeout(r, 5000));

      this._ready = true;
      console.log('[CSDKBridge] Ready');
    } catch (err) {
      console.error(`[CSDKBridge] Start error: ${err.message}`);
      this._ready = false;
    } finally {
      this._starting = false;
    }
  }

  /**
   * Try to get contentSource for a channel via the CSDK
   */
  async getContentSource(channelId, contentType = 'TV_CHANNEL') {
    if (!this._ready || !this.page) {
      console.log('[CSDKBridge] Not ready');
      return null;
    }

    // Check cache
    const cacheKey = `${channelId}_${contentType}`;
    const cached = this.contentSourceCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    try {
      // Try to call contentSource via the page's CSDK
      const result = await this.page.evaluate(async (chId, type) => {
        // Try to find the CSDK instance
        if (window.__csdk_request) {
          return await window.__csdk_request('contentSource', 'get', {
            id: chId,
            type: type,
          });
        }

        // Try to use the last captured contentSource
        if (window.__lastContentSource) {
          return window.__lastContentSource;
        }

        return null;
      }, channelId, contentType);

      if (result && (result.contentUrl || result.content?.contentUrl)) {
        const data = {
          contentUrl: result.contentUrl || result.content?.contentUrl,
          protocol: result.protocol || result.content?.protocol || 'HLS',
          drm: result.drm || result.content?.drm || null,
        };

        // Cache for 20 minutes
        this.contentSourceCache.set(cacheKey, {
          data,
          expiry: Date.now() + 20 * 60 * 1000,
        });

        return data;
      }

      return null;
    } catch (err) {
      console.error(`[CSDKBridge] getContentSource error: ${err.message}`);
      return null;
    }
  }

  /**
   * Navigate to a specific channel to trigger contentSource
   */
  async navigateToChannel(channelId) {
    if (!this._ready || !this.page) return;

    try {
      // The SmartTV app navigates by hash
      await this.page.evaluate((chId) => {
        window.location.hash = `#/player/live/${chId}`;
      }, channelId);

      // Wait for the contentSource response
      await new Promise((r) => setTimeout(r, 5000));

      // Check if we captured a contentSource response
      const result = await this.page.evaluate(() => {
        return window.__lastContentSource || null;
      });

      return result;
    } catch (err) {
      console.error(`[CSDKBridge] navigateToChannel error: ${err.message}`);
      return null;
    }
  }

  /**
   * Stop the browser
   */
  async stop() {
    console.log('[CSDKBridge] Stopping...');
    if (this.browser) {
      await this.browser.close().catch(() => {});
    }
    this._ready = false;
  }

  getStatus() {
    return {
      ready: this._ready,
      starting: this._starting,
      capturedResponseCount: this.capturedResponses.size,
      cacheSize: this.contentSourceCache.size,
    };
  }
}

module.exports = CSDKBridge;
