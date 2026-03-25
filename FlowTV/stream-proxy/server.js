#!/usr/bin/env node
/**
 * FlowTV Stream Proxy Server
 *
 * Local proxy that converts Flow DASH/Widevine streams to HLS
 * for Apple TV playback.
 *
 * Start: node /Users/nk/mesa/FlowTV/stream-proxy/server.js
 * URL:   http://localhost:8772
 *
 * Endpoints:
 *   GET  /status                        - Health check
 *   GET  /channels                      - List all channels
 *   GET  /stream/:channelId             - Get resolved stream info
 *   GET  /hls/:channelId/stream.m3u8    - HLS manifest (or redirect)
 *   GET  /hls/:channelId/:segment.ts    - HLS segments
 *   POST /refresh                       - Force token + channel refresh
 *   GET  /debug/session                 - Session token info
 *   GET  /debug/streams                 - Active stream conversions
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SessionManager = require('./session-manager');
const ChannelResolver = require('./channel-resolver');
const StreamConverter = require('./stream-converter');
const CSDKBridge = require('./csdk-bridge');

const PORT = 8772;
const HOST = '0.0.0.0';

// Initialize components
const sessionManager = new SessionManager();
const csdkBridge = new CSDKBridge(sessionManager);
const channelResolver = new ChannelResolver(sessionManager, csdkBridge);
const streamConverter = new StreamConverter();

// Track startup state
let serverReady = false;
let initError = null;
let channelCount = 0;

// =====================================
// HTTP Server (no Express dependency for simplicity)
// =====================================

const server = http.createServer(async (req, res) => {
  // CORS headers for Apple TV and local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // Route matching
    if (pathname === '/status') {
      return handleStatus(req, res);
    }

    if (pathname === '/channels') {
      return await handleChannels(req, res);
    }

    if (pathname.startsWith('/stream/')) {
      const channelId = pathname.replace('/stream/', '');
      return await handleStream(req, res, channelId);
    }

    if (pathname.startsWith('/hls/')) {
      return await handleHLS(req, res, pathname);
    }

    if (pathname === '/refresh' && req.method === 'POST') {
      return await handleRefresh(req, res);
    }

    if (pathname === '/debug/session') {
      return handleDebugSession(req, res);
    }

    if (pathname === '/debug/streams') {
      return handleDebugStreams(req, res);
    }

    if (pathname === '/set-tokens' && req.method === 'POST') {
      return await handleSetTokens(req, res);
    }

    // 404
    sendJSON(res, 404, { error: 'Not found', path: pathname });
  } catch (err) {
    console.error(`[Server] Error handling ${pathname}: ${err.message}`);
    sendJSON(res, 500, { error: err.message });
  }
});

// =====================================
// Route Handlers
// =====================================

function handleStatus(req, res) {
  const networkIPs = getLocalIPs();
  sendJSON(res, 200, {
    status: serverReady ? 'ready' : 'initializing',
    error: initError,
    channelCount,
    session: sessionManager.getStatus(),
    converter: streamConverter.getStatus(),
    csdk: csdkBridge.getStatus(),
    network: {
      port: PORT,
      localIPs: networkIPs,
      urls: networkIPs.map(ip => `http://${ip}:${PORT}`),
    },
    uptime: Math.floor(process.uptime()),
  });
}

async function handleChannels(req, res) {
  if (channelResolver.channels.length === 0) {
    // Try to fetch
    await channelResolver.fetchChannels();
  }

  const channels = channelResolver.channels.map(ch => ({
    id: ch.id,
    number: ch.number,
    name: ch.name,
    logoURL: ch.logoURL,
    isHD: ch.isHD,
    category: ch.category,
    // Include proxy stream URL for Apple TV
    streamURL: `http://${req.headers.host}/hls/${ch.id}/stream.m3u8`,
    proxyStreamURL: `http://${req.headers.host}/stream/${ch.id}`,
  }));

  sendJSON(res, 200, {
    count: channels.length,
    channels,
  });
}

async function handleStream(req, res, channelId) {
  console.log(`[Server] Stream request for ${channelId}`);

  // Resolve the stream URL
  const resolved = await channelResolver.resolveStream(channelId);
  if (!resolved) {
    sendJSON(res, 404, {
      error: 'Could not resolve stream',
      channelId,
      message: 'All stream resolution strategies failed. The channel may not be available or DRM prevents access.',
    });
    return;
  }

  console.log(`[Server] Resolved ${channelId}: strategy=${resolved.strategy}, format=${resolved.format}, drm=${resolved.drm}`);

  // If already HLS and no DRM, return directly
  if (resolved.format === 'hls' && !resolved.drm) {
    sendJSON(res, 200, {
      channelId,
      strategy: resolved.strategy,
      format: 'hls',
      drm: false,
      // Direct HLS URL (works for Apple TV natively)
      directURL: resolved.url,
      // Proxy HLS URL (for when direct doesn't work)
      proxyURL: `http://${req.headers.host}/hls/${channelId}/stream.m3u8`,
    });
    return;
  }

  // If DASH or DRM, need conversion
  if (resolved.format === 'dash') {
    if (resolved.drm && resolved.drmType === 'widevine') {
      // Widevine DRM - ffmpeg cannot handle this
      sendJSON(res, 200, {
        channelId,
        strategy: resolved.strategy,
        format: 'dash',
        drm: true,
        drmType: 'widevine',
        error: 'Widevine DRM prevents direct conversion. Use CSDK bridge or FTA alternative.',
        sourceURL: resolved.url,
        // Still try proxy - it might partially work for unencrypted init segments
        proxyURL: `http://${req.headers.host}/hls/${channelId}/stream.m3u8`,
      });
      return;
    }

    // Non-DRM DASH or ClearKey - convert with ffmpeg
    const drmInfo = resolved.drmType === 'clearkey' ? { type: 'clearkey', key: resolved.clearKey } : null;
    const stream = await streamConverter.startStream(channelId, resolved.url, 'dash', drmInfo);

    sendJSON(res, 200, {
      channelId,
      strategy: resolved.strategy,
      format: 'dash_to_hls',
      converting: true,
      ready: stream.ready,
      error: stream.error,
      proxyURL: `http://${req.headers.host}/hls/${channelId}/stream.m3u8`,
    });
    return;
  }

  // Fallback
  sendJSON(res, 200, {
    channelId,
    strategy: resolved.strategy,
    format: resolved.format,
    drm: resolved.drm,
    sourceURL: resolved.url,
    proxyURL: `http://${req.headers.host}/hls/${channelId}/stream.m3u8`,
  });
}

async function handleHLS(req, res, pathname) {
  // Parse /hls/{channelId}/{filename}
  const parts = pathname.replace('/hls/', '').split('/');
  if (parts.length < 2) {
    sendJSON(res, 400, { error: 'Invalid HLS path. Use /hls/{channelId}/stream.m3u8' });
    return;
  }

  const channelId = parts[0];
  const filename = parts.slice(1).join('/');

  // Touch last access
  const streamInfo = streamConverter.getStreamInfo(channelId);

  // If no active stream, try to start one
  if (!streamInfo) {
    console.log(`[Server] No active stream for ${channelId}, resolving...`);

    const resolved = await channelResolver.resolveStream(channelId);
    if (!resolved) {
      sendJSON(res, 404, { error: 'Could not resolve stream', channelId });
      return;
    }

    // Start conversion
    const drmInfo = resolved.drmType === 'clearkey' ? { type: 'clearkey', key: resolved.clearKey } : null;
    const stream = await streamConverter.startStream(channelId, resolved.url, resolved.format, drmInfo);

    if (stream.passthroughUrl && filename === 'stream.m3u8') {
      // Redirect to source HLS
      res.writeHead(302, { 'Location': stream.passthroughUrl });
      res.end();
      return;
    }

    if (!stream.ready && stream.error) {
      sendJSON(res, 502, { error: stream.error, channelId });
      return;
    }
  }

  // Get file from converter
  const file = streamConverter.getFile(channelId, filename);

  if (!file) {
    // Stream might still be starting
    if (filename === 'stream.m3u8') {
      // Return a minimal playlist that tells the player to retry
      const minimalPlaylist = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:4',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:4.0,',
        `http://${req.headers.host}/hls/${channelId}/stream.m3u8`, // self-redirect to retry
      ].join('\n');

      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
      });
      res.end(minimalPlaylist);
      return;
    }

    res.writeHead(404);
    res.end('Segment not found');
    return;
  }

  if (file.redirect) {
    res.writeHead(302, { 'Location': file.redirect });
    res.end();
    return;
  }

  // Serve the file
  const contentType = filename.endsWith('.m3u8')
    ? 'application/vnd.apple.mpegurl'
    : filename.endsWith('.ts')
    ? 'video/mp2t'
    : 'application/octet-stream';

  // For m3u8 files, rewrite segment URLs to go through our proxy
  let content = file.content;
  if (filename.endsWith('.m3u8')) {
    const text = content.toString('utf8');
    // Replace local file paths with proxy URLs
    const rewritten = text.replace(/seg_(\d+)\.ts/g, (match) => {
      return `http://${req.headers.host}/hls/${channelId}/${match}`;
    });
    content = Buffer.from(rewritten, 'utf8');
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': content.length,
    'Cache-Control': filename.endsWith('.m3u8') ? 'no-cache' : 'max-age=3600',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(content);
}

async function handleRefresh(req, res) {
  console.log('[Server] Manual refresh triggered');

  const sessionOk = await sessionManager.refreshSession();
  let channelsOk = false;

  if (sessionOk) {
    const channels = await channelResolver.fetchChannels();
    channelsOk = channels.length > 0;
    channelCount = channels.length;
  }

  sendJSON(res, 200, {
    session: sessionOk,
    channels: channelsOk,
    channelCount,
  });
}

function handleDebugSession(req, res) {
  sendJSON(res, 200, {
    session: sessionManager.getStatus(),
    tokens: {
      packages: sessionManager.tokens.packages ? `${sessionManager.tokens.packages.substring(0, 30)}... (${sessionManager.tokens.packages.length} chars)` : null,
      services: sessionManager.tokens.services ? `${sessionManager.tokens.services.substring(0, 30)}... (${sessionManager.tokens.services.length} chars)` : null,
      region: sessionManager.tokens.region ? `${sessionManager.tokens.region.substring(0, 30)}... (${sessionManager.tokens.region.length} chars)` : null,
      session: sessionManager.tokens.session ? `${sessionManager.tokens.session.substring(0, 30)}... (${sessionManager.tokens.session.length} chars)` : null,
    },
    prm: sessionManager.prmToken ? `${sessionManager.prmToken.substring(0, 30)}... (${sessionManager.prmToken.length} chars)` : null,
  });
}

function handleDebugStreams(req, res) {
  sendJSON(res, 200, streamConverter.getStatus());
}

/**
 * POST /set-tokens
 * Accepts fresh tokens from Chrome DevTools.
 * Body: { "packages": "...", "services": "...", "region": "...", "session": "..." }
 * Or: { "userDeviceToken": "...", "profile": "..." } to update login credentials.
 */
