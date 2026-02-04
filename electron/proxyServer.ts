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

interface DownloadTask {
    currentSize: number;
    totalSize: number;
    contentType: string;
    abortController: AbortController | null;
    promise: Promise<void> | null;
}

// Memory cache for resolved URLs
const urlCache = new Map<string, CacheEntry>();

// Track background download tasks
const downloadTasks = new Map<string, DownloadTask>();

function getCachePath(source: string, id: string, quality: string) {
    const dir = ensureCacheDir();
    const safeId = id.replace(/[^a-z0-9]/gi, '_');
    return path.join(dir, `${source}-${safeId}-${quality}`);
}

function getMetadataPath(cachePath: string): string {
    return cachePath + '.meta';
}

function getTempPath(cachePath: string): string {
    return cachePath + '.tmp';
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
    try {
        const metadata = readMetadata(filePath);
        if (!metadata || !metadata.complete) return false;
        if (!fs.existsSync(filePath)) return false;

        const stat = fs.statSync(filePath);
        return stat.size === metadata.totalSize && stat.size > 1024;
    } catch {
        return false;
    }
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
    try {
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
    } catch (e) {
        console.error('[Proxy] Error serving from cache:', e);
        return false;
    }
}

/**
 * 直接代理 Range 请求，不缓存（用于 seek 到未下载的位置）
 */
async function proxyRangeDirect(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetUrl: string,
    totalSize: number,
    contentType: string
): Promise<void> {
    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    if (req.headers.range) {
        headers['Range'] = req.headers.range;
    }

    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: headers,
    });

    if (!response.ok && response.status !== 206) {
        throw { statusCode: response.status, statusText: response.statusText };
    }

    // Forward response headers
    const responseContentType = response.headers.get('content-type') || contentType || 'audio/mpeg';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');

    if (response.status === 206 && contentRange) {
        res.writeHead(206, {
            'Content-Type': responseContentType,
            'Content-Length': contentLength || '',
            'Content-Range': contentRange,
            'Accept-Ranges': 'bytes',
        });
    } else {
        res.writeHead(200, {
            'Content-Type': responseContentType,
            'Content-Length': contentLength || '',
            'Accept-Ranges': 'bytes',
        });
    }

    if (!response.body) {
        res.end();
        return;
    }

    // @ts-ignore
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);

    return new Promise((resolve, reject) => {
        nodeStream.on('end', resolve);
        nodeStream.on('error', reject);
        res.on('close', () => {
            nodeStream.destroy();
            resolve();
        });
    });
}

/**
 * 从部分下载的缓存中读取已下载的部分
 */
function serveFromPartialCache(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    filePath: string,
    task: DownloadTask
): boolean {
    try {
        const tempPath = getTempPath(filePath);
        if (!fs.existsSync(tempPath)) return false;

        const range = parseRangeHeader(req.headers.range, task.totalSize);
        if (!range) return false;

        const { start, end } = range;

        // 检查请求的范围是否已下载
        if (end >= task.currentSize) {
            return false; // 还没下载到这里
        }

        const chunksize = (end - start) + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${task.totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': task.contentType || 'audio/mpeg',
        });

        const file = fs.createReadStream(tempPath, { start, end });
        file.pipe(res);

        return true;
    } catch (e) {
        console.error('[Proxy] Error serving from partial cache:', e);
        return false;
    }
}

/**
 * 启动后台下载任务（不阻塞当前请求）
 */
