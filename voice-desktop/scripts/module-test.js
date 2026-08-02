const fs = require("fs");
const path = require("path");
const whisper = require("../src/whisper");

function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("not wav");
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
  const frames = dataSize / (channels * (bits / 8));
  const float = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sample = 0;
    for (let c = 0; c < channels; c++) {
      const off = dataOffset + (i * channels + c) * (bits / 8);
      if (bits === 16) sample += buf.readInt16LE(off) / 32768;
      else if (bits === 32) sample += buf.readInt32LE(off) / 2147483648;
    }
    float[i] = sample / channels;
  }
  return { data: float, sampleRate: rate };
}

async function main() {
  const wavPath = process.argv[2];
  await whisper.loadModel("base");
  console.log("whisper module loaded");
  const { data, sampleRate } = readWav(wavPath);
  const text = await whisper.transcribe(data, sampleRate, "chinese");
  console.log("\n=== WHISPER MODULE OUTPUT ===");
  console.log(text);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
