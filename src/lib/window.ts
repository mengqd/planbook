import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

/** 与 Tauri 内部 ResizeDirection 一致（该类型未被导出） */
export type ResizeDirection =
  | 'East'
  | 'North'
  | 'NorthEast'
  | 'NorthWest'
  | 'South'
  | 'SouthEast'
  | 'SouthWest'
  | 'West';

export const STICKY_LABEL = 'sticky';

/** 当前窗口标签：浏览器环境或非 Tauri 一律当作主窗口 */
export function currentWindowLabel(): string {
  if (typeof window === 'undefined') return 'main';
  if (
    (window as unknown as { __PLANBOOK_STICKY__?: boolean })
      .__PLANBOOK_STICKY__
  ) {
    return STICKY_LABEL;
  }
  if (!('__TAURI_INTERNALS__' in window)) return 'main';
  try {
    return getCurrentWindow().label;
  } catch {
    return 'main';
  }
}

/**
 * 是否为桌面便签窗口。
 * 优先用 Rust 侧注入的标记（最可靠），再退回窗口标签判断。
 */
export function isStickyWindow(): boolean {
  if (typeof window === 'undefined') return false;
  if (
    (window as unknown as { __PLANBOOK_STICKY__?: boolean })
      .__PLANBOOK_STICKY__
  ) {
    return true;
  }
  return currentWindowLabel() === STICKY_LABEL;
}

/** 排障日志，写到本机 sticky-debug.log */
export function stickyDebug(msg: string): void {
  void invoke('sticky_debug', { msg }).catch(() => {});
}

/**
 * 拖动窗口跟随鼠标。
 * 便签窗口是运行时用 WebviewWindowBuilder 创建的，
 * 对应的前端 API 是 @tauri-apps/api/webviewWindow。
 */
export async function startWindowDrag(): Promise<void> {
  try {
    stickyDebug('drag: calling startDragging via webviewWindow');
    await getCurrentWebviewWindow().startDragging();
    stickyDebug('drag: startDragging ok');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stickyDebug('drag: webviewWindow FAILED -> ' + msg);
    try {
      stickyDebug('drag: fallback to window api');
      await getCurrentWindow().startDragging();
      stickyDebug('drag: fallback ok');
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      stickyDebug('drag: fallback FAILED -> ' + msg2);
    }
  }
}

/** 拉动窗口边缘调整大小 */
export async function startWindowResize(dir: ResizeDirection): Promise<void> {
  try {
    stickyDebug('resize: ' + dir + ' via window api');
    await getCurrentWindow().startResizeDragging(dir);
    stickyDebug('resize: ok');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stickyDebug('resize: window FAILED -> ' + msg);
    try {
      await getCurrentWebviewWindow().startResizeDragging(dir);
      stickyDebug('resize: fallback ok');
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      stickyDebug('resize: fallback FAILED -> ' + msg2);
    }
  }
}

/**
 * 直接设置窗口大小（逻辑像素）。
 * 自己实现缩放，避免依赖在部分场景下不稳定的原生边缘拖动。
 */
export async function setWindowSize(w: number, h: number): Promise<void> {
  try {
    await getCurrentWindow().setSize(
      new LogicalSize(Math.round(w), Math.round(h)),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stickyDebug('setSize FAILED -> ' + msg);
  }
}

/**
 * 关闭便签窗口。
 * 优先走 Rust 的 close_sticky：它隐藏窗口的同时会向主窗口广播，
 * 从而同步主窗口「钉桌面 / 关闭便签」按钮的状态。
 */
export async function closeStickyWindow(): Promise<boolean> {
  try {
    stickyDebug('close: invoke close_sticky');
    await invoke('close_sticky');
    stickyDebug('close: close_sticky ok');
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stickyDebug('close: close_sticky FAILED -> ' + msg);
    return await hideStickyWindow();
  }
}

/** 隐藏（关闭）当前便签窗口 */
export async function hideStickyWindow(): Promise<boolean> {
  try {
    stickyDebug('close: calling hide via window api');
    await getCurrentWindow().hide();
    stickyDebug('close: hide ok');
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stickyDebug('close: window FAILED -> ' + msg);
    try {
      await getCurrentWebviewWindow().hide();
      stickyDebug('close: fallback hide ok');
      return true;
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      stickyDebug('close: fallback FAILED -> ' + msg2);
      return false;
    }
  }
}