function startBackgroundDownload(
    targetUrl: string,
    cacheFilePath: string,
    cacheKey: string
): DownloadTask {
    const existingTask = downloadTasks.get(cacheFilePath);
    if (existingTask) {
        return existingTask;
    }

    const abortController = new AbortController();
    const task: DownloadTask = {
        currentSize: 0,
        totalSize: 0,
        contentType: 'audio/mpeg',
        abortController,
        promise: null,
    };

    downloadTasks.set(cacheFilePath, task);

    task.promise = (async () => {
        const tempPath = getTempPath(cacheFilePath);

        try {
            // 清理旧文件
            try {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch { }

            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: abortController.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const contentType = response.headers.get('content-type') || 'audio/mpeg';

            if (!contentLength) {
                console.warn('[Proxy] Background download: No content-length, skipping cache');
                downloadTasks.delete(cacheFilePath);
                return;
            }

            task.totalSize = contentLength;
            task.contentType = contentType;

            console.log(`[Proxy] Background download started: ${cacheFilePath} (${contentLength} bytes)`);

            const fileStream = fs.createWriteStream(tempPath);

            if (!response.body) {
                downloadTasks.delete(cacheFilePath);
                return;
            }

            // @ts-ignore
            const nodeStream = Readable.fromWeb(response.body);

            await new Promise<void>((resolve, reject) => {
                nodeStream.on('data', (chunk: Buffer) => {
                    task.currentSize += chunk.length;
                });

                nodeStream.pipe(fileStream);

                fileStream.on('finish', () => {
                    // 验证并移动文件
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
                            console.log(`[Proxy] Background download complete: ${cacheFilePath}`);
                        } else {
                            console.warn(`[Proxy] Incomplete download: ${stat.size}/${contentLength}`);
                            try { fs.unlinkSync(tempPath); } catch { }
                        }
                    } catch (e) {
                        console.error('[Proxy] Failed to finalize cache:', e);
                        try { fs.unlinkSync(tempPath); } catch { }
                    }
                    resolve();
                });

                fileStream.on('error', (err) => {
                    console.error('[Proxy] Background download write error:', err);
                    try { fs.unlinkSync(tempPath); } catch { }
                    reject(err);
                });

                nodeStream.on('error', (err: Error) => {
                    console.error('[Proxy] Background download stream error:', err);
                    fileStream.destroy();
                    try { fs.unlinkSync(tempPath); } catch { }
                    reject(err);
                });
            });

        } catch (e: any) {
            if (e.name !== 'AbortError') {
                console.error('[Proxy] Background download failed:', e);
            }
            try { fs.unlinkSync(tempPath); } catch { }
        } finally {
            downloadTasks.delete(cacheFilePath);
        }
    })();

    return task;
}

/**
 * 主代理函数 - 智能处理缓存和 Range 请求
 */
