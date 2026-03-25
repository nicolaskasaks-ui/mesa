/**
 * session-manager.js
 *
 * Manages Flow M11 API sessions: login, token refresh, PRM registration.
 * Tokens auto-refresh before expiry.
 */

const https = require('https');
const http = require('http');

// Hardcoded credentials from the existing FlowM11Service.swift
const DEFAULT_USER_DEVICE_TOKEN = 'bklkOggBIoABsDUskYo+FVbYmdd1d4iQjIyP4LSIkO4TErDqGaaP7uZm3Nhymnpck7r0j65gjhOtmDuKwqPCbczXuHOs9vY0N0kRulXd5QcNPh3/riCkURrIYOZoes8Pyqap5qmmmPS3cv+AmuRh04aZnP19uZxihT8Nhfn2mhsmbgvfgANS/6w=';
const DEFAULT_PROFILE = 'flow:999900002715839:P';
const DEFAULT_CAS_ID = '676dda401fe236763b8c0b5c505edf28';

const SESSION_URL = 'https://cdn.bo.flow.com.ar/users/node/1/api/v1/session';
const PRM_REGISTER_URL = 'https://cdn.bo.flow.com.ar/policy-engine/api/v1/register';

// Fallback tokens from a known-working Chrome session (same as in FlowM11Service.swift)
// These expire but allow the channel list to load for testing.
const FALLBACK_TOKENS = {
  packages: 'bklkOggBGAMi8AQHvOYwzNjodNmrcuKRRhc8wLC+8nzasrXznA6BwqNElWRC43noPxa0oker/OZc7PN+RDWbqNL0p3q0WEt7R2+wp/qZOr37/ZiamWZDX0A0aufMJY04TiCNiQuV/wJ4oikyzESxb1hgWkPdebHioZ8f08Djz4IKEPNLu8ySlXbnZi0hkiDwMtrWL2XM1oO4/ppzt3Yw33hBM0g2yrjBYZaLg1sObThiAlbEQkBb3qxS2w5WHnOUx9GEqK5v83vvT+gdVMAct61XhMxsg6SVILF+Xje4uW/2d3jDwt9jKoXsQVrVOocLqTEFvb77jFoKrmqoYB39QifbCMEcXa7K3EEtZXxZ9y/x/jM3SV4dhyvUcMmlHP7wFtWzCTVljIAQTnhm7VwqU9pfan3ga0oOFuRrDRh4R7nLwuHXvCA8EvBlI9s9Ki+T5zq9dZMbq06PrMX6PoYBQkkbdYStPztVzKENxEddws+EttPThpzNsSg8VuaJuHHgIt5aZViNaSm+JpBuoq3ImV5oXutLYrBjtGPxY/fJS0tZ+A0PDFhVuxNvegEhfLXzyLTgtonXsBKD/FMTQPdQAjAsA2IHYCg3gzDjiT8Z6dRlrdZji8jZbELhSkT0wVIcmuoQfQSe90aVlshHttkof0m9c/0uhNJ67y/z0zBW/i80Ds23bpOSu1LcrLCIu/eCSTbP5YFv2uTpoQzCLnBeBkoalxBKPGXhXlMZvr4Yl27MMUnV/YIWji72EkSOOO5D8tdIXsSNmlSJg60JaFEe66gBDAwTp6YqAoGMfkI5/BnkvVy/ozIgB3/U9MrSGX7miwX8nNPhYLq5LVg=',
  services: 'bklkOggBIkBNcXMmCGwXl7LIiwJAfoykrfQs3O/ZN1zXHHdoA1X88fJxAgLzKDWpZVxhR95StuzytBfg1FzpIOFejZ8V7cnj',
  region: 'bklkOggBImCQp3+kUWjJrhVDoBFSFSWjzSVpxbnS96ChubJcYAr+ijxovCNqP1KU/DmaJp5YruVFyus0Zae3inNQSlIpHGBYQpVNGRezdSfN+AeXg2kQOO6WLXL5fU83IoAEJzOP+YY=',
};

class SessionManager {
  constructor() {
    this.tokens = {
      packages: '',
      services: '',
      region: '',
      session: '',
    };
    this.prmToken = null;
    this.prmExpiry = null;
    this.sessionExpiry = null;
    this.lastRefresh = null;
    this.usedFallback = false;
    this.refreshing = false;
    this.config = {
      userDeviceToken: DEFAULT_USER_DEVICE_TOKEN,
      profile: DEFAULT_PROFILE,
      casId: DEFAULT_CAS_ID,
    };

    // Session refresh interval (tokens live ~12h, we refresh every 4h)
    this.SESSION_TTL = 4 * 3600 * 1000;
    // PRM refresh interval (PRM lives ~6h, we refresh every 2h)
    this.PRM_TTL = 2 * 3600 * 1000;
  }

