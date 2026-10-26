import { useEffect, useRef, useState } from 'react';
import { loadPresets, applyPreset, type DuePreset } from '../lib/duePresets';

interface Props {
  onChange: (iso: string | null) => void;
  /** 任务所属日期（YYYY-MM-DD），标签时间会落在该日期上 */
  anchorDate?: string;
}

export default function LabelDropdown({ onChange, anchorDate }: Props) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<DuePreset[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setPresets(loadPresets());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    const onChanged = () => setPresets(loadPresets());
    window.addEventListener('duePresetsChanged', onChanged);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('duePresetsChanged', onChanged);
    };
  }, [open]);

  const apply = (p: DuePreset) => {
    onChange(applyPreset(p, anchorDate));
    setOpen(false);
  };

  const sub = (p: DuePreset) =>
    `${p.days > 0 ? `${p.days}天后` : '当天'} ${p.time}`;

  return (
    <div className="label-dd" ref={ref}>
      <button
        type="button"
        className="label-dd-trigger"
        onClick={() => setOpen((o) => !o)}
        title="用快捷标签快速设置截止时间"
      >
        ⏱ 标签▾
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
              className="label-dd-item"
              onClick={() => apply(p)}
              title={sub(p)}
            >
              <span className="label-dd-name">{p.name}</span>
              <span className="label-dd-sub">{sub(p)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
