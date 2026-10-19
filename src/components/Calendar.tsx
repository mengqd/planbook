import { useEffect, useState } from 'react';
import {
  WEEKDAY_LABELS,
  getMonthMatrix,
  addMonths,
  parseDate,
  todayStr,
  type DateStr,
} from '../lib/date';
import type { Plan } from '../lib/types';
import { getCellBadge, getDayInfo, getTooltip } from '../lib/holidays';

interface Props {
  selectedDate: DateStr;
  plansByDate: Map<string, Plan[]>;
  onSelect: (d: DateStr) => void;
}

export default function Calendar({
  selectedDate,
  plansByDate,
  onSelect,
}: Props) {
  const today = todayStr();
  const [view, setView] = useState(() => {
    const d = parseDate(selectedDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // 外部切换选中日期（如“今天”按钮）时，视图跟随到对应月份
  useEffect(() => {
    const d = parseDate(selectedDate);
    setView((v) =>
      v.year === d.getFullYear() && v.month === d.getMonth()
        ? v
        : { year: d.getFullYear(), month: d.getMonth() },
    );
  }, [selectedDate]);

  const matrix = getMonthMatrix(view.year, view.month);
  const monthLabel = `${view.year}年${view.month + 1}月`;

  const goPrev = () =>
    setView((v) => addMonths(v.year, v.month, -1));
  const goNext = () =>
    setView((v) => addMonths(v.year, v.month, 1));
  const goToday = () => {
    const d = parseDate(today);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    onSelect(today);
  };

  return (
    <section className="calendar">
      <header className="cal-header">
        <button className="nav" onClick={goPrev} aria-label="上个月">
          ‹
        </button>
        <div className="cal-title">{monthLabel}</div>
        <button className="nav" onClick={goNext} aria-label="下个月">
          ›
        </button>
        <button className="today-btn" onClick={goToday}>
          今天
        </button>
      </header>

      <div className="weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="grid">
        {matrix.flat().map((cell) => {
          const items = plansByDate.get(cell.dateStr) ?? [];
          const done = items.filter((p) => p.done).length;
          const info = getDayInfo(cell.dateStr);
          const badge = getCellBadge(info);
          const cls = [
            'cell',
            cell.inMonth ? '' : 'out',
            cell.dateStr === today ? 'today' : '',
            cell.dateStr === selectedDate ? 'selected' : '',
            info.kind === 'holiday' ? 'hol' : '',
            info.kind === 'makeup' ? 'work' : '',
            info.kind === 'weekend' ? 'weekend' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={cell.dateStr}
              className={cls}
              onClick={() => onSelect(cell.dateStr)}
              title={getTooltip(cell.dateStr, info)}
            >
              {badge && (
                <span
                  className={`cell-tag ${badge === '休' ? 'rest' : 'work'}`}
                >
                  {badge}
                </span>
              )}
              <span className="day-num">{cell.date.getDate()}</span>
              {items.length > 0 && (
                <span className="badge">
                  {done}/{items.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
