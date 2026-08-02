# 语音输入浮窗

语音转文字的桌面置顶浮窗。说话 → 识别 → 自动复制到剪贴板，方便快速给 AI 助手或其它程序输入指令。

## 双引擎识别

应用支持**双引擎切换**（浮窗顶部的引擎下拉框）：

| 引擎 | 说明 | 需要网络 |
|------|------|---------|
| **阿里云（在线）** | 阿里云智能语音交互（NLS），识别准确率高、实时流式出字 | 需要 |
| **本地 vosk（离线）** | vosk-browser WASM 离线识别，无网络时可用，准确率一般 | 不需要 |

> 无网络场景使用本地 vosk，有网络场景推荐阿里云以获得更高准确率。

## 项目结构

- `voice-desktop/` — Electron 桌面版（当前推荐）
- `voice-input/` — 网页版浮窗（浏览器 Web Speech API，已弃用）

## 快速开始（桌面版）

```bash
cd voice-desktop
npm install
npm start
```

## 阿里云 NLS 配置

在 `voice-desktop/config.json` 中配置：

```json
{
  "provider": "aliyun-isi",
  "accessKeyId": "你的 AccessKey ID",
  "accessKeySecret": "你的 AccessKey Secret",
  "appkey": "你的项目 Appkey"
}
```

获取方式：
1. AccessKey：https://ram.console.aliyun.com/manage/ak （ID 以 `LTAI` 开头）
2. 开通服务：https://ai.aliyun.com/nls （免费试用 3 个月）
3. Appkey：https://nls-portal.console.aliyun.com/applist （创建项目后获取）

## 本地 vosk 模型

vosk 本地模型需放在 `voice-desktop/model.tar.gz`（内含 `vosk-model-small-cn-0.22` 目录）。

从 https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip 下载后：
1. 解压到 `voice-desktop/model/`
2. 打包：`cd voice-desktop/model && tar -czf ../model.tar.gz vosk-model-small-cn-0.22`

> 模型文件较大，未纳入 git 仓库，需自行准备。

## 功能

- 始终置顶的浮窗，可拖动、可最小化
- 双引擎：阿里云 NLS（在线）+ vosk（离线）可切换
- 实时识别，中间结果实时展示
- 「自动复制」开关：识别后自动复制到剪贴板

## 免责声明

本项目为个人工具。阿里云模式会将音频发送至阿里云服务识别；vosk 模式在本地识别，音频不出本机。
