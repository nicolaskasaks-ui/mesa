/**
 * stream-converter.js
 *
 * Converts DASH streams to HLS using ffmpeg for Apple TV playback.
 * Also handles passthrough for already-HLS streams.
 *
 * For each channel being watched, spawns an ffmpeg process that:
 *   1. Reads the source stream (DASH MPD or HLS)
 *   2. Remuxes to HLS (copy codecs, no re-encoding)
 *   3. Writes .m3u8 + .ts segments to a temp directory
 *   4. Serves via the proxy HTTP server
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG_PATH = '/tmp/ffmpeg';
const HLS_DIR = '/tmp/flowtv-hls';

class StreamConverter {
  constructor() {
    this.activeStreams = new Map(); // channelId -> { process, dir, startTime, sourceUrl }
    this.MAX_CONCURRENT = 3; // max concurrent transcodes

    // Ensure HLS output directory exists
    if (!fs.existsSync(HLS_DIR)) {
      fs.mkdirSync(HLS_DIR, { recursive: true });
    }

    // Verify ffmpeg exists
    if (!fs.existsSync(FFMPEG_PATH)) {
      console.error(`[StreamConverter] WARNING: ffmpeg not found at ${FFMPEG_PATH}`);
    } else {
      console.log(`[StreamConverter] ffmpeg found at ${FFMPEG_PATH}`);
    }
  }

  /**
   * Start converting a stream to HLS for a channel.
   * Returns the local HLS manifest path.
   */
  async startStream(channelId, sourceUrl, format = 'dash', drmInfo = null) {
    // If already streaming this channel, return existing
    if (this.activeStreams.has(channelId)) {
      const existing = this.activeStreams.get(channelId);
      if (existing.process && !existing.process.killed) {
        console.log(`[StreamConverter] Stream already active for ${channelId}`);
        return existing;
      }
      // Dead process, clean up
      this.stopStream(channelId);
    }

    // Evict oldest if at capacity
    if (this.activeStreams.size >= this.MAX_CONCURRENT) {
      const oldest = [...this.activeStreams.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess)[0];
      if (oldest) {
        console.log(`[StreamConverter] Evicting oldest stream: ${oldest[0]}`);
        this.stopStream(oldest[0]);
      }
    }

    // Create channel HLS directory
    const channelDir = path.join(HLS_DIR, channelId);
    if (!fs.existsSync(channelDir)) {
      fs.mkdirSync(channelDir, { recursive: true });
    } else {
      // Clean old segments
      const files = fs.readdirSync(channelDir);
      for (const f of files) {
        fs.unlinkSync(path.join(channelDir, f));
      }
    }

    const outputPath = path.join(channelDir, 'stream.m3u8');

    // If source is already HLS and no DRM, we can potentially just proxy it
    if (format === 'hls' && !drmInfo) {
      console.log(`[StreamConverter] HLS passthrough for ${channelId}: ${sourceUrl}`);
      const stream = {
        channelId,
        sourceUrl,
        format: 'hls_passthrough',
        dir: channelDir,
        manifestPath: null, // null means passthrough - redirect to source
        passthroughUrl: sourceUrl,
        process: null,
        startTime: Date.now(),
        lastAccess: Date.now(),
        ready: true,
        error: null,
      };
      this.activeStreams.set(channelId, stream);
      return stream;
    }

    // For DASH or DRM streams, use ffmpeg to convert
    console.log(`[StreamConverter] Starting ffmpeg for ${channelId}: ${sourceUrl} (format=${format})`);

    const ffmpegArgs = this._buildFfmpegArgs(sourceUrl, outputPath, format, drmInfo);
    console.log(`[StreamConverter] ffmpeg args: ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stream = {
      channelId,
      sourceUrl,
      format,
      dir: channelDir,
      manifestPath: outputPath,
      passthroughUrl: null,
      process: ffmpeg,
      startTime: Date.now(),
      lastAccess: Date.now(),
      ready: false,
      error: null,
      ffmpegLog: [],
    };

    // Log ffmpeg output
    ffmpeg.stderr.on('data', (data) => {
      const line = data.toString().trim();
      stream.ffmpegLog.push(line);
      if (stream.ffmpegLog.length > 50) stream.ffmpegLog.shift();

      // Detect when first segment is ready
      if (line.includes('Opening') && line.includes('.ts') && !stream.ready) {
        stream.ready = true;
        console.log(`[StreamConverter] Stream ready for ${channelId}`);
      }

      // Log errors
      if (line.toLowerCase().includes('error') || line.includes('403') || line.includes('404')) {
        console.log(`[StreamConverter:ffmpeg] ${channelId}: ${line}`);
      }
    });

    ffmpeg.stdout.on('data', (data) => {
      // ffmpeg usually doesn't write to stdout in this mode
    });

    ffmpeg.on('exit', (code, signal) => {
      console.log(`[StreamConverter] ffmpeg exited for ${channelId}: code=${code}, signal=${signal}`);
      if (code !== 0 && !stream.error) {
        stream.error = `ffmpeg exited with code ${code}`;
        const lastLogs = stream.ffmpegLog.slice(-5).join('\n');
        console.error(`[StreamConverter] Last ffmpeg output:\n${lastLogs}`);
      }
    });

    ffmpeg.on('error', (err) => {
      stream.error = err.message;
      console.error(`[StreamConverter] ffmpeg error for ${channelId}: ${err.message}`);
    });

    this.activeStreams.set(channelId, stream);

    // Wait for stream to become ready (up to 15s)
    const readyTimeout = 15000;
    const startWait = Date.now();
    while (!stream.ready && !stream.error && (Date.now() - startWait) < readyTimeout) {
      await new Promise(r => setTimeout(r, 500));
      // Also check if manifest file exists
      if (fs.existsSync(outputPath)) {
        stream.ready = true;
      }
    }

    if (!stream.ready && !stream.error) {
      console.log(`[StreamConverter] Timed out waiting for stream ${channelId}`);
      // Don't kill it yet - it might just be slow
    }

    return stream;
  }

  /**
   * Stop a stream conversion
   */
  stopStream(channelId) {
    const stream = this.activeStreams.get(channelId);
    if (!stream) return;

    console.log(`[StreamConverter] Stopping stream ${channelId}`);

    if (stream.process && !stream.process.killed) {
      stream.process.kill('SIGTERM');
      setTimeout(() => {
        if (stream.process && !stream.process.killed) {
          stream.process.kill('SIGKILL');
        }
      }, 3000);
    }

    // Clean up files
    if (stream.dir && fs.existsSync(stream.dir)) {
      try {
        const files = fs.readdirSync(stream.dir);
        for (const f of files) {
          fs.unlinkSync(path.join(stream.dir, f));
        }
        fs.rmdirSync(stream.dir);
      } catch (err) {
        // ignore cleanup errors
      }
    }

    this.activeStreams.delete(channelId);
  }

  /**
   * Get a stream's manifest or segment file
   */
  getFile(channelId, filename) {
    const stream = this.activeStreams.get(channelId);
    if (!stream) return null;

    stream.lastAccess = Date.now();

    // Passthrough mode - return source URL
    if (stream.passthroughUrl && filename === 'stream.m3u8') {
      return { redirect: stream.passthroughUrl };
    }

    const filePath = path.join(stream.dir, filename);
    if (fs.existsSync(filePath)) {
      return { path: filePath, content: fs.readFileSync(filePath) };
    }

    return null;
  }

  /**
   * Get stream info
   */
  getStreamInfo(channelId) {
    const stream = this.activeStreams.get(channelId);
    if (!stream) return null;

    return {
      channelId: stream.channelId,
      sourceUrl: stream.sourceUrl,
      format: stream.format,
      ready: stream.ready,
      error: stream.error,
      uptime: Math.floor((Date.now() - stream.startTime) / 1000),
      isPassthrough: !!stream.passthroughUrl,
      ffmpegLog: stream.ffmpegLog ? stream.ffmpegLog.slice(-10) : [],
    };
  }

  /**
   * Build ffmpeg arguments for stream conversion
   */
  _buildFfmpegArgs(sourceUrl, outputPath, format, drmInfo) {
    const args = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-stats',
    ];

    // Input options
    if (format === 'dash') {
      // For DASH, we need specific protocol handling
      args.push(
        '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
        '-re', // Read at realtime speed
      );
    }

    // ClearKey DRM handling
    if (drmInfo && drmInfo.type === 'clearkey' && drmInfo.key) {
      args.push('-decryption_key', drmInfo.key);
    }

    // Input
    args.push('-i', sourceUrl);

    // Output options - remux only, no re-encoding
    args.push(
      '-c', 'copy',           // Copy all codecs
      '-f', 'hls',            // Output HLS format
      '-hls_time', '4',       // 4-second segments
      '-hls_list_size', '10', // Keep 10 segments in playlist
      '-hls_flags', 'delete_segments+append_list+omit_endlist',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(path.dirname(outputPath), 'seg_%05d.ts'),
    );

    // For live streams
    if (format === 'dash' || format === 'hls') {
      args.push(
        '-hls_flags', 'delete_segments+append_list+omit_endlist',
      );
    }

    args.push(outputPath);

    return args;
  }

  /**
   * Stop all streams
   */
  stopAll() {
    console.log(`[StreamConverter] Stopping all ${this.activeStreams.size} streams`);
    for (const channelId of this.activeStreams.keys()) {
      this.stopStream(channelId);
    }
  }

  /**
   * Get status of all active streams
   */
  getStatus() {
    const streams = {};
    for (const [id, stream] of this.activeStreams) {
      streams[id] = {
        format: stream.format,
        ready: stream.ready,
        error: stream.error,
        uptime: Math.floor((Date.now() - stream.startTime) / 1000),
        isPassthrough: !!stream.passthroughUrl,
      };
    }
    return {
      ffmpegPath: FFMPEG_PATH,
      ffmpegExists: fs.existsSync(FFMPEG_PATH),
      hlsDir: HLS_DIR,
      activeStreams: streams,
      maxConcurrent: this.MAX_CONCURRENT,
    };
  }
}

module.exports = StreamConverter;
