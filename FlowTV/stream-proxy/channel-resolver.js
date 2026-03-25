/**
 * channel-resolver.js
 *
 * Fetches channel list from Flow M11 API and resolves stream URLs.
 * Multiple strategies for stream resolution:
 *   1. CDN HLS redirect (SA_Live_hls_enc)
 *   2. CDN FTA (SA_Live_fta) - no DRM
 *   3. CDN DASH (SA_Live_dash_enc) - needs DRM handling
 *   4. CSDK contentSource via Puppeteer bridge
 */

const https = require('https');
const http = require('http');

const CHANNEL_API = 'https://cdn.bo.flow.com.ar/content/api/v1/Channel';
const CDN_BASE = 'https://cdn.cvattv.com.ar';

class ChannelResolver {
  constructor(sessionManager, csdkBridge) {
    this.session = sessionManager;
    this.csdkBridge = csdkBridge;
    this.channels = [];
    this.channelMap = new Map(); // id -> channel
    this.streamCache = new Map(); // channelId -> { url, expiry, strategy }
    this.CACHE_TTL = 30 * 60 * 1000; // 30 min cache for stream URLs
  }

  /**
   * Fetch channel list from M11 API
   */
  async fetchChannels() {
    await this.session.ensureSession();

    const tokens = this.session.tokens;
    if (!tokens.packages) {
      console.error('[ChannelResolver] No packages token');
      return [];
    }

    const encodedPkg = this.session.encodeToken(tokens.packages);
    const encodedSvc = this.session.encodeToken(tokens.services);
    const encodedReg = this.session.encodeToken(tokens.region);

    const url = `${CHANNEL_API}?adult=false&page=0&size=500&images=CH_LOGO&packages=${encodedPkg}&services=${encodedSvc}&region=${encodedReg}`;

    console.log(`[ChannelResolver] Fetching channels... URL length=${url.length}`);

    try {
      const result = await this._request(url, {
        headers: {
          'Accept': 'application/json',
          'Origin': 'https://portal.app.flow.com.ar',
          'Referer': 'https://portal.app.flow.com.ar/',
        },
      });

      if (result.status !== 200) {
        console.error(`[ChannelResolver] HTTP ${result.status}: ${result.body.substring(0, 200)}`);
        return [];
      }

      const json = JSON.parse(result.body);
      const data = json.data || [];

      this.channels = data.map(ch => {
        const id = ch.id;
        const number = ch.number;
        const name = (ch.name && ch.name.es) || '';

        // Extract logo
        let logoURL = null;
        if (ch.images && Array.isArray(ch.images)) {
          for (const img of ch.images) {
            if (img.url && img.url.es) {
              logoURL = img.url.es.replace('http://10.200.182.83:8090/', 'https://images.flow.com.ar/images/');
            }
          }
        }

        // Extract external channel ID (used for CDN paths)
        const externalId = ch.externalId || ch.externalChannelId || '';

        // Extract technicalId (sometimes used in CDN URLs)
        const technicalId = ch.technicalId || '';

        const channel = {
          id,
          number,
          name,
          logoURL,
          isHD: name.includes('HD'),
          externalId,
          technicalId,
          category: this._categorize(number),
          streamURL: null,
        };

        this.channelMap.set(id, channel);
        return channel;
      });

      this.channels.sort((a, b) => a.number - b.number);
      console.log(`[ChannelResolver] Loaded ${this.channels.length} channels`);
      return this.channels;
    } catch (err) {
      console.error(`[ChannelResolver] Error: ${err.message}`);
      return [];
    }
  }

