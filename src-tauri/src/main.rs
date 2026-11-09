// 发布版按 GUI 程序运行，Windows 下不再弹出控制台窗口；
// debug 版保留控制台，方便查看日志
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

/// 任务绑定的本地文件 / 文件夹
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct Attachment {
    path: String,
    name: String,
    /// "file" | "dir"
    kind: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct Plan {
    id: String,
    date: String,
    title: String,
    note: Option<String>,
    done: bool,
    created_at: String,
    updated_at: String,
    completed_at: Option<String>,
    due_at: Option<String>,
    // default: 兼容历史 plans.json（没有该字段的旧数据）
    #[serde(default)]
    attachments: Vec<Attachment>,
}

/// 探测拖入 / 已绑定的路径：名称、类型、是否仍然存在
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PathInfo {
    path: String,
    name: String,
    kind: String,
    exists: bool,
}

fn probe_path(p: &str) -> PathInfo {
    let path = std::path::Path::new(p);
    let name = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| p.to_string());
    let (kind, exists) = match fs::metadata(path) {
        Ok(m) if m.is_dir() => ("dir", true),
        Ok(_) => ("file", true),
        Err(_) => ("file", false),
    };
    PathInfo {
        path: p.to_string(),
        name,
        kind: kind.to_string(),
        exists,
    }
}

#[tauri::command]
fn inspect_paths(paths: Vec<String>) -> Vec<PathInfo> {
    paths.iter().map(|p| probe_path(p)).collect()
}

/// 打开附件；reveal=true 表示在文件管理器中定位（仅文件使用）
#[tauri::command]
fn open_attachment(path: String, reveal: bool) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err("该路径已不存在，可能已被移动或删除".to_string());
    }
    let result = if reveal {
        tauri_plugin_opener::reveal_item_in_dir(&path)
    } else {
        tauri_plugin_opener::open_path(&path, None::<&str>)
    };
    result.map_err(|e| format!("打开失败: {e}"))
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Store {
    version: u8,
    plans: Vec<Plan>,
}

/// 返回数据目录：~/Library/Application Support/com.planbook.app
fn store_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法获取配置目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建目录: {e}"))?;
    Ok(dir.join("plans.json"))
}

#[tauri::command]
fn load_plans(app: tauri::AppHandle) -> Result<Store, String> {
    let path = store_path(&app)?;
    if !path.exists() {
        return Ok(Store {
            version: 1,
            plans: Vec::new(),
        });
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("读取失败: {e}"))?;
    let store: Store =
        serde_json::from_str(&data).map_err(|e| format!("解析失败: {e}"))?;
    Ok(store)
}

/// 保存计划。source 为写入方窗口标签，写完后广播，
/// 让另一个窗口（主窗口 / 便签）知道磁盘数据变了并重新加载。
#[tauri::command]
fn save_plans(
    app: tauri::AppHandle,
    plans: Vec<Plan>,
    source: String,
) -> Result<(), String> {
    let path = store_path(&app)?;
    let store = Store {
        version: 1,
        plans,
    };
    let data =
        serde_json::to_string_pretty(&store).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&path, data).map_err(|e| format!("写入失败: {e}"))?;
    app.emit("planbook:plans-changed", &source)
        .map_err(|e| format!("广播变更失败: {e}"))?;
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct OfficialDay {
    name: String,
    date: String,
    is_off_day: bool,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct HolidayStore {
    version: u8,
    days: Vec<OfficialDay>,
}

/// 节假日数据文件：~/Library/Application Support/<id>/holidays.json
fn holiday_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法获取配置目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建目录: {e}"))?;
    Ok(dir.join("holidays.json"))
}

#[tauri::command]
fn load_holidays(app: tauri::AppHandle) -> Result<Option<HolidayStore>, String> {
    let path = holiday_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("读取失败: {e}"))?;
    let store: HolidayStore =
        serde_json::from_str(&data).map_err(|e| format!("解析失败: {e}"))?;
    Ok(Some(store))
}

#[tauri::command]
fn save_holidays(app: tauri::AppHandle, days: Vec<OfficialDay>) -> Result<String, String> {
    let path = holiday_path(&app)?;
    let store = HolidayStore {
        version: 1,
        days,
    };
    let data =
        serde_json::to_string_pretty(&store).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&path, data).map_err(|e| format!("写入失败: {e}"))?;
    Ok(path.to_string_lossy().to_string())
}

