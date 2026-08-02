const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  close: () => ipcRenderer.send("window:close"),
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleTop: (top) => ipcRenderer.invoke("window:toggle-top", top),
  loadWhisper: (modelKey) => ipcRenderer.invoke("whisper:load", modelKey),
  transcribe: (payload) => ipcRenderer.invoke("whisper:transcribe", payload),
  onWhisperProgress: (cb) =>
    ipcRenderer.on("whisper:progress", (e, p) => cb(p)),
  onWhisperPartial: (cb) =>
    ipcRenderer.on("whisper:partial", (e, t) => cb(t))
});
