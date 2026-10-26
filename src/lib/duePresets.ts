export interface DuePreset {
  id: string;
  name: string; // 标签名，如“下班前”
  time: string; // HH:MM
  days: number; // 0 = 每天(今天)，N = N 天后
}

const KEY = 'planbook:due-presets';

const DEFAULTS: DuePreset[] = [
  { id: 'def-offwork', name: '下班前', time: '18:00', days: 0 },
];

export function loadPresets(): DuePreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...DEFAULTS];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr as DuePreset[];
    return [...DEFAULTS];
  } catch {
    return [...DEFAULTS];
  }
}

export function savePresets(list: DuePreset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* 忽略存储失败 */
  }
}

/** 把预设换算成具体的截止时间（ISO） */
export function applyPreset(p: DuePreset): string {
  const d = new Date();
  d.setDate(d.getDate() + (p.days || 0));
  const [h, m] = p.time.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export function uid(): string {
  return 'p' + Math.random().toString(36).slice(2, 9);
}
