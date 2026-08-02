let appRef = null;
try {
  appRef = require("electron").app;
} catch (e) {
  appRef = null;
}
const { createToken } = require("./aliyun-token");
const NlsClient = require("./nls-client");
const fs = require("fs");
const path = require("path");

let config = null;
let cachedToken = null;
let activeClient = null;

function configCandidates() {
  const paths = [];
  if (appRef) {
    try {
      paths.push(path.join(appRef.getPath("userData"), "config.json"));
    } catch (e) {}
  }
  paths.push(path.join(__dirname, "..", "config.json"));
  return paths;
}

function loadConfig() {
  if (config) return config;
  let errMsg = "";
  for (const p of configCandidates()) {
    try {
      config = JSON.parse(fs.readFileSync(p, "utf8"));
      break;
    } catch (e) {
      errMsg = e.message;
    }
  }
  if (!config) throw new Error("读取 config.json 失败: " + errMsg);
  if (!config.accessKeyId || !config.accessKeySecret || !config.appkey) {
    throw new Error("config.json 未配置 accessKeyId / accessKeySecret / appkey");
  }
  return config;
}

async function ensureToken() {
  const cfg = loadConfig();
  if (cachedToken && cachedToken.expireTime * 1000 > Date.now() + 60000) {
    return cachedToken;
  }
  cachedToken = await createToken(cfg.accessKeyId, cfg.accessKeySecret);
  return cachedToken;
}

async function startSession({ sampleRate, onPartial, onResult, onError, onCompleted }) {
  const cfg = loadConfig();
  const { token } = await ensureToken();
  if (activeClient) stopSession();

  const client = new NlsClient({ token, appkey: cfg.appkey });
  activeClient = client;

  client.on("partial", (t) => { if (onPartial) onPartial(t); });
  client.on("result", (t) => { if (onResult) onResult(t); });
  client.on("error", (e) => { if (onError) onError(e); });
  client.on("completed", () => { if (onCompleted) onCompleted(); });

  await client.start({ sampleRate: sampleRate || 16000 });
  return client;
}

function sendAudio(float32, sampleRate) {
  if (!activeClient) return;
  const pcm = float32ToPcm16(resampleTo16000(float32, sampleRate));
  activeClient.sendPcm(pcm);
}

function resampleTo16000(float32, fromRate) {
  if (!fromRate || fromRate === 16000) return float32;
  const ratio = fromRate / 16000;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = float32[Math.floor(i * ratio)];
  }
  return out;
}

function stopSession() {
  if (activeClient) {
    try { activeClient.stop(); } catch (e) {}
    activeClient = null;
  }
}

function float32ToPcm16(float32) {
  const out = Buffer.alloc(float32.length * 2);
  for (let i = 0; i < float32.length; i++) {
    let v = Math.max(-1, Math.min(1, float32[i]));
    out.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return out;
}

function isSessionActive() {
  return !!activeClient;
}

module.exports = { startSession, sendAudio, stopSession, isSessionActive };
