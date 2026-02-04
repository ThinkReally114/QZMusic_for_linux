import http from 'http';
import { Readable, PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
// @ts-ignore
import { PluginSystem } from '../src/main/pluginSystem.ts';

const PORT = 5266;
let CACHE_DIR = '';

function ensureCacheDir() {
    if (!CACHE_DIR) {
        CACHE_DIR = path.join(app.getPath('userData'), 'music', 'cache');
    }
    if (!fs.existsSync(CACHE_DIR)) {
        try {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
            console.log(`[Proxy] Created cache directory: ${CACHE_DIR}`);
        } catch (e) {
            console.error('[Proxy] Failed to create cache directory:', e);
        }
    }
    return CACHE_DIR;
}

interface CacheEntry {
    url: string;
    expiresAt: number;
}

interface CacheMetadata {
    totalSize: number;
    contentType: string;
    complete: boolean;
    createdAt: number;
}

// Memory cache for resolved URLs
const urlCache = new Map<string, CacheEntry>();
// Track in-progress downloads with their current size
const downloadingFiles = new Map<string, {
    currentSize: number;
    totalSize: number;
    writeStream: fs.WriteStream | null;
}>();

function getCachePath(source: string, id: string, quality: string) {
    const dir = ensureCacheDir();
    const safeId = id.replace(/[^a-z0-9]/gi, '_');
    return path.join(dir, `${source}-${safeId}-${quality}`);
}

function getMetadataPath(cachePath: string): string {
    return cachePath + '.meta';
}

function readMetadata(cachePath: string): CacheMetadata | null {
    const metaPath = getMetadataPath(cachePath);
    try {
        if (fs.existsSync(metaPath)) {
            return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        }
    } catch (e) {
        console.error('[Proxy] Failed to read metadata:', e);
    }
    return null;
}

function writeMetadata(cachePath: string, metadata: CacheMetadata) {
    const metaPath = getMetadataPath(cachePath);
    try {
        fs.writeFileSync(metaPath, JSON.stringify(metadata));
    } catch (e) {
        console.error('[Proxy] Failed to write metadata:', e);
    }
}

async function fetchFreshUrl(source: string, id: string, quality: string): Promise<string | null> {
    try {
        const plugin = new PluginSystem(source);
        const result = await plugin.getUrl(id, quality);
        if (result.success && result.url) {
            urlCache.set(`${source}:${id}:${quality}`, {
                url: result.url,
                expiresAt: Date.now() + 3600 * 1000
            });
            return result.url;
        }
        console.error(`[Proxy] Failed to fetch URL for ${source}:${id}`, result.error);
        return null;
    } catch (e) {
        console.error(`[Proxy] Error fetching URL:`, e);
        return null;
    }
}

function isValidCacheFile(filePath: string): boolean {
    const metadata = readMetadata(filePath);
    if (!metadata || !metadata.complete) return false;

    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);

    // Verify the file size matches expected total
    return stat.size === metadata.totalSize && stat.size > 1024;
}

function parseRangeHeader(range: string | undefined, fileSize: number): { start: number; end: number } | null {
    if (!range) return null;

    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (!match) return null;

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize) return null;
    end = Math.min(end, fileSize - 1);

    return { start, end };
}

function serveFromCache(req: http.IncomingMessage, res: http.ServerResponse, filePath: string): boolean {
    const metadata = readMetadata(filePath);
    if (!metadata) {
        console.warn('[Proxy] No metadata for cache file');
        return false;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = parseRangeHeader(req.headers.range, fileSize);

    if (range) {
        const { start, end } = range;
        const chunksize = (end - start) + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': metadata.contentType || 'audio/mpeg',
        });

        const file = fs.createReadStream(filePath, { start, end });
        file.pipe(res);

        file.on('error', (err) => {
            console.error('[Proxy] Error reading cache file:', err);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end('Cache read error');
            }
        });
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': metadata.contentType || 'audio/mpeg',
            'Accept-Ranges': 'bytes',
        });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);

        stream.on('error', (err) => {
            console.error('[Proxy] Error reading cache file:', err);
        });
    }
    return true;
}