async function handleSetTokens(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const json = JSON.parse(body);

      // Option 1: Direct tokens
      if (json.packages) {
        sessionManager.tokens.packages = json.packages;
        sessionManager.tokens.services = json.services || sessionManager.tokens.services;
        sessionManager.tokens.region = json.region || sessionManager.tokens.region;
        sessionManager.tokens.session = json.session || sessionManager.tokens.session;
        sessionManager.sessionExpiry = Date.now() + 4 * 3600 * 1000;
        sessionManager.usedFallback = false;
        console.log('[Server] Tokens updated via /set-tokens');

        // Re-fetch channels with new tokens
        const channels = await channelResolver.fetchChannels();
        channelCount = channels.length;

        sendJSON(res, 200, { ok: true, channelCount, message: 'Tokens updated' });
        return;
      }

      // Option 2: Login credentials
      if (json.userDeviceToken) {
        sessionManager.config.userDeviceToken = json.userDeviceToken;
        sessionManager.config.profile = json.profile || sessionManager.config.profile;
        sessionManager.config.casId = json.casId || sessionManager.config.casId;
        console.log('[Server] Credentials updated via /set-tokens');

        const ok = await sessionManager.refreshSession();
        if (ok) {
          const channels = await channelResolver.fetchChannels();
          channelCount = channels.length;
        }

        sendJSON(res, 200, { ok, channelCount, message: ok ? 'Session refreshed' : 'Session refresh failed' });
        return;
      }

      sendJSON(res, 400, { error: 'Provide packages+services+region or userDeviceToken' });
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
    }
  });
}

