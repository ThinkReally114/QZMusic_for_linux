"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 窗口控制
  minimizeWindow: () => electron.ipcRenderer.send("window-minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window-maximize"),
  closeWindow: () => electron.ipcRenderer.send("window-close"),
  isMaximized: () => electron.ipcRenderer.invoke("window-is-maximized"),
  // qzplayer Control
  qzplayer: {
    load: (url) => electron.ipcRenderer.invoke("qzplayer-load", url),
    play: () => electron.ipcRenderer.invoke("qzplayer-play"),
    pause: () => electron.ipcRenderer.invoke("qzplayer-pause"),
    togglePause: () => electron.ipcRenderer.invoke("qzplayer-toggle-pause"),
    stop: () => electron.ipcRenderer.invoke("qzplayer-stop"),
    setVolume: (vol) => electron.ipcRenderer.invoke("qzplayer-set-volume", vol),
    seek: (time) => electron.ipcRenderer.invoke("qzplayer-seek", time),
    onEvent: (callback) => electron.ipcRenderer.on("qzplayer-event", callback)
  },
  // Plugin System
  plugin: {
    call: (pluginId, method, args) => electron.ipcRenderer.invoke("plugin:call", pluginId, method, args)
  },
  // Cache Control
  getCacheInfo: () => electron.ipcRenderer.invoke("cache:getInfo"),
  setCachePersist: (persist) => electron.ipcRenderer.invoke("cache:setPersist", persist),
  openCacheFolder: () => electron.ipcRenderer.invoke("cache:openFolder"),
  clearCache: () => electron.ipcRenderer.invoke("cache:clear"),
  // Settings
  settings: {
    getAll: () => electron.ipcRenderer.invoke("settings:getAll"),
    set: (settings) => electron.ipcRenderer.invoke("settings:set", settings),
    getTheme: () => electron.ipcRenderer.invoke("settings:getTheme"),
    setTheme: (theme) => electron.ipcRenderer.invoke("settings:setTheme", theme),
    getAccentColor: () => electron.ipcRenderer.invoke("settings:getAccentColor"),
    setAccentColor: (color) => electron.ipcRenderer.invoke("settings:setAccentColor", color)
  }
});
