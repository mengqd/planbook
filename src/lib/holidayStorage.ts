import { invoke } from '@tauri-apps/api/core';
import type { OfficialDay } from './holidayData';

const LS_KEY = 'planbook:holidays';

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** 读取本地覆盖数据（用户更新过的节假日），不存在返回空数组 */
export async function loadHolidayOverride(): Promise<OfficialDay[]> {
  if (isTauri) {
    try {
      const res = await invoke<{ days?: OfficialDay[] } | null>('load_holidays');
      return res?.days ?? [];
    } catch (e) {
      console.warn('[planbook] load holidays failed', e);
      return [];
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data?.days) ? (data.days as OfficialDay[]) : [];
  } catch {
    return [];
  }
}

/** 保存覆盖数据到本机配置文件，成功返回文件路径 */
export async function saveHolidayOverride(
  days: OfficialDay[],
): Promise<string | null> {
  if (isTauri) {
    try {
      return await invoke<string>('save_holidays', { days });
    } catch (e) {
      console.warn('[planbook] save holidays failed', e);
      return null;
    }
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: 1, days }));
  } catch {
    return null;
  }
  return null;
}
