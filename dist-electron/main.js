var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, BrowserWindow, Menu } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs$1 from "node:fs";
import { spawn } from "child_process";
import { Socket } from "net";
import { EventEmitter } from "events";
import path from "path";
import http from "http";
import { Readable, PassThrough } from "stream";
import fs from "fs";
class MpvController extends EventEmitter {
  constructor(ipcPath) {
    super();
    __publicField(this, "process", null);
    __publicField(this, "socket", null);
    __publicField(this, "ipcPath");
    __publicField(this, "messageBuffer", "");
    this.ipcPath = ipcPath || this.getIpcPath();
  }
  getIpcPath() {
    if (process.platform === "win32") {
      return "\\\\.\\pipe\\qzmusic_mpv_socket";
    }
    return "/tmp/qzmusic_mpv_socket";
  }
  getMpvPath() {
    const appRoot = process.env.APP_ROOT || process.cwd();
    if (process.platform === "win32") {
      return path.join(appRoot, "core", "mpv.exe");
    }
    return "mpv";
  }
  start() {
    const mpvPath = this.getMpvPath();
    console.log("Starting MPV from:", mpvPath);
    this.process = spawn(mpvPath, [
      "--idle",
      "--force-window=no",
      "--no-media-controls",
      `--input-ipc-server=${this.ipcPath}`,
      "--no-terminal",
      // Network cache for smooth playback (disk caching is handled by proxy)
      "--cache=yes",
      "--demuxer-max-bytes=50MiB",
      "--demuxer-readahead-secs=30"
    ]);
    this.process.on("error", (err) => {
      console.error("Failed to start MPV:", err);
      this.emit("error", err);
    });
    this.process.on("exit", (code, signal) => {
      var _a;
      console.log(`MPV exited with code ${code} and signal ${signal}`);
      this.emit("exit", { code, signal });
      (_a = this.socket) == null ? void 0 : _a.destroy();
    });
    this.tryConnect();
  }
  tryConnect(retries = 10) {
    if (retries <= 0) {
      console.error("Could not connect to MPV socket after multiple attempts.");
      return;
    }
    setTimeout(() => {
      this.socket = new Socket();
      this.socket.on("connect", () => {
        console.log("Connected to MPV IPC socket");
        this.emit("ready");
        this.send(["observe_property", 1, "pause"]);
        this.send(["observe_property", 2, "time-pos"]);
        this.send(["observe_property", 3, "duration"]);
        this.send(["observe_property", 4, "idle-active"]);
        this.send(["observe_property", 5, "eof-reached"]);
      });
      this.socket.on("data", (data) => {
        this.handleData(data);
      });
      this.socket.on("error", (_) => {
        var _a;
        (_a = this.socket) == null ? void 0 : _a.destroy();
        this.tryConnect(retries - 1);
      });
      this.socket.connect(this.ipcPath);
    }, 500);
  }
  handleData(data) {
    const raw = data.toString();
    this.messageBuffer += raw;
    const messages = this.messageBuffer.split("\n");
    this.messageBuffer = messages.pop() || "";
    for (const msg of messages) {
      if (!msg.trim()) continue;
      console.log("[IPC]", msg);
      try {
        const json = JSON.parse(msg);
        this.emit("message", json);
        if (json.event) {
          this.emit("event", json);
        }
      } catch (e) {
        console.error("Failed to parse MPV message:", msg);
      }
    }
  }
  async send(command) {
    if (!this.socket || this.socket.destroyed) {
      console.warn("MPV socket not connected");
      return;
    }
    const payload = JSON.stringify({ command });
    console.log("[MPV TX]", payload);
    this.socket.write(payload + "\n");
  }
  // Convenience methods
  async load(url) {
    return this.send(["loadfile", url]);
  }
  async play() {
    return this.send(["set_property", "pause", false]);
  }
  async pause() {
    return this.send(["set_property", "pause", true]);
  }
  async togglePause() {
    return this.send(["cycle", "pause"]);
  }
  async stop() {
    return this.send(["stop"]);
  }
  async setVolume(vol) {
    return this.send(["set_property", "volume", vol]);
  }
  async seek(seconds) {
    return this.send(["seek", seconds, "absolute"]);
  }
  destroy() {
    if (this.process) {
      console.log("Killing MPV process...");
      this.process.kill();
      this.process = null;
    }
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}
const require$2 = createRequire(import.meta.url);
class PluginSystem {
  constructor(pluginId) {
    __publicField(this, "pluginId");
    __publicField(this, "plugin", null);
    this.pluginId = pluginId;
    this.loadPlugin();
  }
  loadPlugin() {
    try {
      const pluginPath = path.join(
        app.getPath("userData"),
        "plugins",
        this.pluginId,
        "index.js"
      );
      if (!fs.existsSync(pluginPath)) {
        throw new Error(`Plugin ${this.pluginId} not found`);
      }
      delete require$2.cache[require$2.resolve(pluginPath)];
      this.plugin = require$2(pluginPath);
    } catch (e) {
      console.error(`[PluginSystem] load failed:`, e);
      this.plugin = null;
    }
  }
  async getUrl(id, quality) {
    var _a;
    if (!((_a = this.plugin) == null ? void 0 : _a.getUrl)) {
      return {
        success: false,
        error: "getUrl not implemented"
      };
    }
    try {
      return await this.plugin.getUrl(id, quality);
    } catch (e) {
      return {
        success: false,
        error: e.message || "plugin error"
      };
    }
  }
}
const PORT = 5266;
let CACHE_DIR = "";
function ensureCacheDir() {
  if (!CACHE_DIR) {
    CACHE_DIR = path.join(app.getPath("userData"), "music", "cache");
  }
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      console.log(`[Proxy] Created cache directory: ${CACHE_DIR}`);
    } catch (e) {
      console.error("[Proxy] Failed to create cache directory:", e);
    }
  }
  return CACHE_DIR;
}
const urlCache = /* @__PURE__ */ new Map();
const downloadTasks = /* @__PURE__ */ new Map();
function getCachePath(source, id, quality) {
  const dir = ensureCacheDir();
  const safeId = id.replace(/[^a-z0-9]/gi, "_");
  return path.join(dir, `${source}-${safeId}-${quality}`);
}
function getMetadataPath(cachePath) {
  return cachePath + ".meta";
}
function getTempPath(cachePath) {
  return cachePath + ".tmp";
}
function readMetadata(cachePath) {
  const metaPath = getMetadataPath(cachePath);
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    }
  } catch (e) {
    console.error("[Proxy] Failed to read metadata:", e);
  }
  return null;
}
function writeMetadata(cachePath, metadata) {
  const metaPath = getMetadataPath(cachePath);
  try {
    fs.writeFileSync(metaPath, JSON.stringify(metadata));
  } catch (e) {
    console.error("[Proxy] Failed to write metadata:", e);
  }
}
async function fetchFreshUrl(source, id, quality) {
  try {
    const plugin = new PluginSystem(source);
    const result = await plugin.getUrl(id, quality);
    if (result.success && result.url) {
      urlCache.set(`${source}:${id}:${quality}`, {
        url: result.url,
        expiresAt: Date.now() + 3600 * 1e3
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
function isValidCacheFile(filePath) {
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
function parseRangeHeader(range, fileSize) {
  if (!range) return null;
  const match = range.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;
  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  if (start >= fileSize) return null;
  end = Math.min(end, fileSize - 1);
  return { start, end };
}
function serveFromCache(req, res, filePath) {
  try {
    const metadata = readMetadata(filePath);
    if (!metadata) {
      console.warn("[Proxy] No metadata for cache file");
      return false;
    }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = parseRangeHeader(req.headers.range, fileSize);
    if (range) {
      const { start, end } = range;
      const chunksize = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": metadata.contentType || "audio/mpeg"
      });
      const file = fs.createReadStream(filePath, { start, end });
      file.pipe(res);
      file.on("error", (err) => {
        console.error("[Proxy] Error reading cache file:", err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Cache read error");
        }
      });
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": metadata.contentType || "audio/mpeg",
        "Accept-Ranges": "bytes"
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on("error", (err) => {
        console.error("[Proxy] Error reading cache file:", err);
      });
    }
    return true;
  } catch (e) {
    console.error("[Proxy] Error serving from cache:", e);
    return false;
  }
}
async function proxyRangeDirect(req, res, targetUrl, totalSize, contentType) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
  if (req.headers.range) {
    headers["Range"] = req.headers.range;
  }
  const response = await fetch(targetUrl, {
    method: "GET",
    headers
  });
  if (!response.ok && response.status !== 206) {
    throw { statusCode: response.status, statusText: response.statusText };
  }
  const responseContentType = response.headers.get("content-type") || contentType || "audio/mpeg";
  const contentLength = response.headers.get("content-length");
  const contentRange = response.headers.get("content-range");
  if (response.status === 206 && contentRange) {
    res.writeHead(206, {
      "Content-Type": responseContentType,
      "Content-Length": contentLength || "",
      "Content-Range": contentRange,
      "Accept-Ranges": "bytes"
    });
  } else {
    res.writeHead(200, {
      "Content-Type": responseContentType,
      "Content-Length": contentLength || "",
      "Accept-Ranges": "bytes"
    });
  }
  if (!response.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(response.body);
  nodeStream.pipe(res);
  return new Promise((resolve, reject) => {
    nodeStream.on("end", resolve);
    nodeStream.on("error", reject);
    res.on("close", () => {
      nodeStream.destroy();
      resolve();
    });
  });
}
function serveFromPartialCache(req, res, filePath, task) {
  try {
    const tempPath = getTempPath(filePath);
    if (!fs.existsSync(tempPath)) return false;
    const range = parseRangeHeader(req.headers.range, task.totalSize);
    if (!range) return false;
    const { start, end } = range;
    if (end >= task.currentSize) {
      return false;
    }
    const chunksize = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${task.totalSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": task.contentType || "audio/mpeg"
    });
    const file = fs.createReadStream(tempPath, { start, end });
    file.pipe(res);
    return true;
  } catch (e) {
    console.error("[Proxy] Error serving from partial cache:", e);
    return false;
  }
}
function startBackgroundDownload(targetUrl, cacheFilePath, cacheKey) {
  const existingTask = downloadTasks.get(cacheFilePath);
  if (existingTask) {
    return existingTask;
  }
  const abortController = new AbortController();
  const task = {
    currentSize: 0,
    totalSize: 0,
    contentType: "audio/mpeg",
    abortController,
    promise: null
  };
  downloadTasks.set(cacheFilePath, task);
  task.promise = (async () => {
    const tempPath = getTempPath(cacheFilePath);
    try {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
      }
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        signal: abortController.signal
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
      const contentType = response.headers.get("content-type") || "audio/mpeg";
      if (!contentLength) {
        console.warn("[Proxy] Background download: No content-length, skipping cache");
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
      const nodeStream = Readable.fromWeb(response.body);
      await new Promise((resolve, reject) => {
        nodeStream.on("data", (chunk) => {
          task.currentSize += chunk.length;
        });
        nodeStream.pipe(fileStream);
        fileStream.on("finish", () => {
          try {
            const stat = fs.statSync(tempPath);
            if (stat.size === contentLength) {
              fs.renameSync(tempPath, cacheFilePath);
              writeMetadata(cacheFilePath, {
                totalSize: contentLength,
                contentType,
                complete: true,
                createdAt: Date.now()
              });
              console.log(`[Proxy] Background download complete: ${cacheFilePath}`);
            } else {
              console.warn(`[Proxy] Incomplete download: ${stat.size}/${contentLength}`);
              try {
                fs.unlinkSync(tempPath);
              } catch {
              }
            }
          } catch (e) {
            console.error("[Proxy] Failed to finalize cache:", e);
            try {
              fs.unlinkSync(tempPath);
            } catch {
            }
          }
          resolve();
        });
        fileStream.on("error", (err) => {
          console.error("[Proxy] Background download write error:", err);
          try {
            fs.unlinkSync(tempPath);
          } catch {
          }
          reject(err);
        });
        nodeStream.on("error", (err) => {
          console.error("[Proxy] Background download stream error:", err);
          fileStream.destroy();
          try {
            fs.unlinkSync(tempPath);
          } catch {
          }
          reject(err);
        });
      });
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("[Proxy] Background download failed:", e);
      }
      try {
        fs.unlinkSync(tempPath);
      } catch {
      }
    } finally {
      downloadTasks.delete(cacheFilePath);
    }
  })();
  return task;
}
async function proxyAndCache(req, res, targetUrl, cacheFilePath, cacheKey) {
  const requestedRange = req.headers.range;
  const isSeekRequest = requestedRange && !requestedRange.startsWith("bytes=0-");
  let task = downloadTasks.get(cacheFilePath);
  if (task) {
    console.log(`[Proxy] Download in progress: ${task.currentSize}/${task.totalSize}`);
    if (requestedRange && task.totalSize > 0) {
      const range = parseRangeHeader(requestedRange, task.totalSize);
      if (range) {
        const safeEnd = Math.floor(task.currentSize * 0.95);
        if (range.end < safeEnd && range.start < safeEnd) {
          console.log(`[Proxy] Serving range ${range.start}-${range.end} from partial cache (downloaded: ${task.currentSize})`);
          if (serveFromPartialCache(req, res, cacheFilePath, task)) {
            return;
          }
        }
        console.log(`[Proxy] Range ${range.start}-${range.end} not cached yet (downloaded: ${task.currentSize}), proxying directly`);
        await proxyRangeDirect(req, res, targetUrl, task.totalSize, task.contentType);
        return;
      }
    }
    await proxyRangeDirect(req, res, targetUrl, task.totalSize, task.contentType);
    return;
  }
  if (isSeekRequest) {
    console.log(`[Proxy] Seek request: ${requestedRange}, starting background download`);
    startBackgroundDownload(targetUrl, cacheFilePath);
    const headResponse = await fetch(targetUrl, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const totalSize = parseInt(headResponse.headers.get("content-length") || "0", 10);
    const contentType2 = headResponse.headers.get("content-type") || "audio/mpeg";
    await proxyRangeDirect(req, res, targetUrl, totalSize, contentType2);
    return;
  }
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
  const response = await fetch(targetUrl, {
    method: "GET",
    headers
  });
  if (!response.ok) {
    throw { statusCode: response.status, statusText: response.statusText };
  }
  const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  if (!contentLength) {
    console.warn("[Proxy] No content-length, proxying without cache");
    res.writeHead(200, {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes"
    });
    if (response.body) {
      const nodeStream2 = Readable.fromWeb(response.body);
      nodeStream2.pipe(res);
    } else {
      res.end();
    }
    return;
  }
  const tempPath = getTempPath(cacheFilePath);
  try {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(cacheFilePath)) fs.unlinkSync(cacheFilePath);
  } catch {
  }
  const fileStream = fs.createWriteStream(tempPath);
  task = {
    currentSize: 0,
    totalSize: contentLength,
    contentType,
    abortController: null,
    promise: null
  };
  downloadTasks.set(cacheFilePath, task);
  console.log(`[Proxy] Starting stream download: ${cacheFilePath} (${contentLength} bytes)`);
  res.writeHead(200, {
    "Content-Length": contentLength,
    "Content-Type": contentType,
    "Accept-Ranges": "bytes"
  });
  if (!response.body) {
    res.end();
    downloadTasks.delete(cacheFilePath);
    return;
  }
  const nodeStream = Readable.fromWeb(response.body);
  const passThrough = new PassThrough();
  passThrough.on("data", (chunk) => {
    if (task) {
      task.currentSize += chunk.length;
    }
  });
  passThrough.pipe(res);
  nodeStream.pipe(passThrough);
  nodeStream.pipe(fileStream);
  const cleanup = (success, error) => {
    downloadTasks.delete(cacheFilePath);
    if (success && fs.existsSync(tempPath)) {
      try {
        const stat = fs.statSync(tempPath);
        if (stat.size === contentLength) {
          fs.renameSync(tempPath, cacheFilePath);
          writeMetadata(cacheFilePath, {
            totalSize: contentLength,
            contentType,
            complete: true,
            createdAt: Date.now()
          });
          console.log(`[Proxy] Cache complete: ${cacheFilePath}`);
        } else {
          console.warn(`[Proxy] Incomplete download: ${stat.size}/${contentLength}`);
          try {
            fs.unlinkSync(tempPath);
          } catch {
          }
        }
      } catch (e) {
        console.error("[Proxy] Failed to finalize cache:", e);
        try {
          fs.unlinkSync(tempPath);
        } catch {
        }
      }
    } else if (!success) {
      console.error("[Proxy] Download failed:", error);
    }
  };
  fileStream.on("finish", () => cleanup(true));
  fileStream.on("error", (err) => cleanup(false, err));
  nodeStream.on("error", (err) => {
    cleanup(false, err);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Proxy stream error");
    }
  });
  res.on("close", () => {
    if (!res.writableEnded) {
      console.log("[Proxy] Client disconnected, download continues in background");
    }
  });
}
let persistCacheEnabled = true;
function getCacheDir() {
  return ensureCacheDir();
}
function getCacheSize() {
  const dir = ensureCacheDir();
  if (!fs.existsSync(dir)) return "0 B";
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
      } catch {
      }
    }
  } catch (e) {
    console.error("[Proxy] Error calculating cache size:", e);
  }
  if (totalSize < 1024) return `${totalSize} B`;
  if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
  if (totalSize < 1024 * 1024 * 1024) return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function setPersistCache(persist) {
  persistCacheEnabled = persist;
  console.log(`[Proxy] Cache persistence set to: ${persist}`);
}
function clearCacheNow() {
  const dir = ensureCacheDir();
  if (fs.existsSync(dir)) {
    console.log(`[Proxy] Clearing cache directory: ${dir}`);
    for (const [, task] of downloadTasks) {
      if (task.abortController) {
        task.abortController.abort();
      }
    }
    downloadTasks.clear();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      console.log("[Proxy] Cache cleared");
    } catch (e) {
      console.error("[Proxy] Failed to clear cache:", e);
    }
  }
}
function cleanupCache() {
  if (!persistCacheEnabled && CACHE_DIR && fs.existsSync(CACHE_DIR)) {
    console.log(`[Proxy] Cleaning up cache directory: ${CACHE_DIR}`);
    for (const [, task] of downloadTasks) {
      if (task.abortController) {
        task.abortController.abort();
      }
    }
    downloadTasks.clear();
    try {
      fs.rmSync(CACHE_DIR, { recursive: true, force: true });
      console.log("[Proxy] Cache cleanup complete");
    } catch (e) {
      console.error("[Proxy] Failed to cleanup cache:", e);
    }
  }
}
function cleanupTempFiles() {
  const dir = ensureCacheDir();
  try {
    const files = fs.readdirSync(dir);
    const now = Date.now();
    for (const file of files) {
      if (file.endsWith(".tmp")) {
        const filePath = path.join(dir, file);
        const cacheFilePath = filePath.replace(".tmp", "");
        if (!downloadTasks.has(cacheFilePath)) {
          try {
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > 3600 * 1e3) {
              fs.unlinkSync(filePath);
              console.log(`[Proxy] Cleaned up stale temp file: ${file}`);
            }
          } catch {
          }
        }
      }
    }
  } catch (e) {
    console.error("[Proxy] Error cleaning up temp files:", e);
  }
}
function startProxyServer(persistCache = true) {
  persistCacheEnabled = persistCache;
  console.log(`[Proxy] Persist cache: ${persistCache}`);
  setInterval(cleanupTempFiles, 30 * 60 * 1e3);
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method === "HEAD") {
      res.setHeader("Accept-Ranges", "bytes");
      res.statusCode = 200;
      res.end();
      return;
    }
    try {
      const parsedUrl = new URL(req.url || "", `http://localhost:${PORT}`);
      if (parsedUrl.pathname !== "/music") {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const id = parsedUrl.searchParams.get("id");
      const source = parsedUrl.searchParams.get("source");
      const quality = parsedUrl.searchParams.get("quality") || "standard";
      if (!id || !source) {
        res.writeHead(400);
        res.end("Missing id or source");
        return;
      }
      const cacheKey = `${source}:${id}:${quality}`;
      const cacheFilePath = getCachePath(source, id, quality);
      if (isValidCacheFile(cacheFilePath)) {
        console.log(`[Proxy] Serving from complete cache: ${cacheFilePath}`);
        const success = serveFromCache(req, res, cacheFilePath);
        if (success) return;
        console.warn("[Proxy] Cache file invalid, cleaning up...");
        try {
          fs.unlinkSync(cacheFilePath);
          fs.unlinkSync(getMetadataPath(cacheFilePath));
        } catch {
        }
      }
      let playUrl = null;
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
        res.end("Failed to Obtain URL");
        return;
      }
      const maxAttempts = 3;
      let currentAttempt = 0;
      let lastError = null;
      while (currentAttempt < maxAttempts) {
        try {
          await proxyAndCache(req, res, playUrl, cacheFilePath, cacheKey);
          break;
        } catch (e) {
          lastError = e;
          currentAttempt++;
          console.warn(`[Proxy] Proxy error (Attempt ${currentAttempt}/${maxAttempts}):`, e);
          if (currentAttempt < maxAttempts) {
            console.log("[Proxy] Error occurred, refreshing URL from plugin...");
            urlCache.delete(cacheKey);
            const newUrl = await fetchFreshUrl(source, id, quality);
            if (newUrl) {
              playUrl = newUrl;
              continue;
            } else {
              console.error("[Proxy] Failed to refresh URL");
            }
          }
          if (!res.headersSent) {
            res.writeHead((lastError == null ? void 0 : lastError.statusCode) || 502);
            res.end("Proxy Error");
          }
          break;
        }
      }
    } catch (err) {
      console.error("[Proxy] Internal Error:", err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    }
  });
  server.listen(PORT, "127.0.0.1", () => {
    ensureCacheDir();
    cleanupTempFiles();
    console.log(`[Proxy] Server running at http://127.0.0.1:${PORT}/music`);
    console.log(`[Proxy] Cache dir: ${CACHE_DIR}`);
  });
  return server;
}
const DEFAULT_SETTINGS = {
  persistCache: true,
  theme: "dark",
  accentColor: "#ec4141"
  // Default red
};
let settingsCache = null;
function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}
function loadSettings() {
  if (settingsCache) return settingsCache;
  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      settingsCache = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      console.log("[Settings] Loaded from disk:", settingsCache);
      return settingsCache;
    }
  } catch (e) {
    console.error("[Settings] Failed to load settings:", e);
  }
  settingsCache = { ...DEFAULT_SETTINGS };
  return settingsCache;
}
function saveSettings(settings) {
  settingsCache = { ...loadSettings(), ...settings };
  const settingsPath = getSettingsPath();
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settingsCache, null, 2));
    console.log("[Settings] Saved to disk:", settingsCache);
  } catch (e) {
    console.error("[Settings] Failed to save settings:", e);
  }
  return settingsCache;
}
function getSetting(key) {
  return loadSettings()[key];
}
const require$1 = createRequire(import.meta.url);
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let mpv;
function createWindow() {
  win = new BrowserWindow({
    frame: false,
    minWidth: 950,
    minHeight: 800,
    width: 1e3,
    height: 800,
    icon: path$1.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs")
      // nodeIntegration: false,
      // contextIsolation: true,
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
  win.webContents.openDevTools();
  registerZoomShortcuts(win);
}
ipcMain.on("window-minimize", (event) => {
  var _a;
  return (_a = BrowserWindow.fromWebContents(event.sender)) == null ? void 0 : _a.minimize();
});
ipcMain.on("window-maximize", () => (win == null ? void 0 : win.isMaximized()) ? win.unmaximize() : win == null ? void 0 : win.maximize());
ipcMain.on("window-close", () => win == null ? void 0 : win.close());
ipcMain.handle("window-is-maximized", () => (win == null ? void 0 : win.isMaximized()) || false);
ipcMain.handle("mpv-command", async (_, command) => {
  if (mpv) {
    mpv.send(command);
  }
});
ipcMain.handle("mpv-load", (_, url) => mpv == null ? void 0 : mpv.load(url));
ipcMain.handle("mpv-play", () => mpv == null ? void 0 : mpv.play());
ipcMain.handle("mpv-pause", () => mpv == null ? void 0 : mpv.pause());
ipcMain.handle("mpv-toggle-pause", () => mpv == null ? void 0 : mpv.togglePause());
ipcMain.handle("mpv-stop", () => mpv == null ? void 0 : mpv.stop());
ipcMain.handle("mpv-set-volume", (_, vol) => mpv == null ? void 0 : mpv.setVolume(vol));
ipcMain.handle("mpv-seek", (_, time) => mpv == null ? void 0 : mpv.seek(time));
ipcMain.handle(
  "plugin:call",
  async (_evenv, pluginId, method, args) => {
    const plugin = new PluginSystem(pluginId);
    if (typeof plugin[method] !== "function") {
      return {
        success: false,
        error: `Method ${method} not found`
      };
    }
    return await plugin[method](...args);
  }
);
ipcMain.handle("cache:getInfo", () => {
  const settings = loadSettings();
  return {
    path: getCacheDir(),
    size: getCacheSize(),
    persistCache: settings.persistCache
  };
});
ipcMain.handle("cache:setPersist", (_, persist) => {
  setPersistCache(persist);
  saveSettings({ persistCache: persist });
});
ipcMain.handle("cache:openFolder", () => {
  const dir = getCacheDir();
  require$1("electron").shell.openPath(dir);
});
ipcMain.handle("cache:clear", () => {
  clearCacheNow();
});
ipcMain.handle("settings:getAll", () => {
  return loadSettings();
});
ipcMain.handle("settings:set", (_, settings) => {
  return saveSettings(settings);
});
ipcMain.handle("settings:getTheme", () => {
  return getSetting("theme");
});
ipcMain.handle("settings:setTheme", (_, theme) => {
  saveSettings({ theme });
});
ipcMain.handle("settings:getAccentColor", () => {
  return getSetting("accentColor");
});
ipcMain.handle("settings:setAccentColor", (_, color) => {
  saveSettings({ accentColor: color });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("will-quit", () => {
  cleanupCache();
  if (mpv) {
    mpv.destroy();
  }
});
function registerZoomShortcuts(win2) {
  win2.webContents.on("before-input-event", (event, input) => {
    if (input.control || input.meta) {
      if (input.key.toLowerCase() === "=" || input.key === "+") {
        let currentZoom = win2.webContents.getZoomFactor();
        win2.webContents.setZoomFactor(currentZoom + 0.1);
        event.preventDefault();
      } else if (input.key === "-" || input.key === "_") {
        let currentZoom = win2.webContents.getZoomFactor();
        if (currentZoom > 0.5) {
          win2.webContents.setZoomFactor(currentZoom - 0.1);
        }
        event.preventDefault();
      } else if (input.key === "0") {
        win2.webContents.setZoomFactor(1);
        event.preventDefault();
      }
    }
  });
}
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  const pluginsPath = path$1.join(app.getPath("userData"), "plugins");
  if (!fs$1.existsSync(pluginsPath)) {
    fs$1.mkdirSync(pluginsPath, { recursive: true });
  }
  const wyPluginPath = path$1.join(pluginsPath, "wy");
  const wyPluginIndex = path$1.join(wyPluginPath, "index.js");
  if (!fs$1.existsSync(wyPluginIndex)) {
    if (!fs$1.existsSync(wyPluginPath)) fs$1.mkdirSync(wyPluginPath, { recursive: true });
    fs$1.writeFileSync(wyPluginIndex, `
module.exports = {
    async getUrl(id, quality) {
        const url = \`https://api.qz.shiqianjiang.cn/music/url?source=wy&songId=\${id}&quality=\${quality}&key=testkey\`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}
        `.trim());
  }
  Menu.setApplicationMenu(null);
  createWindow();
  startProxyServer();
  mpv = new MpvController();
  mpv.start();
  mpv.on("event", (data) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("mpv-event", data);
    }
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
