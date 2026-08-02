# 提示词：生成「语音输入浮窗」桌面应用

> 使用方法：把下面「提示词正文」整段复制给任意 AI 编程助手（如 opencode / Cursor / Copilot），即可让它复刻本项目。
> 作者经验：本提示词已包含所有关键技术细节和踩坑点，可显著减少返工。

---

## 提示词正文

```
请帮我开发一个 Windows 桌面应用「语音输入浮窗」，用 Electron 实现。这是个人使用的语音转文字工具，核心诉求是「极简、快速、识别完自动复制」。

## 一、核心需求

1. 极简交互：常态只显示一个 48px 圆形麦克风小按钮，可拖动、可点击
2. 点击按钮 = 开始/停止识别（同一键 toggle）
3. 悬停按钮 2 秒展开完整设置面板，鼠标移开自动收起
4. 长按按钮 0.3 秒出现扩散光环特效
5. 全局快捷键触发识别（默认 Ctrl+Shift+V，可自定义，如 Alt+C）
6. 识别结束自动复制完整文本到剪贴板（必须可靠，即使窗口无焦点）
7. 静音超过 4 秒自动停止识别并复制
8. 双引擎可切换：阿里云 NLS（在线，默认，准确率高）+ vosk（本地离线，无网可用）

## 二、技术栈

- Electron 43+（无边框、透明窗口）
- 主进程：窗口管理、全局快捷键、本地 HTTP 服务、阿里云 NLS 客户端（ws 库）
- 渲染进程：麦克风采集（getUserMedia）、交互逻辑、vosk-browser WASM 本地识别
- preload.js + contextIsolation 桥接，nodeIntegration: false

## 三、架构

渲染进程（麦克风采集 + 交互 + vosk 本地识别）
  ↓ IPC（preload 桥接）
主进程（窗口/快捷键/HTTP 服务/NLS 客户端）
  ↓ WebSocket
阿里云 NLS 智能语音交互（在线）

## 四、关键实现细节（务必遵守，否则会踩坑）

1. 音频链路：渲染进程用默认采样率创建 AudioContext（不要强制 16000，部分声卡会失败），
   采集 Float32 后经 IPC 发给主进程，主进程手动重采样到 16k 再发 NLS。
2. 阿里云 NLS 是「智能语音交互 ISI」服务（不是百炼 Paraformer），凭证是 AccessKey ID/Secret + Appkey：
   - Token 获取：POST https://nls-meta.cn-shanghai.aliyuncs.com/ 带 AccessKey 做 HMAC-SHA1 RPC 签名（CreateToken）
   - 识别：wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=<token>
   - 协议：先发 StartTranscription（含 appkey/task_id）→ 收到 TranscriptionStarted 才能发音频
     → 发 PCM 二进制 → 收 SentenceEnd/TranscriptionResultChanged → 发 StopTranscription → 收 TranscriptionCompleted
   - 错误码 40000004 = IDLE_TIMEOUT（连上 10 秒无数据），根因常是 start() 没等 started 就发音频
   - Token 有有效期，需缓存并在过期前刷新
3. 自动复制必须用主进程 require("electron").clipboard.writeText，经 IPC 暴露给渲染进程。
   不要用渲染进程的 navigator.clipboard.writeText —— 窗口无焦点时会报
   "Document is not focused" 导致复制失败（打包版必现）。
4. 停止识别的复制时序：先发 nlsStop()，等收到 TranscriptionCompleted 事件后再复制完整文本
   （否则最后一段结果未返回，复制内容不完整）。
5. 透明窗口：BrowserWindow 必须设 transparent:true + backgroundColor:"#00000000"，
   否则小按钮周围会出现黑框。
6. 窗口拖动：用 mousedown 记录坐标，mousemove 时经 IPC 调 win.setPosition 实时移动；
   区分「点击」和「拖动」（移动超过 3px 算拖动）。
7. 本地 HTTP 服务：vosk-browser 的 Web Worker 需要从 HTTP 加载模型（file:// 会 CORS 失败），
   CSP 需允许 worker-src blob: 和 script-src 'unsafe-eval'。
8. vosk 模型：必须打包成 tar.gz（内含 vosk-model-small-cn-0.22 目录），经 HTTP 提供。
9. 配置安全：阿里云凭证存 config.json，.gitignore 忽略，不硬编码。
   打包版从 asar 或 userData 读取（nls.js 里两个候选路径）。
10. 快捷键：主进程 globalShortcut 动态注册，设置面板点击后录制新组合键，存 userData/hotkey.json。

## 五、UI 参考

- 宽 300px 深色面板，低饱和配色，单一蓝色强调色，简洁线条 SVG 图标（不用 emoji）
- 常态只一个 48px 圆形按钮，无其他元素
- 设置面板可折叠：透明度滑块(40-100%)、置顶、引擎、语言、快捷键录制
- 识别中文本实时显示，中间结果灰色、最终结果白色

## 六、打包分发

- electron-builder --win nsis，产物为 NSIS 安装包
- 安装后自动创建桌面快捷方式 + 开始菜单快捷方式
- 应用加单实例锁（requestSingleInstanceLock），重复启动聚焦已有窗口
- 注意：Smart App Control（智能应用控制）会拦截未签名 exe，双击无反应需到
  Windows 安全中心关闭 SAC 或重启电脑

## 七、验收标准

- [ ] 常态只有圆按钮、无黑框、可拖动
- [ ] 点击/快捷键可开始和停止识别
- [ ] 识别完剪贴板自动得到完整文本（无焦点也生效）
- [ ] 静音 4 秒自动停
- [ ] 快捷键可自定义且重启保持
- [ ] 打包后 EXE 可运行，桌面快捷方式可用
```

---

## 使用建议

1. **给 AI 助手后**：建议追加一句「先搭建项目结构，然后分模块实现：主进程 → preload → 渲染进程 → 阿里云接入 → 打包」，让 AI 分步做。
2. **凭证**：提示词不含你的密钥，需要对方自己在阿里云申请（见下方）。
3. **测试**：生成后务必要求 AI「用真实音频自测录音→识别→自动复制全链路」（本项目曾因没实测打包版复制而返工）。

## 对方需要准备的

| 项目 | 获取方式 |
|------|---------|
| AccessKey ID/Secret | https://ram.console.aliyun.com/manage/ak |
| 开通 NLS 服务 | https://ai.aliyun.com/nls （免费试用 3 个月） |
| Appkey | https://nls-portal.console.aliyun.com/applist （创建项目） |
| vosk 模型（离线引擎） | https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip |

## 参考项目

完整实现见本仓库 `voice-desktop/`。关键文件：
- `src/main.js` — 主进程（窗口/快捷键/HTTP/NLS IPC/单实例）
- `src/nls.js` + `src/nls-client.js` + `src/aliyun-token.js` — 阿里云接入
- `src/renderer.js` — 渲染进程（麦克风采集/交互/vosk）
- `docs/REQUIREMENTS.md` — 完整需求文档
