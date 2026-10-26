import { useEffect, useRef, useState } from 'react';
import {
  getMonthMatrix,
  parseDate,
  formatDate,
  todayStr,
  formatTime,
} from '../lib/date';
import {
  loadPresets,
  savePresets,
  applyPreset,
  uid,
  type DuePreset,
} from '../lib/duePresets';

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
  placeholder = '设置截止时间',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'tag' | 'cal'>('tag');

  const base = value ? new Date(value) : new Date();
  const [view, setView] = useState({ year: base.getFullYear(), month: base.getMonth() });
  const [draft, setDraft] = useState<string | null>(value); // 选中的日期 ISO（含时间）

  const [presets, setPresets] = useState<DuePreset[]>([]);
  const [managing, setManaging] = useState(false);
  const [form, setForm] = useState({ name: '', time: '18:00', days: 0 });

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

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
    setTab('tag');
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

  const apply = (p: DuePreset) => {
    onChange(applyPreset(p));
    setOpen(false);
  };

  const saveForm = () => {
    const name = form.name.trim();
    if (!name) return;
    const next = [
      ...presets,
      { id: uid(), name, time: form.time, days: Number(form.days) || 0 },
    ];
    setPresets(next);
    savePresets(next);
    setForm({ name: '', time: '18:00', days: 0 });
    setManaging(false);
  };

  const delPreset = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  };

  const stepMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const label = value ? `${value.slice(0, 10)} ${formatTime(value)}` : '';

  const tagSub = (p: DuePreset) =>
    `${p.days > 0 ? `${p.days}天后` : '每天'} ${p.time}`;

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
          <div className="dt-tabs">
            <button
              className={tab === 'tag' ? 'on' : ''}
              onClick={() => setTab('tag')}
            >
              快捷标签
            </button>
            <button
              className={tab === 'cal' ? 'on' : ''}
              onClick={() => setTab('cal')}
            >
              日历
            </button>
          </div>

          {tab === 'tag' && (
            <div className="dt-tags">
              {presets.length === 0 && (
                <div className="dt-tags-empty">还没有标签，点“添加标签”新建一个</div>
              )}
              <div className="dt-tag-list">
                {presets.map((p) => (
                  <div key={p.id} className="dt-tag">
                    <button
                      className="dt-tag-apply"
                      title={tagSub(p)}
                      onClick={() => apply(p)}
                    >
                      {p.name}
                      <span className="dt-tag-sub">{tagSub(p)}</span>
                    </button>
                    <button
                      className="dt-tag-del"
                      title="删除该标签"
                      onClick={() => delPreset(p.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {managing ? (
                <div className="dt-tag-form">
                  <input
                    type="text"
                    placeholder="标签名（如 下班前）"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                  <label className="dt-days">
                    几天后
                    <input
                      type="number"
                      min={0}
                      value={form.days}
                      onChange={(e) =>
                        setForm({ ...form, days: Number(e.target.value) })
                      }
                    />
                    <span>（0 = 每天/今天）</span>
                  </label>
                  <div className="dt-tag-form-actions">
                    <button
                      type="button"
                      className="dt-clear"
                      onClick={() => {
                        setManaging(false);
                        setForm({ name: '', time: '18:00', days: 0 });
                      }}
                    >
                      取消
                    </button>
                    <button type="button" className="dt-ok" onClick={saveForm}>
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <button className="dt-manage" onClick={() => setManaging(true)}>
                  + 添加标签
                </button>
              )}
            </div>
          )}

          {tab === 'cal' && (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
