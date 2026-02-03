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
      "--no-terminal"
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
      this.socket.on("error", (err) => {
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
