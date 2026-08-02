const fs = require("fs");
const path = require("path");
const nls = require("../src/nls");

function readWav(file) {
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

function pcmToFloat32(pcm) {
  const out = new Float32Array(pcm.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = pcm.readInt16LE(i * 2) / 32768;
  return out;
}

async function main() {
  const wavPath = process.argv[2];
  const sendRate = parseInt(process.argv[3] || "48000", 10); // 模拟渲染进程的采样率

  const { pcm, rate } = readWav(wavPath);
  const float32 = pcmToFloat32(pcm);
  console.log(`wav: ${(pcm.length / (rate * 2)).toFixed(1)}s @${rate}Hz, 模拟以 ${sendRate}Hz 发送`);

  // 模拟渲染进程行为：把 16k 音频当作 sendRate 采样率发送（主进程重采样回 16k）
  // 先按 sendRate 抽取样本
  const ratio = rate / sendRate;
  const simLen = Math.floor(float32.length / ratio);
  const simAudio = new Float32Array(simLen);
  for (let i = 0; i < simLen; i++) simAudio[i] = float32[Math.floor(i * ratio)];

  let finalText = "";
  let frames = 0;

  const client = await nls.startSession({
    sampleRate: 16000,
    onPartial: () => {},
    onResult: (t) => { finalText += t; console.log("[final] " + t); },
    onError: (e) => console.error("[error] " + e.message),
    onCompleted: () => console.log("[completed]")
  });
  console.log(`会话已建立: ${client.taskId}`);

  await new Promise((r) => setTimeout(r, 1200));

  const frameSize = 4096;
  for (let i = 0; i < simAudio.length; i += frameSize) {
    const chunk = simAudio.subarray(i, i + frameSize);
    nls.sendAudio(chunk, sendRate);
    frames++;
    await new Promise((r) => setTimeout(r, 85));
  }
  console.log(`音频发送完成: ${frames} 帧`);

  await new Promise((r) => setTimeout(r, 2500));
  nls.stopSession();

  console.log("\n=== 集成测试结果 ===");
  console.log(finalText || "(无识别结果)");
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
