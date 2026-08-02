# 语音输入浮窗

语音转文字的桌面置顶浮窗。说话 → 识别 → 自动复制到剪贴板，方便快速给 AI 助手或其它程序输入指令。

## 双引擎识别

应用支持**双引擎切换**（设置面板的引擎下拉框）：

| 引擎 | 说明 | 需要网络 |
|------|------|---------|
| **阿里云（在线）** | 阿里云智能语音交互（NLS），识别准确率高、实时流式出字 | 需要 |
| **本地 vosk（离线）** | vosk-browser WASM 离线识别，无网络时可用，准确率一般 | 不需要 |

> 无网络场景使用本地 vosk，有网络场景推荐阿里云以获得更高准确率。

## 极简交互

- **常态**：仅一个可拖动的小圆按钮
- **点击**：开始/停止识别（同一键）
- **悬停 2 秒**：展开设置面板
- **长按 0.3 秒**：光环特效
- **全局快捷键**（默认 `Ctrl+Shift+V`，可自定义）：任何程序内触发
- **识别结束自动复制**；静音 4 秒自动停止

## 项目结构

- `voice-desktop/` — Electron 桌面版（当前推荐）
- `voice-input/` — 网页版浮窗（浏览器 Web Speech API，已弃用）
- `docs/` — 需求文档、快速上手、测试文档

## 快速开始（桌面版）

```bash
cd voice-desktop
npm install
npm start
```

其他用户克隆后可直接运行 `voice-desktop/setup.bat` 一键安装依赖。详细步骤见 [docs/QUICKSTART.md](docs/QUICKSTART.md)。

## 文档

| 文档 | 内容 |
|------|------|
| [需求文档](docs/REQUIREMENTS.md) | 功能需求、非功能需求、架构、优化方向 |
| [快速上手](docs/QUICKSTART.md) | 一键安装、配置、使用、常见问题 |
| [测试文档](docs/TESTING.md) | 测试程序说明、测试用例、打包分发 |
| [复刻提示词](docs/PROMPT.md) | 给 AI 用的提示词，可复刻本项目 |

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

## 免责声明

本项目为个人工具。阿里云模式会将音频发送至阿里云服务识别；vosk 模式在本地识别，音频不出本机。
