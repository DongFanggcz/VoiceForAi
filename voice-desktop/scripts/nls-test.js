const fs = require("fs");
const path = require("path");
const { createToken } = require("../src/aliyun-token");
const NlsClient = require("../src/nls-client");

function loadConfig() {
  const p = path.join(__dirname, "..", "config.json");
  const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!cfg.accessKeyId || !cfg.accessKeySecret || !cfg.appkey) {
    console.error("请先在 voice-desktop/config.json 中填写 accessKeyId / accessKeySecret / appkey");
    process.exit(1);
  }
  return cfg;
}

function readWavPcm16(file) {
  const buf = fs.readFileSync(file);
  let offset = 12;
  let bits = 16, rate = 16000, channels = 1;
  let dataOffset = -1, dataSize = 0;
  while (offset < buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(offset + 10);
      rate = buf.readUInt32LE(offset + 12);
      bits = buf.readUInt16LE(offset + 22);
    } else if (id === "data") {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset < 0) throw new Error("no data chunk");
  return { pcm: buf.subarray(dataOffset, dataOffset + dataSize), rate, channels, bits };
}

function resample16k(pcm, rate, channels, bits) {
  if (rate === 16000 && bits === 16 && channels === 1) return pcm;
  const bytesPerSample = bits / 8;
  const inFrames = pcm.length / (channels * bytesPerSample);
  const outFrames = Math.floor((inFrames * 16000) / rate);
  const out = Buffer.alloc(outFrames * 2);
  for (let i = 0; i < outFrames; i++) {
    const srcIdx = Math.floor((i * rate) / 16000);
    let val = 0;
    for (let c = 0; c < channels; c++) {
      const off = srcIdx * channels * bytesPerSample + c * bytesPerSample;
      val += bits === 16 ? pcm.readInt16LE(off) : pcm.readInt32LE(off) / 32768;
    }
    val = val / channels;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(val))), i * 2);
  }
  return out;
}

async function main() {
  const cfg = loadConfig();

  console.log("获取 Token...");
  const { token, expireTime } = await createToken(cfg.accessKeyId, cfg.accessKeySecret);
  console.log(`Token 获取成功, 过期时间戳: ${expireTime}`);

  const wavPath = process.argv[2];
  const { pcm, rate, channels, bits } = readWavPcm16(wavPath);
  const pcm16 = resample16k(pcm, rate, channels, bits);
  const seconds = pcm16.length / 32000;
  console.log(`audio: ${seconds.toFixed(1)}s, pcm16 ${pcm16.length} bytes`);

  const client = new NlsClient({ token, appkey: cfg.appkey });

  let finalText = "";
  let lastPartial = "";

  client.on("raw", (d) => {
    console.log(`[raw] ${d.header && d.header.name} status=${d.header && d.header.status}`);
  });
  client.on("partial", (t) => {
    lastPartial = t;
    process.stdout.write(`\r[partial] ${t}`);
  });
  client.on("result", (t) => {
    console.log(`\n[final] ${t}`);
    finalText += t;
  });
  client.on("error", (e) => {
    console.error(`\n[error] ${e.message}`);
  });
  client.on("completed", () => {
    console.log("[completed]");
  });

  await client.start({ sampleRate: 16000 });
  console.log("任务已就绪，开始发送音频");

  const frameSize = 6400;
  let sentBytes = 0;
  let sentFrames = 0;
  for (let i = 0; i < pcm16.length; i += frameSize) {
    const chunk = pcm16.subarray(i, i + frameSize);
    client.sendPcm(chunk);
    sentBytes += chunk.length;
    sentFrames++;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  console.log(`发送完成: ${sentFrames} 帧 / ${sentBytes} bytes`);

  client.stop();

  await new Promise((resolve) => setTimeout(resolve, 3000));
  client.close();

  console.log("\n=== NLS OUTPUT ===");
  console.log(finalText);
}

main().catch((e) => {
  console.error("ERROR:", e.message || e);
  process.exit(1);
});