async function proxyAndCache(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetUrl: string,
    cacheFilePath: string,
    cacheKey: string
): Promise<void> {
    const requestedRange = req.headers.range;
    const isSeekRequest = requestedRange && !requestedRange.startsWith('bytes=0-');

    // 检查是否有正在进行的后台下载
    let task = downloadTasks.get(cacheFilePath);

    if (task) {
        console.log(`[Proxy] Download in progress: ${task.currentSize}/${task.totalSize}`);

        // 尝试从部分缓存中读取
        if (requestedRange && task.totalSize > 0) {
            const range = parseRangeHeader(requestedRange, task.totalSize);

            if (range) {
                // 检查请求的数据是否已下载
                // 给一些缓冲区间（已下载部分的 95%）
                const safeEnd = Math.floor(task.currentSize * 0.95);

                if (range.end < safeEnd && range.start < safeEnd) {
                    console.log(`[Proxy] Serving range ${range.start}-${range.end} from partial cache (downloaded: ${task.currentSize})`);
                    if (serveFromPartialCache(req, res, cacheFilePath, task)) {
                        return;
                    }
                }

                // 请求的数据还没下载到，直接代理这个 Range
                console.log(`[Proxy] Range ${range.start}-${range.end} not cached yet (downloaded: ${task.currentSize}), proxying directly`);
                await proxyRangeDirect(req, res, targetUrl, task.totalSize, task.contentType);
                return;
            }
        }

        // 无法确定如何处理，直接代理
        await proxyRangeDirect(req, res, targetUrl, task.totalSize, task.contentType);
        return;
    }

    // 没有正在进行的下载任务

    if (isSeekRequest) {
        // Seek 请求：启动后台下载任务，同时直接代理当前请求
        console.log(`[Proxy] Seek request: ${requestedRange}, starting background download`);

        // 启动后台下载（不等待）
        startBackgroundDownload(targetUrl, cacheFilePath, cacheKey);

        // 获取文件信息用于正确的 Range 响应
        const headResponse = await fetch(targetUrl, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const totalSize = parseInt(headResponse.headers.get('content-length') || '0', 10);
        const contentType = headResponse.headers.get('content-type') || 'audio/mpeg';

        // 直接代理当前的 Range 请求
        await proxyRangeDirect(req, res, targetUrl, totalSize, contentType);
        return;
    }

    // 从头开始的请求：启动主下载任务并流式返回

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
        res.writeHead(200, {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
        });

        if (response.body) {
            // @ts-ignore
            const nodeStream = Readable.fromWeb(response.body);
            nodeStream.pipe(res);
        } else {
            res.end();
        }
        return;
    }

    // 设置下载任务
    const tempPath = getTempPath(cacheFilePath);

    // 清理旧文件
    try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        if (fs.existsSync(cacheFilePath)) fs.unlinkSync(cacheFilePath);
    } catch { }

    const fileStream = fs.createWriteStream(tempPath);

    task = {
        currentSize: 0,
        totalSize: contentLength,
        contentType: contentType,
        abortController: null,
        promise: null,
    };
    downloadTasks.set(cacheFilePath, task);

    console.log(`[Proxy] Starting stream download: ${cacheFilePath} (${contentLength} bytes)`);

    // 发送响应头
    res.writeHead(200, {
        'Content-Length': contentLength,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
    });

    if (!response.body) {
        res.end();
        downloadTasks.delete(cacheFilePath);
        return;
    }

    // @ts-ignore
    const nodeStream = Readable.fromWeb(response.body);
    const passThrough = new PassThrough();

    // 跟踪下载进度
    passThrough.on('data', (chunk: Buffer) => {
        if (task) {
            task.currentSize += chunk.length;
        }
    });

    // 流到客户端
    passThrough.pipe(res);

    // 流到文件
    nodeStream.pipe(passThrough);
    nodeStream.pipe(fileStream);

    // 处理完成
    const cleanup = (success: boolean, error?: Error) => {
        downloadTasks.delete(cacheFilePath);

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
            // 不删除临时文件，让后续请求可以继续
        }
    };

    fileStream.on('finish', () => cleanup(true));
    fileStream.on('error', (err) => cleanup(false, err));
    nodeStream.on('error', (err: Error) => {
        cleanup(false, err);
        if (!res.headersSent) {
            res.writeHead(502);
            res.end('Proxy stream error');
        }
    });

    // 客户端断开时不终止下载
    res.on('close', () => {
        if (!res.writableEnded) {
            console.log('[Proxy] Client disconnected, download continues in background');
        }
    });
}

let persistCacheEnabled = true;

export function getCacheDir() {
    return ensureCacheDir();
}

