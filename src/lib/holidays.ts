import { OFFICIAL_DAYS_2026, type OfficialDay } from './holidayData';
import { loadHolidayOverride, saveHolidayOverride } from './holidayStorage';
import { parseDate, type DateStr } from './date';

/** 内置（打包进 App）的官方安排：新增年份时在 holidayData.ts 里加 */
const officialDays: OfficialDay[] = [...OFFICIAL_DAYS_2026];

/** 数据来源：NateScarlet/holiday-cn（同步国务院办公厅放假安排的 JSON） */
export const HOLIDAY_SOURCE_URL = (year: number) =>
  `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`;

/** 官方发布页，可在浏览器打开看原文 */
export const HOLIDAY_OFFICIAL_SITE = 'https://www.gov.cn/';

const baseMap = new Map<string, OfficialDay>();
for (const d of officialDays) baseMap.set(d.date, d);

/** 用户在 App 内更新过的数据，优先级高于内置数据 */
let overrideMap = new Map<string, OfficialDay>();
let overrideDays: OfficialDay[] = [];

export function getOverrideDays(): OfficialDay[] {
  return overrideDays;
}

function applyOverride(days: OfficialDay[]) {
  overrideDays = days;
  overrideMap = new Map();
  for (const d of days) overrideMap.set(d.date, d);
}

/** 按年份合并：新数据覆盖同年的旧数据，其他年份保留 */
export function mergeByYear(
  existing: OfficialDay[],
  incoming: OfficialDay[],
): OfficialDay[] {
  const years = new Set(incoming.map((d) => d.date.slice(0, 4)));
  const kept = existing.filter((d) => !years.has(d.date.slice(0, 4)));
  return [...kept, ...incoming].sort((a, b) => a.date.localeCompare(b.date));
}

/** 启动时调用，加载用户更新过的节假日数据 */
export async function initHolidays(): Promise<void> {
  const days = await loadHolidayOverride();
  applyOverride(days);
}

/** 当前已有数据的年份列表（内置 + 用户更新） */
export function getHolidayYears(): string[] {
  const years = new Set<string>();
  for (const d of overrideDays) years.add(d.date.slice(0, 4));
  for (const d of officialDays) years.add(d.date.slice(0, 4));
  return [...years].sort();
}

/** 联网拉取某一年的官方放假 / 调休数据 */
export async function fetchOfficialDays(year: number): Promise<OfficialDay[]> {
  const res = await fetch(HOLIDAY_SOURCE_URL(year));
  if (!res.ok) throw new Error(`网络请求失败（HTTP ${res.status}）`);
  const data = (await res.json()) as { days?: unknown };
  if (!Array.isArray(data?.days)) throw new Error('返回数据格式不正确');
  if (data.days.length === 0) {
    throw new Error('该年份暂无数据，官方可能还没公布明年的安排');
  }
  const list = data.days as Array<Partial<OfficialDay>>;
  return list
    .filter((d) => typeof d?.date === 'string' && typeof d?.name === 'string')
    .map((d) => ({
      name: String(d.name),
      date: String(d.date),
      isOffDay: Boolean(d.isOffDay),
    }));
}

/** 从粘贴的文本解析节假日数据（支持原始来源 JSON 或 {"days": [...]}） */
export function parseDaysText(text: string): OfficialDay[] {
  const data = JSON.parse(text) as { days?: unknown } | unknown;
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as { days?: unknown })?.days)
      ? ((data as { days: unknown[] }).days)
      : null;
  if (!arr) throw new Error('找不到 days 数组，请确认复制的是完整 JSON');
  const list = arr as Array<Partial<OfficialDay>>;
  const days = list
    .filter((d) => typeof d?.date === 'string' && typeof d?.name === 'string')
    .map((d) => ({
      name: String(d.name),
      date: String(d.date),
      isOffDay: Boolean(d.isOffDay),
    }));
  if (days.length === 0) throw new Error('没有解析出有效数据');
  return days;
}

/** 公历固定日期的民间/纪念日节日（只做提示，不影响休/班） */
const FIXED_FESTIVALS: Record<string, string> = {
  '02-14': '情人节',
  '03-08': '妇女节',
  '03-12': '植树节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '12-24': '平安夜',
  '12-25': '圣诞节',
};

export type DayKind = 'holiday' | 'makeup' | 'weekend' | 'normal';

export interface DayInfo {
  kind: DayKind;
  /** 法定节假日名称（kind 为 holiday / makeup 时存在） */
  name?: string;
  /** 是否休息 */
  isRest: boolean;
  /** 民间/纪念日节日名 */
  festival?: string;
}

/** 查询某一天的放假 / 调休 / 周末 / 节日信息 */
export function getDayInfo(dateStr: DateStr): DayInfo {
  const off = overrideMap.get(dateStr) ?? baseMap.get(dateStr);
  const weekday = parseDate(dateStr).getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const festival = FIXED_FESTIVALS[dateStr.slice(5)];

  if (off) {
    return {
      kind: off.isOffDay ? 'holiday' : 'makeup',
      name: off.name,
      isRest: off.isOffDay,
      festival,
    };
  }

  return {
    kind: isWeekend ? 'weekend' : 'normal',
    isRest: isWeekend,
    festival,
  };
}

/** 日历格子上显示的角标：休 / 班，普通周末与工作日不显示 */
export function getCellBadge(info: DayInfo): string | null {
  if (info.kind === 'holiday') return '休';
  if (info.kind === 'makeup') return '班';
  return null;
}

/** 鼠标悬停时的完整说明 */
export function getTooltip(dateStr: DateStr, info: DayInfo): string {
  const parts: string[] = [];
  if (info.kind === 'holiday') parts.push(`${info.name}（放假）`);
  if (info.kind === 'makeup') parts.push(`${info.name}调休上班`);
  if (info.kind === 'weekend') parts.push('周末');
  if (info.festival) parts.push(info.festival);
  return parts.length ? `${dateStr} ${parts.join(' · ')}` : dateStr;
}

/** 应用新数据（合并 + 落盘），完成后立即生效 */
export async function applyOfficialDays(
  incoming: OfficialDay[],
): Promise<{ count: number; path: string | null }> {
  const merged = mergeByYear(overrideDays, incoming);
  applyOverride(merged);
  const path = await saveHolidayOverride(merged);
  return { count: merged.length, path };
}