async function proxyWithoutCache(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetUrl: string
): Promise<void> {
    const headers: Record<string, string> = {};

    if (req.headers.range) {
        headers['Range'] = req.headers.range;
    }
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: headers,
    });

    if (!response.ok) {
        throw { statusCode: response.status, statusText: response.statusText };
    }

    const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    headersToForward.forEach(h => {
        const val = response.headers.get(h);
        if (val) res.setHeader(h, val);
    });

    res.statusCode = response.status;

    if (!response.body) {
        res.end();
        return;
    }

    // @ts-ignore
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);

    nodeStream.on('error', (err: Error) => {
        console.error('[Proxy] Stream error:', err);
        if (!res.headersSent) {
            res.writeHead(502);
            res.end('Proxy stream error');
        }
    });
}

async function proxyAndCache(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetUrl: string,
    cacheFilePath: string
): Promise<void> {
    const requestedRange = req.headers.range;

    // Check if already downloading
    const downloadState = downloadingFiles.get(cacheFilePath);
    if (downloadState) {
        // Another request is already downloading this file
        console.log(`[Proxy] File already downloading, current: ${downloadState.currentSize}/${downloadState.totalSize}`);

        // For range requests, check if we can serve from partial cache
        if (requestedRange) {
            const range = parseRangeHeader(requestedRange, downloadState.totalSize);
            if (range && range.end < downloadState.currentSize) {
                // Requested range is fully downloaded, serve from cache
                console.log(`[Proxy] Serving range from in-progress cache`);

                const { start, end } = range;
                const chunksize = (end - start) + 1;

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${downloadState.totalSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'audio/mpeg',
                });

                const file = fs.createReadStream(cacheFilePath, { start, end });
                file.pipe(res);
                return;
            }
        }

        // Can't serve from cache, proxy directly
        await proxyWithoutCache(req, res, targetUrl);
        return;
    }

    // Check if this is a range request that doesn't start from 0
    if (requestedRange && !requestedRange.startsWith('bytes=0-')) {
        // This is a seek request - we need to fetch total size first
        // then decide whether to start a full download or just proxy
        console.log(`[Proxy] Range request without cache: ${requestedRange}`);
        await proxyWithoutCache(req, res, targetUrl);
        return;
    }

    // Start a fresh download from the beginning
    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: headers,
    });

    if (!response.ok) {
        throw { statusCode: response.status, statusText: response.statusText };
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    const contentType = response.headers.get('content-type') || 'audio/mpeg';

    if (!contentLength) {
        console.warn('[Proxy] No content-length, proxying without cache');
        res.setHeader('Content-Type', contentType);
        res.statusCode = 200;

        if (response.body) {
            // @ts-ignore
            const nodeStream = Readable.fromWeb(response.body);
            nodeStream.pipe(res);
        } else {
            res.end();
        }
        return;
    }

    // Setup caching
    const tempPath = cacheFilePath + '.tmp';

    // Clean up any existing files
    try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        if (fs.existsSync(cacheFilePath)) fs.unlinkSync(cacheFilePath);
    } catch (e) {
        console.error('[Proxy] Cleanup error:', e);
    }

    const fileStream = fs.createWriteStream(tempPath);

    downloadingFiles.set(cacheFilePath, {
        currentSize: 0,
        totalSize: contentLength,
        writeStream: fileStream
    });

    console.log(`[Proxy] Starting download: ${cacheFilePath} (${contentLength} bytes)`);

    // Set response headers
    res.writeHead(200, {
        'Content-Length': contentLength,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
    });

    if (!response.body) {
        res.end();
        downloadingFiles.delete(cacheFilePath);
        return;
    }

    // @ts-ignore
    const nodeStream = Readable.fromWeb(response.body);
    const passThrough = new PassThrough();

    // Track download progress
    let downloadedBytes = 0;
    passThrough.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const state = downloadingFiles.get(cacheFilePath);
        if (state) {
            state.currentSize = downloadedBytes;
        }
    });

    // Pipe to client
    passThrough.pipe(res);

    // Pipe to file
    nodeStream.pipe(passThrough);
    nodeStream.pipe(fileStream);

    // Handle completion
    const cleanup = (success: boolean, error?: Error) => {
        downloadingFiles.delete(cacheFilePath);

        if (success && fs.existsSync(tempPath)) {
            try {
                const stat = fs.statSync(tempPath);
                if (stat.size === contentLength) {
                    fs.renameSync(tempPath, cacheFilePath);
                    writeMetadata(cacheFilePath, {
                        totalSize: contentLength,
                        contentType: contentType,
                        complete: true,
                        createdAt: Date.now()
                    });
                    console.log(`[Proxy] Cache complete: ${cacheFilePath}`);
                } else {
                    console.warn(`[Proxy] Incomplete download: ${stat.size}/${contentLength}`);
                    try { fs.unlinkSync(tempPath); } catch { }
                }
            } catch (e) {
                console.error('[Proxy] Failed to finalize cache:', e);
                try { fs.unlinkSync(tempPath); } catch { }
            }
        } else if (!success) {
            console.error('[Proxy] Download failed:', error);
            try { fs.unlinkSync(tempPath); } catch { }
        }
    };

    fileStream.on('finish', () => cleanup(true));
    fileStream.on('error', (err) => cleanup(false, err));
    nodeStream.on('error', (err: Error) => cleanup(false, err));

    // Handle client disconnect
    res.on('close', () => {
        if (!res.writableEnded) {
            console.log('[Proxy] Client disconnected during download');
            // Don't cleanup - let the download continue in background
        }
    });
}

