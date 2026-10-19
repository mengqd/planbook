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
