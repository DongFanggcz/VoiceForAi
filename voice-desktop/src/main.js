const { app, BrowserWindow, ipcMain } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const nls = require("./nls");

let win = null;
let server = null;

const APP_DIR = path.join(__dirname, "..", "src");
const MODEL_FILE = path.join(__dirname, "..", "model.tar.gz");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";

      if (urlPath === "/model.tar.gz") {
        fs.stat(MODEL_FILE, (err, stat) => {
          if (err) {
            res.writeHead(404);
            res.end("model not found");
            return;
          }
          res.writeHead(200, {
            "Content-Type": "application/gzip",
            "Content-Length": stat.size
          });
          fs.createReadStream(MODEL_FILE).pipe(res);
        });
        return;
      }

      const filePath = path.normalize(path.join(APP_DIR, urlPath));
      if (!filePath.startsWith(APP_DIR)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
    server.on("error", reject);
  });
}

function loadWindowState() {
  try {
    const data = fs.readFileSync(path.join(app.getPath("userData"), "window.json"), "utf8");
    return JSON.parse(data);
  } catch (e) {
    return { x: undefined, y: undefined, width: 360, height: 340 };
  }
}

function saveWindowState() {
  if (!win) return;
  try {
    fs.writeFileSync(
      path.join(app.getPath("userData"), "window.json"),
      JSON.stringify(win.getBounds())
    );
  } catch (e) {}
}

async function createWindow() {
  const port = await startServer();
  const state = loadWindowState();

  win = new BrowserWindow({
    ...state,
    minWidth: 320,
    minHeight: 260,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: "语音输入浮窗",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.on("moved", saveWindowState);
  win.on("resized", saveWindowState);

  win.loadURL(`http://127.0.0.1:${port}/index.html`);

  win.on("closed", () => {
    win = null;
  });
}

ipcMain.on("window:close", () => {
  if (win) win.close();
});

ipcMain.on("window:minimize", () => {
  if (win) win.minimize();
});

ipcMain.handle("window:toggle-top", (event, top) => {
  if (win) win.setAlwaysOnTop(!!top, "screen-saver");
  return !!top;
});

let transcribeInFlight = null;

ipcMain.handle("nls:start", async (event, payload) => {
  const sampleRate = payload && payload.sampleRate ? payload.sampleRate : 16000;
  try {
    const client = await nls.startSession({
      sampleRate,
      onPartial: (t) => { if (win) win.webContents.send("nls:partial", t); },
      onResult: (t) => { if (win) win.webContents.send("nls:result", t); },
      onError: (e) => { if (win) win.webContents.send("nls:error", e.message); },
      onCompleted: () => { if (win) win.webContents.send("nls:completed"); }
    });
    return { ok: true, taskId: client.taskId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.on("nls:audio", (event, payload) => {
  nls.sendAudio(payload.data, payload.sampleRate);
});

ipcMain.on("nls:stop", () => {
  nls.stopSession();
});

app.whenReady().then(async () => {
  await createWindow();
});

app.on("window-all-closed", () => {
  if (server) server.close();
  app.quit();
});

app.on("before-quit", () => {
  if (server) server.close();
});