/// 导出：写入 JS 端选定的路径，返回该路径
#[tauri::command]
fn export_plans(path: String, plans: Vec<Plan>) -> Result<String, String> {
    let store = Store {
        version: 1,
        plans,
    };
    let data =
        serde_json::to_string_pretty(&store).map_err(|e| format!("序列化失败: {e}"))?;
    fs::write(&path, data).map_err(|e| format!("写入失败: {e}"))?;
    Ok(path)
}

/// 导入：读取 JS 端选定的路径，返回解析后的数据
#[tauri::command]
fn import_plans(path: String) -> Result<Store, String> {
    let data = fs::read_to_string(&path).map_err(|e| format!("读取失败: {e}"))?;
    let store: Store =
        serde_json::from_str(&data).map_err(|e| format!("解析失败: {e}"))?;
    Ok(store)
}

/// 下载示例模板：写入 JS 端选定的路径，返回该路径
#[tauri::command]
fn download_template(path: String) -> Result<String, String> {
    let template = r#"{
  "version": 1,
  "plans": [
    {
      "id": "plan-1",
      "date": "2026-09-30",
      "title": "示例：早上喝一杯水",
      "note": "可选备注，可留空",
      "done": false,
      "createdAt": "2026-09-30T01:00:00.000Z",
      "updatedAt": "2026-09-30T01:00:00.000Z",
      "completedAt": null
    },
    {
      "id": "plan-2",
      "date": "2026-09-30",
      "title": "示例：散步 20 分钟",
      "note": "",
      "done": true,
      "createdAt": "2026-09-30T01:00:00.000Z",
      "updatedAt": "2026-09-30T02:00:00.000Z",
      "completedAt": "2026-09-30T02:00:00.000Z"
    }
  ]
}"#;
    fs::write(&path, template).map_err(|e| format!("写入模板失败: {e}"))?;
    Ok(path)
}

/// 显示桌面便签窗口：无边框 / 始终置顶
///
/// 注意：这里刻意声明为 async，让命令跑在 Tauri 的异步线程池而不是主线程。
/// 创建窗口内部是「往事件循环发消息 + 阻塞等回执」（tauri-runtime-wry 的
/// create_window 里 `rx.recv()`），任何主线程上的停顿都会把整个应用拖死。
#[tauri::command]
async fn show_sticky(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("sticky") {
        w.show().map_err(|e| format!("显示失败: {e}"))?;
        w.set_focus().map_err(|e| format!("聚焦失败: {e}"))?;
        return Ok(());
    }
    let mut builder = WebviewWindowBuilder::new(
        &app,
        "sticky",
        WebviewUrl::App("index.html".into()),
    )
    .title("今日任务")
    .inner_size(300.0, 150.0)
    .min_inner_size(200.0, 90.0)
    .always_on_top(true)
    // 便签是桌面小挂件，不再额外占用一个任务栏图标（Windows 生效，macOS 上忽略）
    .skip_taskbar(true)
    // macOS 无边框窗口不开启此项时，第一次点击会被窗口激活吞掉，导致拖动失灵（Windows 上忽略）
    .accept_first_mouse(true)
    // 在页面脚本执行前注入标记，让前端确定性地渲染便签界面（不依赖窗口标签判断）
    .initialization_script("window.__PLANBOOK_STICKY__ = true;");

    // 无边框 + 真透明：两个平台一致。
    //
    // Windows 上的历史问题：tao 会在 WM_CREATE 里对 transparent 的窗口同步调用
    // 早已废弃的 DwmEnableBlurBehindWindow，曾导致「钉桌面」时整个程序卡死。
    // 该调用之所以会卡，是因为命令是同步的 —— 窗口创建跑在 webview IPC 回调的
    // 嵌套上下文里（tauri-runtime-wry 的 send_user_message 有主线程内联快路径），
    // 在那种上下文里做同步 DWM 往返容易死锁。
    // 现在 show_sticky 已改为 async，窗口创建回到事件循环的顶层执行，风险大幅降低。
    //
    // 同时这里刻意**不再**叠加 Mica/Acrylic（set_effects）：它们会额外向 DWM
    // 发起特效调用，是另一个卡死嫌疑点；而且 CSS 侧也已经去掉了 backdrop-filter。
    // 透明效果完全交给窗口本身的透明 + CSS 的半透明面板。
    builder = builder.decorations(false).transparent(true);

    // 无边框窗口默认落点可能压在菜单栏下，这里显式放到右上角安全区
    let mut placed = false;
    if let Ok(Some(m)) = app.primary_monitor() {
        let size = m.size();
        let scale = m.scale_factor();
        let sw = (size.width as f64 / scale).max(400.0);
        let sh = (size.height as f64 / scale).max(300.0);
        let x = (sw - 340.0).max(20.0);
        let y = ((sh - 500.0) / 2.0).clamp(90.0, (sh - 200.0).max(90.0));
        builder = builder.position(x, y);
        placed = true;
    }
    if !placed {
        builder = builder.center();
    }

    builder
        .build()
        .map_err(|e| format!("创建便签窗口失败: {e}"))?;

    Ok(())
}

