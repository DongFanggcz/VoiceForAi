# 快速上手（其他用户）

克隆仓库后按以下步骤运行。

## 一、一键安装依赖

在 `voice-desktop` 目录下双击运行 **`setup.bat`**（自动完成 Node.js 检测、npm 依赖安装、模型检查）。

> 若网络慢：先开启加速器/代理，再运行。或手动执行 `npm install`。

## 二、配置阿里云凭证（可选但推荐）

复制 `config.example.json` 为 `config.json` 并填写：

```json
{
  "provider": "aliyun-isi",
  "accessKeyId": "你的 AccessKey ID",
  "accessKeySecret": "你的 AccessKey Secret",
  "appkey": "你的项目 Appkey"
}
```

获取方式：
1. **AccessKey**（ID 以 `LTAI` 开头）：https://ram.console.aliyun.com/manage/ak
2. **开通服务**：https://ai.aliyun.com/nls（免费试用 3 个月）
3. **Appkey**：https://nls-portal.console.aliyun.com/applist（创建项目后获取）

> 不配置阿里云也能运行：切换到「本地 vosk」引擎即可（需先准备模型，见下）。
> 注意：阿里云引擎是默认的，若未配置凭证，点击识别会提示「连接失败」，此时请在设置中切换为本地 vosk。

## 三、准备本地 vosk 模型（离线引擎用）

下载 `vosk-model-small-cn-0.22.zip`（约 43MB）：
https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip

```bash
# 在 voice-desktop 目录下：
# 1. 解压得到 model/vosk-model-small-cn-0.22/
# 2. 打包成 model.tar.gz：
cd model
tar -czf ../model.tar.gz vosk-model-small-cn-0.22
```

## 四、运行

```bash
cd voice-desktop
npm start
```

## 五、使用

| 操作 | 效果 |
|------|------|
| 点击圆按钮 | 开始/停止识别 |
| 拖动圆按钮 | 移动浮窗位置 |
| 悬停按钮 2 秒 | 展开设置面板 |
| 长按按钮 0.3 秒 | 光环特效 |
| `Ctrl+Shift+V`（可自定义） | 全局触发识别 |
| 识别结束 | 自动复制到剪贴板 |
| 静音 4 秒 | 自动停止并复制 |

设置面板（⚙）可调整：快捷键、透明度、置顶、引擎、语言。

## 六、打包版（EXE）

安装包：`dist/语音输入浮窗 Setup 1.0.0.exe`（需自行 `npm run pack` 生成）。

打包版注意：
- **config.json 会被打进安装包**（含你的密钥），适合个人使用；若需分发他人，请删除 `config.json` 再打包
- 首次运行若提示「连接失败」，检查设置里的引擎/凭证
- **Smart App Control（智能应用控制）会拦截未签名应用**：若双击无反应，到「Windows 安全中心 → 应用和浏览器控制」关闭 SAC，或重启电脑

## 常见问题

- **识别不出来**：确认麦克风权限已允许；确认 config.json 已配置且服务已开通
- **没自动复制**：等待出现「已停止」后再粘贴；旧版本请在识别完全结束后再操作
- **打包版打不开**：多半是 Smart App Control 拦截，见上方「打包版注意」
- **桌面快捷方式**：见 `docs\TESTING.md` 打包章节

## 依赖清单

| 依赖 | 用途 |
|------|------|
| electron ^43 | 桌面框架 |
| ws ^8 | WebSocket 客户端（阿里云 NLS） |
| vosk-browser ^0.0.8 | 本地离线识别（WASM） |
| Node.js ≥ 22.12 | 运行时 |
