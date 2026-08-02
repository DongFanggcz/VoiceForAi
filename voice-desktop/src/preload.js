const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  close: () => ipcRenderer.send("window:close"),
  minimize: () => ipcRenderer.send("window:minimize"),
  expand: () => ipcRenderer.send("window:expand"),
  collapse: () => ipcRenderer.send("window:collapse"),
  toggleTop: (top) => ipcRenderer.invoke("window:toggle-top", top),
  setOpacity: (opacity) => ipcRenderer.send("window:opacity", opacity),
  moveWindow: (dx, dy) => ipcRenderer.send("window:move", dx, dy),
  nlsStart: (payload) => ipcRenderer.invoke("nls:start", payload),
  nlsAudio: (payload) => ipcRenderer.send("nls:audio", payload),
  nlsStop: () => ipcRenderer.send("nls:stop"),
  onNlsPartial: (cb) => ipcRenderer.on("nls:partial", (e, t) => cb(t)),
  onNlsResult: (cb) => ipcRenderer.on("nls:result", (e, t) => cb(t)),
  onNlsError: (cb) => ipcRenderer.on("nls:error", (e, m) => cb(m)),
  onNlsCompleted: (cb) => ipcRenderer.on("nls:completed", () => cb()),
  onHotkey: (cb) => ipcRenderer.on("hotkey:toggle", () => cb()),
  getHotkey: () => ipcRenderer.invoke("hotkey:get"),
  setHotkey: (accel) => ipcRenderer.invoke("hotkey:set", accel),
  copyToClipboard: (text) => ipcRenderer.invoke("clipboard:write", text)
});
