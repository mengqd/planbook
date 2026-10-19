@echo off
chcp 65001 >nul
echo ============================================
echo    便签 - Windows 安装包一键打包
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js
    echo 请先到 https://nodejs.org 下载安装 LTS 版本，然后重试
    pause
    exit /b 1
)

where cargo >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Rust
    echo 请先到 https://rustup.rs 下载 rustup-init.exe 安装，然后重试
    pause
    exit /b 1
)

echo [1/3] 安装依赖...
call npm install
if errorlevel 1 goto :fail

echo.
echo [2/3] 编译并打包（首次约 5-10 分钟，请耐心等待）...
call npm run tauri build
if errorlevel 1 goto :fail

echo.
echo [3/3] 打包完成！正在打开安装包所在目录...
explorer "src-tauri\target\release\bundle\nsis"
echo.
echo 安装包文件名：planbook_0.1.0_x64-setup.exe
pause
exit /b 0

:fail
echo.
echo [失败] 打包过程中出错，请把上面的错误信息发给开发者
pause
exit /b 1
