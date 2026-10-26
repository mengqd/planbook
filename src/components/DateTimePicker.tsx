import { useEffect, useRef, useState } from 'react';
import {
  getMonthMatrix,
  parseDate,
  formatDate,
  todayStr,
  formatTime,
} from '../lib/date';

interface Props {
  value: string | null; // ISO 或 null
  onChange: (iso: string | null) => void;
  placeholder?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const WK = ['一', '二', '三', '四', '五', '六', '日'];

export default function DateTimePicker({
  value,
  onChange,
  placeholder = '选择日期时间',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const base = value ? new Date(value) : new Date();
  const [view, setView] = useState({ year: base.getFullYear(), month: base.getMonth() });
  const [draft, setDraft] = useState<string | null>(value); // 选中的日期 ISO（含时间）

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const openPicker = () => {
    const b = value ? new Date(value) : new Date();
    setView({ year: b.getFullYear(), month: b.getMonth() });
    setDraft(value);
    setOpen(true);
  };

  const matrix = getMonthMatrix(view.year, view.month);
  const today = todayStr();

  const pickDay = (dstr: string) => {
    const d = parseDate(dstr);
    const h = draft ? new Date(draft).getHours() : 0;
    const m = draft ? new Date(draft).getMinutes() : 0;
    setDraft(
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString(),
    );
  };

  const setTime = (h: number, m: number) => {
    const cur = draft ? new Date(draft) : new Date();
    setDraft(
      new Date(
        cur.getFullYear(),
        cur.getMonth(),
        cur.getDate(),
        h,
        m,
      ).toISOString(),
    );
  };

  const confirm = () => {
    onChange(draft);
    setOpen(false);
  };

  const clear = () => {
    setDraft(null);
    onChange(null);
    setOpen(false);
  };

  const label = value ? `${value.slice(0, 10)} ${formatTime(value)}` : '';

  const stepMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="dt-picker" ref={ref}>
      <button
        type="button"
        className={`dt-trigger ${value ? '' : 'empty'}`}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        {label || <span className="dt-ph">{placeholder}</span>}
      </button>

      {open && (
        <div className="dt-pop">
          <div className="dt-cal-head">
            <button type="button" onClick={() => stepMonth(-1)}>
              ‹
            </button>
            <span>
              {view.year}年{view.month + 1}月
            </span>
            <button type="button" onClick={() => stepMonth(1)}>
              ›
            </button>
          </div>

          <div className="dt-cal-grid">
            {WK.map((w) => (
              <span key={w} className="dt-wk">
                {w}
              </span>
            ))}
            {matrix.flat().map((c) => (
              <button
                key={c.dateStr}
                type="button"
                className={[
                  'dt-day',
                  c.inMonth ? '' : 'out',
                  draft && c.dateStr === formatDate(new Date(draft)) ? 'sel' : '',
                  c.dateStr === today ? 'today' : '',
                ].join(' ')}
                onClick={() => pickDay(c.dateStr)}
              >
                {c.date.getDate()}
              </button>
            ))}
          </div>

          <div className="dt-time">
            <select
              value={draft ? new Date(draft).getHours() : 0}
              onChange={(e) =>
                setTime(Number(e.target.value), draft ? new Date(draft).getMinutes() : 0)
              }
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {pad(i)}
                </option>
              ))}
            </select>
            <span className="dt-colon">:</span>
            <select
              value={draft ? new Date(draft).getMinutes() : 0}
              onChange={(e) =>
                setTime(draft ? new Date(draft).getHours() : 0, Number(e.target.value))
              }
            >
              {Array.from({ length: 60 }, (_, i) => (
                <option key={i} value={i}>
                  {pad(i)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="dt-now"
              onClick={() => setDraft(new Date().toISOString())}
            >
              现在
            </button>
          </div>

          <div className="dt-actions">
            <button type="button" className="dt-clear" onClick={clear}>
              清除
            </button>
            <button type="button" className="dt-ok" onClick={confirm}>
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
