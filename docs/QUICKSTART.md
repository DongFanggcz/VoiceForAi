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

> 不配置也能运行：会自动使用本地 vosk 离线引擎（需先准备模型，见下）。

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
| 悬停按钮 2 秒 | 展开设置面板 |
| 长按按钮 0.3 秒 | 光环特效 |
| `Ctrl+Shift+V`（可自定义） | 全局触发识别 |
| 识别结束 | 自动复制到剪贴板 |

## 常见问题

- **识别不出来**：确认麦克风权限已允许；确认 config.json 已配置且服务已开通
- **没自动复制**：等待出现「已停止」后再粘贴
- **桌面快捷方式**：见 `docs\TESTING.md` 打包章节

## 依赖清单

| 依赖 | 用途 |
|------|------|
| electron ^43 | 桌面框架 |
| ws ^8 | WebSocket 客户端（阿里云 NLS） |
| vosk-browser ^0.0.8 | 本地离线识别（WASM） |
| Node.js ≥ 22.12 | 运行时 |
