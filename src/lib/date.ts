export type DateStr = string; // YYYY-MM-DD

// 周一开头的中文星期标签
export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

/** 用本地时区把 Date 格式化为 YYYY-MM-DD，避免 toISOString 的 UTC 偏移 */
export function formatDate(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): DateStr {
  return formatDate(new Date());
}

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface Cell {
  date: Date;
  dateStr: DateStr;
  inMonth: boolean;
}

/** 生成 6 行 × 7 列的月历网格，周一开头，含上/下月补齐 */
export function getMonthMatrix(year: number, month: number): Cell[][] {
  const first = new Date(year, month, 1);
  // getDay(): 周日=0 … 周六=6 → 转为周一=0 … 周日=6
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const weeks: Cell[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: Cell[] = [];
    for (let i = 0; i < 7; i++) {
      row.push({
        date: new Date(cur),
        dateStr: formatDate(cur),
        inMonth: cur.getMonth() === month,
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

/** 在指定年月基础上增减月份，返回归一化后的年月 */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** 把 ISO 时间格式化为本地 HH:MM（无效返回空串） */
export function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 把 ISO 转成 datetime-local 输入框需要的 YYYY-MM-DDTHH:MM（本地时区，无效返回空串） */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

/** 把 datetime-local 的 YYYY-MM-DDTHH:MM（按本地时区理解）转成 ISO；空串返回 null */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export type DueLevel = 'none' | 'low' | 'mid' | 'high' | 'over';

function humanDuration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}时`;
  const d = Math.floor(h / 24);
  return `${d}天`;
}

export interface DueStatus {
  level: DueLevel;
  /** 排序权重：越大越紧急（over > high > mid > low > none） */
  weight: number;
  text: string;
}

/** 根据截止时间计算紧急度：离截止越近（含已超时）越重 */
export function dueStatus(dueAt?: string | null, now = Date.now()): DueStatus {
  if (!dueAt) return { level: 'none', weight: 0, text: '' };
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return { level: 'none', weight: 0, text: '' };
  const diff = t - now;
  if (diff < 0) {
    return { level: 'over', weight: 4, text: `已超时 ${humanDuration(-diff)}` };
  }
  if (diff <= 3 * 3600_000) return { level: 'high', weight: 3, text: `剩 ${humanDuration(diff)}` };
  if (diff <= 24 * 3600_000) return { level: 'mid', weight: 2, text: `剩 ${humanDuration(diff)}` };
  if (diff <= 3 * 86400_000) return { level: 'low', weight: 1, text: `剩 ${humanDuration(diff)}` };
  return { level: 'none', weight: 0, text: '' };
}

/**
 * 紧急度底色条宽度（百分比）：剩余时间越长越窄，越接近截止（含已超时）越宽。
 * 以 7 天为满量程，超时即为 100%。
 */
export function dueBarWidth(dueAt?: string | null, now = Date.now()): number {
  if (!dueAt) return 0;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return 0;
  const diff = t - now;
  if (diff <= 0) return 100;
  const HORIZON = 7 * 86400_000;
  const pct = 100 - (diff / HORIZON) * 100;
  return Math.max(6, Math.min(100, pct));
}
