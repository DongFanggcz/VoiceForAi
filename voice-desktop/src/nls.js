const { createToken } = require("./aliyun-token");
const NlsClient = require("./nls-client");
const fs = require("fs");
const path = require("path");

let config = null;
let cachedToken = null;
let activeClient = null;

function loadConfig() {
  if (config) return config;
  try {
    const p = path.join(__dirname, "..", "config.json");
    config = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error("读取 config.json 失败: " + e.message);
  }
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
  const pcm = float32ToPcm16(float32);
  activeClient.sendPcm(pcm);
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
