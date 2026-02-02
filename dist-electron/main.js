import { ipcMain, BrowserWindow, app, Menu } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    frame: false,
    minWidth: 950,
    minHeight: 700,
    width: 1e3,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  registerZoomShortcuts(win);
}
ipcMain.on("window-minimize", (event) => {
  var _a;
  return (_a = BrowserWindow.fromWebContents(event.sender)) == null ? void 0 : _a.minimize();
});
ipcMain.on("window-maximize", () => (win == null ? void 0 : win.isMaximized()) ? win.unmaximize() : win == null ? void 0 : win.maximize());
ipcMain.on("window-close", () => win == null ? void 0 : win.close());
ipcMain.handle("window-is-maximized", () => (win == null ? void 0 : win.isMaximized()) || false);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
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
  Menu.setApplicationMenu(null);
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
