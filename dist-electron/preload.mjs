"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 窗口控制
  minimizeWindow: () => electron.ipcRenderer.send("window-minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window-maximize"),
  closeWindow: () => electron.ipcRenderer.send("window-close"),
  isMaximized: () => electron.ipcRenderer.invoke("window-is-maximized"),
  // MPV Control
  mpv: {
    load: (url) => electron.ipcRenderer.invoke("mpv-load", url),
    play: () => electron.ipcRenderer.invoke("mpv-play"),
    pause: () => electron.ipcRenderer.invoke("mpv-pause"),
    togglePause: () => electron.ipcRenderer.invoke("mpv-toggle-pause"),
    stop: () => electron.ipcRenderer.invoke("mpv-stop"),
    setVolume: (vol) => electron.ipcRenderer.invoke("mpv-set-volume", vol),
    seek: (time) => electron.ipcRenderer.invoke("mpv-seek", time),
    onEvent: (callback) => electron.ipcRenderer.on("mpv-event", callback)
  },
  // Plugin System
  plugin: {
    call: (pluginId, method, args) => electron.ipcRenderer.invoke("plugin:call", pluginId, method, args)
  }
});
