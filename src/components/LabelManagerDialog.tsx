import { useState } from 'react';
import { loadPresets, savePresets, uid, type DuePreset } from '../lib/duePresets';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LabelManagerDialog({ open, onClose }: Props) {
  const [presets, setPresets] = useState<DuePreset[]>(() => loadPresets());
  const [editing, setEditing] = useState<DuePreset | null>(null);
  const [form, setForm] = useState({ name: '', time: '18:00', days: 0 });

  if (!open) return null;

  const startAdd = () => {
    setEditing({ id: '', name: '', time: '18:00', days: 0 });
    setForm({ name: '', time: '18:00', days: 0 });
  };

  const startEdit = (p: DuePreset) => {
    setEditing(p);
    setForm({ name: p.name, time: p.time, days: p.days });
  };

  const cancel = () => setEditing(null);

  const save = () => {
    const name = form.name.trim();
    if (!name) return;
    const days = Number(form.days) || 0;
    let next: DuePreset[];
    if (editing && editing.id) {
      next = presets.map((p) =>
        p.id === editing.id ? { ...p, name, time: form.time, days } : p,
      );
    } else {
      next = [...presets, { id: uid(), name, time: form.time, days }];
    }
    setPresets(next);
    savePresets(next);
    setEditing(null);
  };

  const del = (id: string) => {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  };

  const sub = (p: DuePreset) =>
    `${p.days > 0 ? `${p.days}天后` : '每天'} ${p.time}`;

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal label-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">时间标签</div>
          <button className="del" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="source-note">
            标签用于快速设置截止时间：在日期选择器里点一下标签，就直接填入对应日期与时间，不用再手动选。
          </div>

          <ul className="label-list">
            {presets.map((p) => (
              <li key={p.id} className="label-item">
                <div className="label-info">
                  <div className="label-name">{p.name}</div>
                  <div className="label-sub">{sub(p)}</div>
                </div>
                <div className="label-ops">
                  <button className="link" onClick={() => startEdit(p)}>
                    编辑
                  </button>
                  <button className="link danger" onClick={() => del(p.id)}>
                    删除
                  </button>
                </div>
              </li>
            ))}
            {presets.length === 0 && (
              <li className="label-empty">还没有标签，点下方“添加标签”新建</li>
            )}
          </ul>

          {editing && (
            <div className="label-form">
              <div className="field-row">
                <input
                  type="text"
                  placeholder="标签名（如 下班前）"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>
              <div className="field-row">
                <label className="field-inline">
                  时间
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) =>
                      setForm({ ...form, time: e.target.value })
                    }
                  />
                </label>
                <label className="field-inline">
                  几天后
                  <input
                    type="number"
                    min={0}
                    value={form.days}
                    onChange={(e) =>
                      setForm({ ...form, days: Number(e.target.value) })
                    }
                  />
                  <span className="hint">（0 = 每天/今天）</span>
                </label>
              </div>
              <div className="label-form-actions">
                <button className="link" onClick={cancel}>
                  取消
                </button>
                <button
                  className="primary-btn"
                  onClick={save}
                  disabled={!form.name.trim()}
                >
                  保存
                </button>
              </div>
            </div>
          )}

          {!editing && (
            <button className="primary-btn block" onClick={startAdd}>
              + 添加标签
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