  /**
   * Resolve a stream URL for a channel, trying multiple strategies
   */
  async resolveStream(channelId) {
    // Check cache
    const cached = this.streamCache.get(channelId);
    if (cached && Date.now() < cached.expiry) {
      console.log(`[ChannelResolver] Cache hit for ${channelId}: strategy=${cached.strategy}`);
      return cached;
    }

    const channel = this.channelMap.get(channelId);
    if (!channel) {
      console.error(`[ChannelResolver] Unknown channel: ${channelId}`);
      return null;
    }

    console.log(`[ChannelResolver] Resolving stream for ${channel.name} (${channelId})...`);

    // Strategy 1: Try CDN HLS path directly
    let result = await this._tryCdnHLS(channel);
    if (result) return this._cacheResult(channelId, result);

    // Strategy 2: Try FTA (Free-to-Air) path - no DRM
    result = await this._tryCdnFTA(channel);
    if (result) return this._cacheResult(channelId, result);

    // Strategy 3: Try DASH path (will need ffmpeg conversion)
    result = await this._tryCdnDASH(channel);
    if (result) return this._cacheResult(channelId, result);

    // Strategy 4: Use CSDK bridge (Puppeteer) if available
    if (this.csdkBridge && this.csdkBridge.isReady()) {
      result = await this._tryCSDK(channel);
      if (result) return this._cacheResult(channelId, result);
    }

    console.log(`[ChannelResolver] All strategies failed for ${channel.name}`);
    return null;
  }