/// 便签窗口排障日志，写到 ~/Library/Application Support/<id>/sticky-debug.log
#[tauri::command]
fn sticky_debug(app: tauri::AppHandle, msg: String) -> Result<(), String> {
    use std::io::Write;
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("无法获取配置目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建目录: {e}"))?;
    let line = format!(
        "[{}] {}\n",
        chrono::Local::now().format("%H:%M:%S%.3f"),
        msg
    );
    let mut f = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("sticky-debug.log"))
        .map_err(|e| format!("打开日志失败: {e}"))?;
    f.write_all(line.as_bytes())
        .map_err(|e| format!("写入日志失败: {e}"))?;
    Ok(())
}

/// 由便签窗口内部自行关闭：隐藏窗口并通知主窗口同步按钮状态
#[tauri::command]
fn close_sticky(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("sticky") {
        w.hide().map_err(|e| format!("隐藏失败: {e}"))?;
    }
    app.emit("planbook:sticky-closed", false)
        .map_err(|e| format!("发送状态事件失败: {e}"))?;
    Ok(())
}

#[tauri::command]
fn hide_sticky(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("sticky") {
        w.hide().map_err(|e| format!("隐藏失败: {e}"))?;
    }
    Ok(())
}

/// 显示并聚焦主窗口（菜单栏图标、Dock 点击共用）
fn show_main<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// 主窗口可见则隐藏，否则显示（菜单栏图标左键点击）
fn toggle_main<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_main(app);
        }
    }
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_plans,
            save_plans,
            export_plans,
            import_plans,
            download_template,
            load_holidays,
            save_holidays,
            show_sticky,
            hide_sticky,
            close_sticky,
            sticky_debug,
            inspect_paths,
            open_attachment
        ])
        .setup(|app| {
            // 顶部菜单栏（macOS）/ 系统托盘（Windows）常驻图标 + 右键菜单
            let show_i = MenuItem::with_id(app, "show", "打开便签", true, None::<&str>)?;
            let sticky_i =
                MenuItem::with_id(app, "sticky", "显示 / 隐藏桌面便签", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出便签", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sticky_i, &quit_i])?;

            // 菜单栏用透明背景的模板图标（应用主图标是不透明方块，模板化会成黑块）
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))
                .map_err(|e| e.to_string())?;

            TrayIconBuilder::new()
                .icon(icon)
                // macOS 菜单栏使用模板图标，自动适配深色/浅色菜单栏
                .icon_as_template(true)
                .menu(&menu)
                // 左键直接切换主窗口，右键才弹菜单
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "sticky" => {
                        let handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Some(w) = handle.get_webview_window("sticky") {
                                if w.is_visible().unwrap_or(false) {
                                    let _ = w.hide();
                                } else {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            } else {
                                // 首次使用时创建便签窗口（必须在异步线程中创建）
                                let _ = show_sticky(handle).await;
                            }
                        });
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        // 点主窗口红叉时隐藏到菜单栏，而不是退出应用
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // macOS：点击 Dock 图标时把隐藏的主窗口重新显示出来
    app.run(|handle, event| {
        #[cfg(target_os = "macos")]
        {
            if let tauri::RunEvent::Reopen { .. } = event {
                show_main(handle);
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (handle, event);
        }
    });
}
