import { useEffect, useRef, useState } from 'react';
import { loadPresets, applyPreset, type DuePreset } from '../lib/duePresets';

interface Props {
  value: string | null;
  onChange: (iso: string | null) => void;
  /** 任务所属日期（YYYY-MM-DD），标签时间会落在该日期上 */
  anchorDate?: string;
}

export default function LabelDropdown({ value, onChange, anchorDate }: Props) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<DuePreset[]>([]);
  const [applied, setApplied] = useState<DuePreset | null>(null);
  const appliedIso = useRef<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setPresets(loadPresets());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onChanged = () => setPresets(loadPresets());
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('duePresetsChanged', onChanged);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('duePresetsChanged', onChanged);
    };
  }, [open]);

  // 外部改了截止时间（日历选择 / 清除）时，清除已选标签标记，避免误导
  useEffect(() => {
    if (value !== appliedIso.current) setApplied(null);
  }, [value]);

  const apply = (p: DuePreset) => {
    const iso = applyPreset(p, anchorDate);
    appliedIso.current = iso;
    setApplied(p);
    onChange(iso);
    setOpen(false);
  };

  const sub = (p: DuePreset) =>
    `${p.days > 0 ? `${p.days}天后` : '当天'} ${p.time}`;

  return (
    <div className="label-dd" ref={ref}>
      <button
        type="button"
        className={`label-dd-trigger${applied ? ' applied' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={applied ? `已选：${applied.name}` : '用快捷标签快速设置截止时间'}
      >
        ⏱ {applied ? applied.name : '标签'}▾
      </button>

      {open && (
        <div className="label-dd-pop">
          {presets.length === 0 && (
            <div className="label-dd-empty">
              暂无标签，可在顶栏“时间标签”里添加
            </div>
          )}
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`label-dd-item${applied?.id === p.id ? ' on' : ''}`}
              onClick={() => apply(p)}
              title={sub(p)}
            >
              <span className="label-dd-name">{p.name}</span>
              <span className="label-dd-sub">{sub(p)}</span>
              {applied?.id === p.id && <span className="label-dd-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
