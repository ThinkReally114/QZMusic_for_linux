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
const require$1 = createRequire(import.meta.url);
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
      delete require$1.cache[require$1.resolve(pluginPath)];
      this.plugin = require$1(pluginPath);
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
const downloadingFiles = /* @__PURE__ */ new Map();
function getCachePath(source, id, quality) {
  const dir = ensureCacheDir();
  const safeId = id.replace(/[^a-z0-9]/gi, "_");
  return path.join(dir, `${source}-${safeId}-${quality}`);
}
function getMetadataPath(cachePath) {
  return cachePath + ".meta";
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
  const metadata = readMetadata(filePath);
  if (!metadata || !metadata.complete) return false;
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  return stat.size === metadata.totalSize && stat.size > 1024;
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
}
async function proxyWithoutCache(req, res, targetUrl) {
  const headers = {};
  if (req.headers.range) {
    headers["Range"] = req.headers.range;
  }
  headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const response = await fetch(targetUrl, {
    method: "GET",
    headers
  });
  if (!response.ok) {
    throw { statusCode: response.status, statusText: response.statusText };
  }
  const headersToForward = ["content-type", "content-length", "content-range", "accept-ranges"];
  headersToForward.forEach((h) => {
    const val = response.headers.get(h);
    if (val) res.setHeader(h, val);
  });
  res.statusCode = response.status;
  if (!response.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(response.body);
  nodeStream.pipe(res);
  nodeStream.on("error", (err) => {
    console.error("[Proxy] Stream error:", err);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Proxy stream error");
    }
  });
}
async function proxyAndCache(req, res, targetUrl, cacheFilePath) {
  const requestedRange = req.headers.range;
  const downloadState = downloadingFiles.get(cacheFilePath);
  if (downloadState) {
    console.log(`[Proxy] File already downloading, current: ${downloadState.currentSize}/${downloadState.totalSize}`);
    if (requestedRange) {
      const range = parseRangeHeader(requestedRange, downloadState.totalSize);
      if (range && range.end < downloadState.currentSize) {
        console.log(`[Proxy] Serving range from in-progress cache`);
        const { start, end } = range;
        const chunksize = end - start + 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${downloadState.totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "audio/mpeg"
        });
        const file = fs.createReadStream(cacheFilePath, { start, end });
        file.pipe(res);
        return;
      }
    }
    await proxyWithoutCache(req, res, targetUrl);
    return;
  }
  if (requestedRange && !requestedRange.startsWith("bytes=0-")) {
    console.log(`[Proxy] Range request without cache: ${requestedRange}`);
    await proxyWithoutCache(req, res, targetUrl);
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
    res.setHeader("Content-Type", contentType);
    res.statusCode = 200;
    if (response.body) {
      const nodeStream2 = Readable.fromWeb(response.body);
      nodeStream2.pipe(res);
    } else {
      res.end();
    }
    return;
  }
  const tempPath = cacheFilePath + ".tmp";
  try {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(cacheFilePath)) fs.unlinkSync(cacheFilePath);
  } catch (e) {
    console.error("[Proxy] Cleanup error:", e);
  }
  const fileStream = fs.createWriteStream(tempPath);
  downloadingFiles.set(cacheFilePath, {
    currentSize: 0,
    totalSize: contentLength,
    writeStream: fileStream
  });
  console.log(`[Proxy] Starting download: ${cacheFilePath} (${contentLength} bytes)`);
  res.writeHead(200, {
    "Content-Length": contentLength,
    "Content-Type": contentType,
    "Accept-Ranges": "bytes"
  });
  if (!response.body) {
    res.end();
    downloadingFiles.delete(cacheFilePath);
    return;
  }
  const nodeStream = Readable.fromWeb(response.body);
  const passThrough = new PassThrough();
  let downloadedBytes = 0;
  passThrough.on("data", (chunk) => {
    downloadedBytes += chunk.length;
    const state = downloadingFiles.get(cacheFilePath);
    if (state) {
      state.currentSize = downloadedBytes;
    }
  });
  passThrough.pipe(res);
  nodeStream.pipe(passThrough);
  nodeStream.pipe(fileStream);
  const cleanup = (success, error) => {
    downloadingFiles.delete(cacheFilePath);
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
      try {
        fs.unlinkSync(tempPath);
      } catch {
      }
    }
  };
  fileStream.on("finish", () => cleanup(true));
  fileStream.on("error", (err) => cleanup(false, err));
  nodeStream.on("error", (err) => cleanup(false, err));
  res.on("close", () => {
    if (!res.writableEnded) {
      console.log("[Proxy] Client disconnected during download");
    }
  });
}
let persistCacheEnabled = true;
function cleanupCache() {
  if (!persistCacheEnabled && CACHE_DIR && fs.existsSync(CACHE_DIR)) {
    console.log(`[Proxy] Cleaning up cache directory: ${CACHE_DIR}`);
    try {
      fs.rmSync(CACHE_DIR, { recursive: true, force: true });
      console.log("[Proxy] Cache cleanup complete");
    } catch (e) {
      console.error("[Proxy] Failed to cleanup cache:", e);
    }
  }
}
function startProxyServer(persistCache = true) {
  persistCacheEnabled = persistCache;
  console.log(`[Proxy] Persist cache: ${persistCache}`);
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
      try {
        await proxyAndCache(req, res, playUrl, cacheFilePath);
      } catch (e) {
        console.warn(`[Proxy] Proxy error:`, e);
        if (!res.headersSent) {
          res.writeHead(e.statusCode || 502);
          res.end("Proxy Error");
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
    console.log(`[Proxy] Server running at http://127.0.0.1:${PORT}/music`);
    console.log(`[Proxy] Cache dir: ${CACHE_DIR}`);
  });
  return server;
}
createRequire(import.meta.url);
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