export function getCacheSize(): string {
    const dir = ensureCacheDir();
    if (!fs.existsSync(dir)) return '0 B';

    let totalSize = 0;
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    totalSize += stat.size;
                }
            } catch { }
        }
    } catch (e) {
        console.error('[Proxy] Error calculating cache size:', e);
    }

    if (totalSize < 1024) return `${totalSize} B`;
    if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
    if (totalSize < 1024 * 1024 * 1024) return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
    return `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function isPersistCacheEnabled() {
    return persistCacheEnabled;
}

export function setPersistCache(persist: boolean) {
    persistCacheEnabled = persist;
    console.log(`[Proxy] Cache persistence set to: ${persist}`);
}

export function clearCacheNow() {
    const dir = ensureCacheDir();
    if (fs.existsSync(dir)) {
        console.log(`[Proxy] Clearing cache directory: ${dir}`);

        // 终止所有下载任务
        for (const [, task] of downloadTasks) {
            if (task.abortController) {
                task.abortController.abort();
            }
        }
        downloadTasks.clear();

        try {
            fs.rmSync(dir, { recursive: true, force: true });
            fs.mkdirSync(dir, { recursive: true });
            console.log('[Proxy] Cache cleared');
        } catch (e) {
            console.error('[Proxy] Failed to clear cache:', e);
        }
    }
}

export function cleanupCache() {
    if (!persistCacheEnabled && CACHE_DIR && fs.existsSync(CACHE_DIR)) {
        console.log(`[Proxy] Cleaning up cache directory: ${CACHE_DIR}`);

        // 终止所有下载任务
        for (const [, task] of downloadTasks) {
            if (task.abortController) {
                task.abortController.abort();
            }
        }
        downloadTasks.clear();

        try {
            fs.rmSync(CACHE_DIR, { recursive: true, force: true });
            console.log('[Proxy] Cache cleanup complete');
        } catch (e) {
            console.error('[Proxy] Failed to cleanup cache:', e);
        }
    }
}

/**
 * 清理过期的临时文件
 */
function cleanupTempFiles() {
    const dir = ensureCacheDir();
    try {
        const files = fs.readdirSync(dir);
        const now = Date.now();

        for (const file of files) {
            if (file.endsWith('.tmp')) {
                const filePath = path.join(dir, file);
                const cacheFilePath = filePath.replace('.tmp', '');

                // 如果没有正在下载这个文件，且临时文件超过 1 小时，删除它
                if (!downloadTasks.has(cacheFilePath)) {
                    try {
                        const stat = fs.statSync(filePath);
                        if (now - stat.mtimeMs > 3600 * 1000) {
                            fs.unlinkSync(filePath);
                            console.log(`[Proxy] Cleaned up stale temp file: ${file}`);
                        }
                    } catch { }
                }
            }
        }
    } catch (e) {
        console.error('[Proxy] Error cleaning up temp files:', e);
    }
}

export function startProxyServer(persistCache: boolean = true) {
    persistCacheEnabled = persistCache;
    console.log(`[Proxy] Persist cache: ${persistCache}`);

    // 定期清理临时文件
    setInterval(cleanupTempFiles, 30 * 60 * 1000); // 每 30 分钟

    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range');

        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }

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

            // 1. 检查完整缓存
            if (isValidCacheFile(cacheFilePath)) {
                console.log(`[Proxy] Serving from complete cache: ${cacheFilePath}`);
                const success = serveFromCache(req, res, cacheFilePath);
                if (success) return;

                // 缓存无效，清理
                console.warn('[Proxy] Cache file invalid, cleaning up...');
                try {
                    fs.unlinkSync(cacheFilePath);
                    fs.unlinkSync(getMetadataPath(cacheFilePath));
                } catch { }
            }

            // 2. 解析 URL
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

            // 3. 代理和缓存
            const maxAttempts = 3;
            let currentAttempt = 0;
            let lastError: any = null;

            while (currentAttempt < maxAttempts) {
                try {
                    await proxyAndCache(req, res, playUrl, cacheFilePath, cacheKey);
                    break;
                } catch (e: any) {
                    lastError = e;
                    currentAttempt++;
                    console.warn(`[Proxy] Proxy error (Attempt ${currentAttempt}/${maxAttempts}):`, e);

                    if (currentAttempt < maxAttempts) {
                        console.log('[Proxy] Error occurred, refreshing URL from plugin...');

                        // 清除 URL 缓存
                        urlCache.delete(cacheKey);

                        // 获取新 URL
                        const newUrl = await fetchFreshUrl(source, id, quality);
                        if (newUrl) {
                            playUrl = newUrl;
                            continue;
                        } else {
                            console.error('[Proxy] Failed to refresh URL');
                        }
                    }

                    // 发送错误响应
                    if (!res.headersSent) {
                        res.writeHead(lastError?.statusCode || 502);
                        res.end('Proxy Error');
                    }
                    break;
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
        cleanupTempFiles(); // 启动时清理
        console.log(`[Proxy] Server running at http://127.0.0.1:${PORT}/music`);
        console.log(`[Proxy] Cache dir: ${CACHE_DIR}`);
    });

    return server;
}
