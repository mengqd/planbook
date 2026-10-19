// 发布版按 GUI 程序运行，Windows 下不再弹出控制台窗口；
// debug 版保留控制台，方便查看日志
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "windows")]
use tauri::utils::config::WindowEffectsConfig;
#[cfg(target_os = "windows")]
use tauri::utils::WindowEffect;

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

/// 显示桌面便签窗口：无边框 / 背景透明 / 始终置顶
#[tauri::command]
fn show_sticky(app: tauri::AppHandle) -> Result<(), String> {
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
    // macOS 无边框窗口不开启此项时，第一次点击会被窗口激活吞掉，导致拖动失灵（Windows 上忽略）
    .accept_first_mouse(true)
    // 在页面脚本执行前注入标记，让前端确定性地渲染便签界面（不依赖窗口标签判断）
    .initialization_script("window.__PLANBOOK_STICKY__ = true;");

    // 无边框 + 透明：两个平台一致。
    // Windows 上再叠加系统毛玻璃效果（见下方 set_effects），
    // 并且 CSS 侧有半透明深色底板兜底，即使效果不生效也不会白屏。
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

    let win = builder
        .build()
        .map_err(|e| format!("创建便签窗口失败: {e}"))?;

    // Windows：叠加系统毛玻璃。Win11 用 Mica，不支持则回退 Acrylic（Win10）。
    // Tauri 要求 effects 必须配 transparent，所以上面开了 transparent。
    #[cfg(target_os = "windows")]
    {
        if win
            .set_effects(WindowEffectsConfig {
                effects: vec![WindowEffect::Mica],
                ..Default::default()
            })
            .is_err()
        {
            let _ = win.set_effects(WindowEffectsConfig {
                effects: vec![WindowEffect::Acrylic],
                ..Default::default()
            });
        }
    }
    let _ = &win;

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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            sticky_debug
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
