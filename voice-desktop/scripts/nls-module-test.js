const fs = require("fs");
const path = require("path");
const nls = require("../src/nls");

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

function pcm16ToFloat32(pcm) {
  const out = new Float32Array(pcm.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = pcm.readInt16LE(i * 2) / 32768;
  }
  return out;
}

function resample16kFloat32(float32, rate) {
  if (rate === 16000) return float32;
  const ratio = rate / 16000;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    out[i] = float32[Math.floor(i * ratio)];
  }
  return out;
}

async function main() {
  const wavPath = process.argv[2];
  const { pcm, rate, channels, bits } = readWavPcm16(wavPath);
  if (channels !== 1 || bits !== 16) {
    console.error("需要 mono 16bit wav");
    process.exit(1);
  }
  const float32 = resample16kFloat32(pcm16ToFloat32(pcm), rate);
  console.log(`音频: ${(float32.length / 16000).toFixed(1)}s @16000Hz`);

  let finalText = "";
  let sessionReady = false;

  const client = await nls.startSession({
    sampleRate: 16000,
    onPartial: (t) => { if (!sessionReady) { sessionReady = true; } },
    onResult: (t) => { finalText += t; console.log("[final] " + t); },
    onError: (e) => console.error("[error] " + e.message),
    onCompleted: () => console.log("[completed]")
  });
  console.log("会话已建立 task_id=" + client.taskId);

  await new Promise((r) => setTimeout(r, 1500));

  const frameSize = 6400;
  for (let i = 0; i < float32.length; i += frameSize / 2) {
    const chunk = float32.subarray(i, i + frameSize / 2);
    nls.sendAudio(chunk, 16000);
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("音频发送完成");

  await new Promise((r) => setTimeout(r, 3000));
  nls.stopSession();

  console.log("\n=== NLS MODULE OUTPUT ===");
  console.log(finalText);
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