  /**
   * Strategy 1: CDN HLS redirect
   * Try to get an HLS stream from cdn.cvattv.com.ar which 302-redirects to edge server
   */
  async _tryCdnHLS(channel) {
    // The channel name in CDN URLs typically uses a sanitized version
    const cdnNames = this._getCdnNames(channel);

    for (const cdnName of cdnNames) {
      // HLS path
      const url = `${CDN_BASE}/live/c7eds/${cdnName}/SA_Live_hls_enc/${cdnName}.m3u8`;
      console.log(`[ChannelResolver] Trying HLS: ${url}`);

      try {
        const result = await this._request(url, { followRedirects: false });

        if (result.status === 302 || result.status === 301) {
          const location = result.headers.location;
          console.log(`[ChannelResolver] HLS redirect -> ${location}`);

          // Follow the redirect and check if it works
          const check = await this._request(location, { followRedirects: false });
          if (check.status === 200 || check.status === 302) {
            return {
              url: location,
              strategy: 'cdn_hls',
              format: 'hls',
              drm: false,
              cdnName,
            };
          }
          console.log(`[ChannelResolver] HLS edge returned ${check.status}`);
        } else if (result.status === 200) {
          return {
            url,
            strategy: 'cdn_hls',
            format: 'hls',
            drm: false,
            cdnName,
          };
        } else {
          console.log(`[ChannelResolver] HLS ${result.status} for ${cdnName}`);
        }
      } catch (err) {
        console.log(`[ChannelResolver] HLS error for ${cdnName}: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Strategy 2: FTA (Free-to-Air) path - no DRM, plain TS
   */
  async _tryCdnFTA(channel) {
    const cdnNames = this._getCdnNames(channel);

    for (const cdnName of cdnNames) {
      const url = `${CDN_BASE}/live/c7eds/${cdnName}/SA_Live_fta/${cdnName}.m3u8`;
      console.log(`[ChannelResolver] Trying FTA: ${url}`);

      try {
        const result = await this._request(url, { followRedirects: false });

        if (result.status === 302 || result.status === 301) {
          const location = result.headers.location;
          console.log(`[ChannelResolver] FTA redirect -> ${location}`);
          return {
            url: location,
            strategy: 'cdn_fta',
            format: 'hls',
            drm: false,
            cdnName,
          };
        } else if (result.status === 200) {
          return {
            url,
            strategy: 'cdn_fta',
            format: 'hls',
            drm: false,
            cdnName,
          };
        }
      } catch (err) {
        console.log(`[ChannelResolver] FTA error for ${cdnName}: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Strategy 3: DASH with CDN redirect
   * DASH streams need ffmpeg conversion to HLS
   */
  async _tryCdnDASH(channel) {
    const cdnNames = this._getCdnNames(channel);

    for (const cdnName of cdnNames) {
      const url = `${CDN_BASE}/live/c7eds/${cdnName}/SA_Live_dash_enc/${cdnName}.mpd`;
      console.log(`[ChannelResolver] Trying DASH: ${url}`);

      try {
        const result = await this._request(url, { followRedirects: false });

        if (result.status === 302 || result.status === 301) {
          const location = result.headers.location;
          console.log(`[ChannelResolver] DASH redirect -> ${location}`);

          // Check if edge serves it
          const check = await this._request(location, { followRedirects: false });
          if (check.status === 200) {
            // Check if the MPD references CENC (Widevine) encryption
            const hasCENC = check.body.includes('cenc') || check.body.includes('CENC') ||
                           check.body.includes('widevine') || check.body.includes('Widevine');
            return {
              url: location,
              strategy: 'cdn_dash',
              format: 'dash',
              drm: hasCENC,
              drmType: hasCENC ? 'widevine' : 'none',
              cdnName,
            };
          }
          console.log(`[ChannelResolver] DASH edge returned ${check.status}`);
        }
      } catch (err) {
        console.log(`[ChannelResolver] DASH error for ${cdnName}: ${err.message}`);
      }

      // Also try the cipix profile (may use ClearKey)
      const cipixUrl = `${CDN_BASE}/live/c7eds/${cdnName}/SA_DASH_cipix/${cdnName}.mpd`;
      try {
        const result = await this._request(cipixUrl, { followRedirects: false });
        if (result.status === 302 || result.status === 301) {
          const location = result.headers.location;
          console.log(`[ChannelResolver] CIPIX redirect -> ${location}`);
          const check = await this._request(location, { followRedirects: false });
          if (check.status === 200) {
            const hasClearKey = check.body.includes('clearkey') || check.body.includes('ClearKey');
            return {
              url: location,
              strategy: 'cdn_cipix',
              format: 'dash',
              drm: !hasClearKey, // ClearKey is handleable
              drmType: hasClearKey ? 'clearkey' : 'widevine',
              cdnName,
            };
          }
        }
      } catch (err) {
        // ignore
      }
    }

    return null;
  }

  /**
   * Strategy 4: Use CSDK bridge to get contentSource
   */
  async _tryCSDK(channel) {
    try {
      console.log(`[ChannelResolver] Trying CSDK for ${channel.id}...`);
      const result = await this.csdkBridge.getContentSource(channel.id, 'TV_CHANNEL');
      if (result && result.contentUrl) {
        return {
          url: result.contentUrl,
          strategy: 'csdk',
          format: result.protocol === 'HLS' ? 'hls' : 'dash',
          drm: !!result.drm,
          drmType: result.drm ? result.drm.type : 'none',
          drmLicenseUrl: result.drm ? result.drm.url : null,
        };
      }
    } catch (err) {
      console.log(`[ChannelResolver] CSDK error: ${err.message}`);
    }
    return null;
  }

  /**
   * Get possible CDN path names for a channel
   */
  _getCdnNames(channel) {
    const names = [];

    // The CDN uses channel names like "ElTrece_HD", "ESPN_HD", etc.
    // Try various sanitization approaches
    if (channel.externalId) {
      names.push(channel.externalId);
    }

    if (channel.technicalId) {
      names.push(channel.technicalId);
    }

    // Sanitize the display name
    const sanitized = channel.name
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .replace(/_+/g, '_');
    names.push(sanitized);

    // Also try without HD suffix
    if (sanitized.endsWith('_HD')) {
      names.push(sanitized.replace(/_HD$/, ''));
    }

    // Try lowercase
    names.push(sanitized.toLowerCase());

    return [...new Set(names)].filter(n => n.length > 0);
  }

  _cacheResult(channelId, result) {
    result.expiry = Date.now() + this.CACHE_TTL;
    this.streamCache.set(channelId, result);
    console.log(`[ChannelResolver] Cached ${channelId}: strategy=${result.strategy}, format=${result.format}, drm=${result.drm}`);
    return result;
  }

  _categorize(number) {
    if (number >= 100 && number < 120) return 'deportes';
    if (number >= 200 && number < 300) return 'peliculas';
    if (number >= 300 && number < 400) return 'series';
    if (number >= 400 && number < 500) return 'infantil';
    if (number < 30) return 'noticias';
    return 'entretenimiento';
  }

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
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          ...(options.headers || {}),
        },
      };

      const req = lib.request(reqOptions, (res) => {
        if (!options.followRedirects && (res.statusCode === 301 || res.statusCode === 302)) {
          resolve({ status: res.statusCode, headers: res.headers, body: '' });
          res.resume();
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy(new Error('Request timeout'));
      });
      req.end();
    });
  }
}

module.exports = ChannelResolver;
