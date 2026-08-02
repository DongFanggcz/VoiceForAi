# 语音输入浮窗

语音转文字的桌面置顶浮窗。说话 → 识别 → 自动复制到剪贴板，方便快速给 AI 助手或其它程序输入指令。

## 项目结构

- `voice-input/` — 网页版浮窗（浏览器 Web Speech API，已弃用）
- `voice-desktop/` — Electron 桌面版（Whisper 离线识别，当前推荐）

## 快速开始（桌面版）

```bash
cd voice-desktop
npm install
npm start
```

首次启动会自动加载 Whisper 模型（`models/` 目录，需提前放入，见下文）。

## Whisper 模型

应用使用 [transformers.js](https://github.com/huggingface/transformers.js) + Whisper 离线识别，免费、无需联网、无需 API Key。

模型文件需放在 `voice-desktop/models/Xenova/whisper-base/`，可从 HuggingFace 镜像下载：

```bash
# 国内可用 hf-mirror.com 镜像
# Xenova/whisper-base 需要：config.json、tokenizer*.json、vocabulary.json、preprocessor_config.json、
# merges.txt、onnx/encoder_model_quantized.onnx、onnx/decoder_model_merged_quantized.onnx
```

> 注：模型文件较大，未纳入 git 仓库，需自行下载。

## 功能

- 始终置顶的浮窗，可拖动、可最小化
- Whisper 离线识别，支持普通话/繁体中文/英文/日文/韩文
- 实时分块识别，识别结果自动追加
- 「自动复制」开关：识别后自动复制到剪贴板

## 语言

Whisper 是 OpenAI 开源的通用语音识别模型，对多语言支持良好。应用内置了常见语言选项，可扩展。

## 免责声明

本项目为个人工具，语音识别在本地完成，不上传任何音频。
