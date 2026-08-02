const { app, BrowserWindow } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

const APP_DIR = path.join(__dirname, "..", "src");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css" };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
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
    console.log("[renderer]", message);
  });
  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  await new Promise((r) => setTimeout(r, 2000));

  // 检查渲染进程状态
  const result = await win.webContents.executeJavaScript(`({
    hasDesktop: !!window.desktop,
    vosk: !!window.Vosk,
    cbtn: !!document.getElementById('cbtn'),
    engine: document.getElementById('engine').value,
    prefs: {
      engine: localStorage.getItem('vi_engine'),
      opacity: localStorage.getItem('vi_opacity')
    }
  })`);
  console.log("渲染进程状态:", JSON.stringify(result, null, 2));

  // 测试麦克风权限（列出设备）
  const devices = await win.webContents.executeJavaScript(`
    navigator.mediaDevices.enumerateDevices().then(ds =>
      ds.map(d => ({kind: d.kind, label: d.label}))
    )
  `);
  console.log("媒体设备:", JSON.stringify(devices, null, 2));

  // 尝试 getUserMedia 是否成功
  try {
    const gUM = await win.webContents.executeJavaScript(`
      navigator.mediaDevices.getUserMedia({video:false, audio:{channelCount:1}})
        .then(s => { s.getTracks().forEach(t=>t.stop()); return "OK"; })
        .catch(e => "FAIL: " + e.message)
    `);
    console.log("getUserMedia:", gUM);
  } catch (e) {
    console.log("getUserMedia executeJavaScript error:", e.message);
  }

  app.exit(0);
}

app.whenReady().then(main);
