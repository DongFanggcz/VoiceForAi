@echo off
chcp 65001 >nul
echo ============================================
echo   语音输入浮窗 - 一键安装依赖
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [1/3] 未检测到 Node.js，尝试通过 winget 安装...
  winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
  if %errorlevel% neq 0 (
    echo [错误] Node.js 安装失败，请手动到 https://nodejs.org 下载安装 LTS 版本
    pause
    exit /b 1
  )
  echo [完成] Node.js 已安装
) else (
  echo [1/3] Node.js 已存在
)

set "PATH=%PATH%;%ProgramFiles%\nodejs;%APPDATA%\npm"

echo [2/3] 安装 npm 依赖 (electron / ws / vosk-browser)...
echo 若网络慢，可先开启加速器再重试本脚本。
call npm install
if %errorlevel% neq 0 (
  echo [错误] npm install 失败
  pause
  exit /b 1
)
echo [完成] npm 依赖安装完成

echo [3/3] 检查本地 vosk 模型...
if not exist "model.tar.gz" (
  echo 未找到 model.tar.gz，本地离线引擎将不可用（阿里云引擎不受影响）。
  echo 如需离线识别，请参见 ..\docs\QUICKSTART.md 下载模型。
) else (
  echo [完成] 本地模型已就绪
)

echo.
echo ============================================
echo   安装完成！运行: npm start
echo   首次使用请先配置 config.json (见 ..\docs\QUICKSTART.md)
echo ============================================
pause
