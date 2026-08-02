const { pipeline, env } = require("@huggingface/transformers");
const { Converter } = require("opencc-js");
const path = require("path");

let toSimplified = null;

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = path.join(__dirname, "..", "models");
env.cacheDir = path.join(__dirname, "..", ".cache");

const MODEL_IDS = {
  base: "Xenova/whisper-base",
  small: "Xenova/whisper-small"
};

let transcriber = null;
let ready = false;

function resampleTo16000(float32, sampleRate) {
  if (sampleRate === 16000) return float32;
  const ratio = sampleRate / 16000;
  const newLen = Math.floor(float32.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    out[i] = float32[Math.floor(i * ratio)];
  }
  return out;
}

async function loadModel(modelKey, onProgress) {
  const modelId = MODEL_IDS[modelKey] || MODEL_IDS.base;
  transcriber = await pipeline("automatic-speech-recognition", modelId, {
    dtype: "q8",
    device: "cpu",
    progress_callback: (p) => {
      if (onProgress && p.status) onProgress(p);
    }
  });
  ready = true;
  return modelId;
}

async function transcribe(float32, sampleRate, language, onPartial) {
  if (!transcriber) throw new Error("model not loaded");
  const audio = resampleTo16000(float32, sampleRate);
  const isChinese = language === "chinese" || language === "zh";
  if (isChinese && !toSimplified) {
    toSimplified = Converter({ from: "tw", to: "cn" });
  }
  const out = await transcriber(audio, {
    language: language || "chinese",
    task: "transcribe",
    return_timestamps: false,
    chunk_length_s: 30,
    stride_length_s: 5,
    callback_function: (beams) => {
      if (onPartial && beams.length) onPartial(beams[beams.length - 1].tokens.join(""));
    }
  });
  let text = (out && out.text) || "";
  if (isChinese && toSimplified) text = toSimplified(text);
  return text;
}

function isReady() {
  return ready;
}

function getModelIds() {
  return MODEL_IDS;
}

module.exports = { loadModel, transcribe, isReady, getModelIds };
