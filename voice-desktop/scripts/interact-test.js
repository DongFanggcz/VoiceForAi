const { app, BrowserWindow, ipcMain } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const nls = require("../src/nls");

const APP_DIR = path.join(__dirname, "..", "src");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".gz": "application/gzip" };
const MODEL_FILE = path.join(__dirname, "..", "model.tar.gz");

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      if (urlPath === "/model.tar.gz") {
        const stat = fs.statSync(MODEL_FILE);
        res.writeHead(200, { "Content-Type": "application/gzip", "Content-Length": stat.size });
        fs.createReadStream(MODEL_FILE).pipe(res);
        return;
      }
      const filePath = path.normalize(path.join(APP_DIR, urlPath));
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function main() {
  const port = await startServer();
  const win = new BrowserWindow({
    width: 64, height: 64, frame: false, transparent: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "src", "preload.js"),
      contextIsolation: true, nodeIntegration: false
    }
  });
  win.webContents.on("console-message", (e, level, message) => {
    console.log("[renderer]", String(message).slice(0, 150));
  });
  win.webContents.on("ipc-message", (e, channel) => {
    console.log("[ipc]", channel);
  });
  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  await new Promise((r) => setTimeout(r, 1500));

  // 注册与 main.js 相同的 NLS IPC handler
  ipcMain.handle("nls:start", async (event, payload) => {
    console.log("[main] nls:start called");
    try {
      const client = await nls.startSession({
        sampleRate: 16000,
        onPartial: (t) => { console.log("[main] partial:", t); win.webContents.send("nls:partial", t); },
        onResult: (t) => { console.log("[main] result:", t); win.webContents.send("nls:result", t); },
        onError: (e) => { console.log("[main] error:", e.message); win.webContents.send("nls:error", e.message); },
        onCompleted: () => { console.log("[main] completed"); win.webContents.send("nls:completed"); }
      });
      return { ok: true, taskId: client.taskId };
    } catch (e) {
      console.log("[main] nls:start error:", e.message);
      return { ok: false, error: e.message };
    }
  });
  ipcMain.on("nls:audio", (event, payload) => {
    nls.sendAudio(payload.data, payload.sampleRate);
  });
  ipcMain.on("nls:stop", () => nls.stopSession());

  // 点击小按钮触发识别
  console.log(">>> 模拟点击识别按钮");
  const clickResult = await win.webContents.executeJavaScript(`
    (async () => {
      const btn = document.getElementById('cbtn');
      btn.click();
      return 'clicked';
    })()
  `);
  console.log("click:", clickResult);

  // 等 5 秒看音频是否采集
  await new Promise((r) => setTimeout(r, 5000));
  const audioState = await win.webContents.executeJavaScript(`({
    listening: ${"true"},
    status: document.getElementById('status').textContent
  })`);
  console.log("audio state:", JSON.stringify(audioState));

  // 停止
  console.log(">>> 模拟停止");
  await win.webContents.executeJavaScript(`document.getElementById('cbtn').click()`);
  await new Promise((r) => setTimeout(r, 3000));

  app.exit(0);
}

app.whenReady().then(main);
