import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { currentWindowLabel } from './window';
import type { Plan, Store } from './types';

const LS_KEY = 'planbook:plans';

// Tauri 2 注入的全局对象；在纯浏览器里为 false，自动回退到 localStorage
const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function loadPlans(): Promise<Plan[]> {
  if (isTauri) {
    try {
      const store = await invoke<Store>('load_plans');
      return store?.plans ?? [];
    } catch (e) {
      console.warn('[planbook] tauri load failed, fallback to localStorage', e);
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Plan[]) : [];
  } catch {
    return [];
  }
}

export async function savePlans(plans: Plan[]): Promise<void> {
  if (isTauri) {
    try {
      const source = currentWindowLabel();
      await invoke('save_plans', { plans, source });
      return;
    } catch (e) {
      console.warn('[planbook] tauri save failed, fallback to localStorage', e);
    }
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(plans));
  } catch (e) {
    console.warn('[planbook] localStorage save failed', e);
  }
}

/** 导出：Tauri 下存到“下载”目录并返回路径；浏览器下触发下载。返回路径或 null */
export async function exportPlans(plans: Plan[]): Promise<string | null> {
  if (isTauri) {
    try {
      const p = await save({
        defaultPath: `planbook-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'Planbook 数据', extensions: ['json'] }],
      });
      if (!p) return null;
      const path = await invoke<string>('export_plans', { path: p, plans });
      return path;
    } catch (e) {
      console.warn('[planbook] tauri export failed', e);
      return null;
    }
  }
  const blob = new Blob([JSON.stringify({ version: 1, plans }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planbook-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return null;
}

/** 导入：Tauri 下弹文件选择框；浏览器下用 <input type=file>。返回计划数组或 null */
export async function importPlans(): Promise<Plan[] | null> {
  if (isTauri) {
    try {
      const p = await open({
        multiple: false,
        filters: [{ name: 'Planbook 数据', extensions: ['json'] }],
      });
      if (!p || Array.isArray(p)) return null;
      const store = await invoke<Store>('import_plans', { path: p });
      return store?.plans ?? [];
    } catch (e) {
      throw new Error(typeof e === 'string' ? e : '导入文件解析失败');
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) {
        resolve(null);
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(String(r.result));
          if (Array.isArray(data?.plans)) {
            resolve(data.plans as Plan[]);
          } else {
            reject(new Error('文件格式不正确：顶层需包含 "plans" 数组'));
          }
        } catch {
          reject(new Error('文件不是合法的 JSON，请参照「模板」格式'));
        }
      };
      r.readAsText(f);
    };
    input.click();
  });
}

/** 下载导入模板：Tauri 下写入“下载”目录并返回路径；浏览器下触发下载 */
export async function downloadTemplate(): Promise<string | null> {
  const template: Store = {
    version: 1,
    plans: [
      {
        id: 'plan-1',
        date: '2026-09-30',
        title: '示例：早上喝一杯水',
        note: '可选备注，可留空',
        done: false,
        createdAt: '2026-09-30T01:00:00.000Z',
        updatedAt: '2026-09-30T01:00:00.000Z',
        completedAt: null,
      },
      {
        id: 'plan-2',
        date: '2026-09-30',
        title: '示例：散步 20 分钟',
        note: '',
        done: true,
        createdAt: '2026-09-30T01:00:00.000Z',
        updatedAt: '2026-09-30T02:00:00.000Z',
        completedAt: '2026-09-30T02:00:00.000Z',
      },
    ],
  };
  if (isTauri) {
    try {
      const p = await save({
        defaultPath: 'planbook-template.json',
        filters: [{ name: 'Planbook 模板', extensions: ['json'] }],
      });
      if (!p) return null;
      const path = await invoke<string>('download_template', { path: p });
      return path;
    } catch (e) {
      console.warn('[planbook] tauri template failed', e);
      return null;
    }
  }
  const blob = new Blob([JSON.stringify(template, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'planbook-template.json';
  a.click();
  URL.revokeObjectURL(url);
  return null;
}
