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

/**
 * 把预设换算成具体的截止时间（ISO）。
 * anchorDate 为任务所属日期（YYYY-MM-DD）；不传则按今天。
 * 逻辑：以 anchorDate 为基准，加上 days 天偏移，再套用 time 时间。
 * 这样无论你停留在哪一天（今天或未来），标签时间都会落在那一天，而不是硬塞成今天。
 */
export function applyPreset(p: DuePreset, anchorDate?: string): string {
  const base = anchorDate
    ? new Date(anchorDate + 'T00:00:00')
    : new Date();
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    0,
    0,
    0,
    0,
  );
  d.setDate(d.getDate() + (p.days || 0));
  const [h, m] = p.time.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export function uid(): string {
  return 'p' + Math.random().toString(36).slice(2, 9);
}
