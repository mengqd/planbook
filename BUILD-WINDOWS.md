# 在 Windows 上打包「便签」安装包

源码与 macOS 版完全一致，功能在 Windows 上通用。

## 一、先装环境（只需一次）

| 软件 | 说明 |
|---|---|
| **Node.js LTS** | https://nodejs.org 下载安装（20/22/24 均可），装完重开终端 |
| **Rust** | https://rustup.rs 下载 `rustup-init.exe`，一路回车默认即可 |
| **VS C++ 生成工具** | rustup 装 Rust 时若提示缺 MSVC，按提示安装 "Visual Studio Build Tools" 并勾选 **"使用 C++ 的桌面开发"** |

> Windows 10/11 自带 WebView2 运行时，不用额外装。
> 全部装完后**重启一次终端**。

## 二、打包

把本压缩包解压到任意路径（例如 `D:\planbook`），在该目录打开 PowerShell：

```powershell
npm install
npm run tauri build
```

首次编译约 5～10 分钟（Rust 要编译整个 Tauri）。

## 三、产物在哪

```
src-tauri\target\release\bundle\
├─ nsis\planbook_0.1.0_x64-setup.exe   ← 这就是安装包（推荐）
└─ msi\planbook_0.1.0_x64_zh-CN.msi    ← 备用安装包
```

双击 `.exe` 即可安装。

## 四、注意事项

1. **SmartScreen 拦截**：自己打的包没有微软签名，首次运行安装程序会提示"Windows 已保护你的电脑"。
   点 **"更多信息" → "仍要运行"** 即可。安装后的 App 首次打开同理。
2. **数据目录**：`%APPDATA%\com.planbook.planner\plans.json`
   （在文件资源管理器地址栏输入 `%APPDATA%` 回车即可进入）。
   想把 Mac 上的数据带过来，把旧的 `plans.json` 复制进去覆盖即可。
3. **想只出绿色免安装版**：把命令换成
   ```powershell
   npm run tauri build -- --bundles none
   ```
   产物是 `src-tauri\target\release\planbook.exe`，双击直接运行。
4. 打包后 `src-tauri\target` 会有几 GB 编译缓存，不需要就删掉。
5. 以后改代码只需重新跑 `npm run tauri build`，不用重装环境。