let persistCacheEnabled = true;

export function cleanupCache() {
    if (!persistCacheEnabled && CACHE_DIR && fs.existsSync(CACHE_DIR)) {
        console.log(`[Proxy] Cleaning up cache directory: ${CACHE_DIR}`);
        try {
            fs.rmSync(CACHE_DIR, { recursive: true, force: true });
            console.log('[Proxy] Cache cleanup complete');
        } catch (e) {
            console.error('[Proxy] Failed to cleanup cache:', e);
        }
    }
}

export function startProxyServer(persistCache: boolean = true) {
    persistCacheEnabled = persistCache;
    console.log(`[Proxy] Persist cache: ${persistCache}`);

    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range');

        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }

        // Handle HEAD requests for range support detection
        if (req.method === 'HEAD') {
            res.setHeader('Accept-Ranges', 'bytes');
            res.statusCode = 200;
            res.end();
            return;
        }

        try {
            const parsedUrl = new URL(req.url || '', `http://localhost:${PORT}`);
            if (parsedUrl.pathname !== '/music') {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }

            const id = parsedUrl.searchParams.get('id');
            const source = parsedUrl.searchParams.get('source');
            const quality = parsedUrl.searchParams.get('quality') || 'standard';

            if (!id || !source) {
                res.writeHead(400);
                res.end('Missing id or source');
                return;
            }

            const cacheKey = `${source}:${id}:${quality}`;
            const cacheFilePath = getCachePath(source, id, quality);

            // 1. Check complete disk cache
            if (isValidCacheFile(cacheFilePath)) {
                console.log(`[Proxy] Serving from complete cache: ${cacheFilePath}`);
                const success = serveFromCache(req, res, cacheFilePath);
                if (success) return;

                // Cache invalid, clean up
                console.warn('[Proxy] Cache file invalid, cleaning up...');
                try {
                    fs.unlinkSync(cacheFilePath);
                    fs.unlinkSync(getMetadataPath(cacheFilePath));
                } catch { }
            }

            // 2. Resolve URL
            let playUrl: string | null = null;
            const memCached = urlCache.get(cacheKey);
            if (memCached && Date.now() < memCached.expiresAt) {
                playUrl = memCached.url;
            }

            if (!playUrl) {
                console.log(`[Proxy] Resolving URL for ${cacheKey}...`);
                playUrl = await fetchFreshUrl(source, id, quality);
            }

            if (!playUrl) {
                res.writeHead(500);
                res.end('Failed to Obtain URL');
                return;
            }

            // 3. Proxy & Cache
            try {
                await proxyAndCache(req, res, playUrl, cacheFilePath);
            } catch (e: any) {
                console.warn(`[Proxy] Proxy error:`, e);
                if (!res.headersSent) {
                    res.writeHead(e.statusCode || 502);
                    res.end('Proxy Error');
                }
            }

        } catch (err) {
            console.error('[Proxy] Internal Error:', err);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        }
    });

    server.listen(PORT, '127.0.0.1', () => {
        ensureCacheDir();
        console.log(`[Proxy] Server running at http://127.0.0.1:${PORT}/music`);
        console.log(`[Proxy] Cache dir: ${CACHE_DIR}`);
    });

    return server;
}