  /**
   * Make an HTTPS request returning a Promise<{status, headers, body}>
   */
  _request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://portal.app.flow.com.ar',
          'Referer': 'https://portal.app.flow.com.ar/',
          ...(options.headers || {}),
        },
      };

      const req = lib.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  /**
   * Refresh session tokens from the M11 session endpoint
   */
  async refreshSession() {
    if (this.refreshing) {
      // Wait for ongoing refresh
      await new Promise(r => setTimeout(r, 2000));
      return !!this.tokens.session;
    }

    this.refreshing = true;
    console.log('[SessionManager] Refreshing session tokens...');

    try {
      const deviceId = `proxy-${Date.now().toString(36)}`;
      const requestId = `Flow|Proxy|1.0|999900002715839|${deviceId}|${Math.floor(Math.random() * 9999999999)}`;

      const body = JSON.stringify({
        userDeviceToken: this.config.userDeviceToken,
        profile: this.config.profile,
        deviceInfo: {
          appVersion: '4.26.0',
          brand: 'WEB',
          casId: this.config.casId,
          model: 'PC',
          name: 'WEB(MacIntel)',
          os: 'WindowsPC',
          osVersion: '4.26.0',
          playerType: 'TheoPlayer',
          type: 'cloud_client',
        },
      });

      const result = await this._request(SESSION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
        },
        body,
      });

      if (result.status !== 200) {
        console.error(`[SessionManager] Session HTTP ${result.status}: ${result.body.substring(0, 200)}`);
        return false;
      }

      const json = JSON.parse(result.body);
      if (!json.tokens) {
        console.error('[SessionManager] No tokens in response');
        return false;
      }

      this.tokens.packages = json.tokens.packages || '';
      this.tokens.services = json.tokens.services || '';
      this.tokens.region = json.tokens.region || '';
      this.tokens.session = json.tokens.session || '';
      this.sessionExpiry = Date.now() + this.SESSION_TTL;
      this.lastRefresh = new Date().toISOString();

      console.log(`[SessionManager] Session refreshed. packages=${this.tokens.packages.length} chars, session=${this.tokens.session.length} chars`);
      this.usedFallback = false;
      return true;
    } catch (err) {
      console.error(`[SessionManager] Session error: ${err.message}`);
      return false;
    } finally {
      this.refreshing = false;
    }
  }

  /**
   * Use fallback tokens (from a previously captured Chrome session).
   * These may be expired but sometimes still work for the channel list API.
   */
  useFallbackTokens() {
    console.log('[SessionManager] Using fallback hardcoded tokens');
    this.tokens.packages = FALLBACK_TOKENS.packages;
    this.tokens.services = FALLBACK_TOKENS.services;
    this.tokens.region = FALLBACK_TOKENS.region;
    // Note: no session JWT in fallback, PRM registration will fail
    this.usedFallback = true;
    this.sessionExpiry = Date.now() + 30 * 60 * 1000; // 30 min
  }

  /**
   * Register PRM to get a playback token
   */
  async registerPRM() {
    if (!this.tokens.session) {
      console.error('[SessionManager] No session token for PRM registration');
      return false;
    }

    console.log('[SessionManager] Registering PRM...');

    try {
      const body = JSON.stringify({
        deviceBrand: '',
        deviceModel: '',
        deviceType: 'WEB',
        playerType: 'VISUAL_ON',
        networkType: 'BROADBAND',
      });

      const result = await this._request(PRM_REGISTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tokens.session}`,
        },
        body,
      });

      if (result.status !== 200) {
        console.error(`[SessionManager] PRM HTTP ${result.status}: ${result.body.substring(0, 200)}`);
        return false;
      }

      const json = JSON.parse(result.body);
      this.prmToken = json.tokenForPRM || json.token || null;
      this.prmExpiry = Date.now() + this.PRM_TTL;

      if (this.prmToken) {
        console.log(`[SessionManager] PRM registered. token=${this.prmToken.length} chars`);
        return true;
      }

      console.error('[SessionManager] No PRM token in response:', Object.keys(json));
      return false;
    } catch (err) {
      console.error(`[SessionManager] PRM error: ${err.message}`);
      return false;
    }
  }

  /**
   * Ensure tokens are valid, refreshing if needed
   */
  async ensureSession() {
    // If we have packages token (even from fallback), we can fetch channels
    if (this.tokens.packages && this.sessionExpiry && Date.now() < this.sessionExpiry) {
      return true;
    }
    const ok = await this.refreshSession();
    if (!ok) {
      // Fall back to hardcoded tokens for channel list at minimum
      if (!this.tokens.packages) {
        this.useFallbackTokens();
      }
      return !!this.tokens.packages;
    }
    return true;
  }

  /**
   * Ensure PRM token is valid
   */
  async ensurePRM() {
    await this.ensureSession();
    if (!this.prmToken || !this.prmExpiry || Date.now() > this.prmExpiry) {
      return await this.registerPRM();
    }
    return true;
  }

  /**
   * Get URL-encoded token for query parameters
   */
  encodeToken(token) {
    return encodeURIComponent(token)
      .replace(/%2B/gi, '%2B')
      .replace(/%2F/gi, '%2F');
  }

  /**
   * Get status info
   */
  getStatus() {
    return {
      hasSession: !!this.tokens.session,
      hasPackages: !!this.tokens.packages,
      hasPRM: !!this.prmToken,
      usedFallback: this.usedFallback,
      sessionExpiry: this.sessionExpiry ? new Date(this.sessionExpiry).toISOString() : null,
      prmExpiry: this.prmExpiry ? new Date(this.prmExpiry).toISOString() : null,
      lastRefresh: this.lastRefresh,
      packagesTokenLen: this.tokens.packages.length,
      sessionTokenLen: this.tokens.session.length,
    };
  }
}

module.exports = SessionManager;