// =====================================
// Utility functions
// =====================================

function sendJSON(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// =====================================
// Initialization
// =====================================

async function initialize() {
  console.log('='.repeat(60));
  console.log('  FlowTV Stream Proxy Server');
  console.log('='.repeat(60));
  console.log(`  Port: ${PORT}`);
  console.log(`  Local IPs: ${getLocalIPs().join(', ')}`);
  console.log(`  ffmpeg: ${fs.existsSync('/tmp/ffmpeg') ? 'found' : 'NOT FOUND'}`);
  console.log('='.repeat(60));

  // Step 1: Get session tokens
  console.log('\n[Init] Step 1: Refreshing session...');
  const sessionOk = await sessionManager.refreshSession();
  if (!sessionOk) {
    initError = 'Failed to get session tokens';
    console.error(`[Init] ${initError}`);
    // Continue anyway - tokens might be stale but channels API sometimes works
  }

  // Step 2: Fetch channels
  console.log('\n[Init] Step 2: Fetching channels...');
  const channels = await channelResolver.fetchChannels();
  channelCount = channels.length;
  if (channelCount > 0) {
    console.log(`[Init] Loaded ${channelCount} channels`);
    // Log first 10
    channels.slice(0, 10).forEach(ch => {
      console.log(`  ${ch.number.toString().padStart(4)} | ${ch.name}`);
    });
    if (channelCount > 10) {
      console.log(`  ... and ${channelCount - 10} more`);
    }
  } else {
    initError = (initError || '') + ' No channels loaded.';
    console.warn('[Init] No channels loaded');
  }

  // Step 3: Register PRM (needed for stream resolution)
  console.log('\n[Init] Step 3: Registering PRM...');
  const prmOk = await sessionManager.registerPRM();
  if (!prmOk) {
    console.warn('[Init] PRM registration failed (streams may not work)');
  }

  // Step 4: Start CSDK bridge in background (non-blocking)
  console.log('\n[Init] Step 4: Starting CSDK bridge (background)...');
  csdkBridge.start().catch(err => {
    console.warn(`[Init] CSDK bridge failed: ${err.message} (non-critical)`);
  });

  serverReady = true;
  console.log('\n' + '='.repeat(60));
  console.log('  Server ready!');
  console.log(`  Status:     http://localhost:${PORT}/status`);
  console.log(`  Channels:   http://localhost:${PORT}/channels`);
  console.log(`  Stream:     http://localhost:${PORT}/stream/{channelId}`);
  console.log(`  HLS:        http://localhost:${PORT}/hls/{channelId}/stream.m3u8`);
  console.log(`  Set Tokens: POST http://localhost:${PORT}/set-tokens`);
  console.log('');
  if (channelCount === 0) {
    console.log('  NOTE: No channels loaded. To update tokens, POST to /set-tokens:');
    console.log('  curl -X POST http://localhost:' + PORT + '/set-tokens \\');
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"packages":"...","services":"...","region":"...","session":"..."}\'');
  }
  console.log('='.repeat(60));
}

// =====================================
// Start server
// =====================================

server.listen(PORT, HOST, () => {
  console.log(`[Server] Listening on http://${HOST}:${PORT}`);
  initialize().catch(err => {
    console.error(`[Init] Fatal error: ${err.message}`);
    initError = err.message;
  });
});

// Auto-refresh session every 4 hours
setInterval(async () => {
  console.log('[AutoRefresh] Refreshing session...');
  await sessionManager.refreshSession();
  await channelResolver.fetchChannels();
}, 4 * 3600 * 1000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  streamConverter.stopAll();
  await csdkBridge.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] Terminated');
  streamConverter.stopAll();
  await csdkBridge.stop();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error(`[Server] Uncaught exception: ${err.message}`);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[Server] Unhandled rejection: ${reason}`);
});
