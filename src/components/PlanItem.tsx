import { useState } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import type { Plan } from '../lib/types';
import { formatTime } from '../lib/date';

interface Props {
  plan: Plan;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Plan>) => void;
  onRemove: (id: string) => void;
}

export default function PlanItem({
  plan,
  selected,
  onToggleSelect,
  onToggle,
  onUpdate,
  onRemove,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [note, setNote] = useState(plan.note ?? '');

  const commit = () => {
    setEditing(false);
    const t = title.trim();
    if (!t) {
      setTitle(plan.title);
      return;
    }
    onUpdate(plan.id, { title: t, note: note.trim() || undefined });
  };

  const cancel = () => {
    setTitle(plan.title);
    setNote(plan.note ?? '');
    setEditing(false);
  };

  const handleRemove = async () => {
    let ok = false;
    try {
      ok = await confirm(`确定删除「${plan.title}」吗？此操作不可撤销。`, {
        title: '删除计划',
        kind: 'warning',
      });
    } catch {
      ok = window.confirm(`确定删除「${plan.title}」吗？`);
    }
    if (ok) onRemove(plan.id);
  };

  return (
    <li
      className={`plan-item ${plan.done ? 'done' : ''} ${
        selected ? 'selected' : ''
      }`}
    >
      <input
        type="checkbox"
        className="pick"
        checked={selected}
        onChange={() => onToggleSelect(plan.id)}
        title="选择用于复制"
      />
      {editing ? (
        // 整块统一判断失焦：在标题和备注之间切换焦点不会退出编辑
        <div
          className="edit-box"
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            commit();
          }}
        >
          <input
            className="edit-title"
            autoFocus
            value={title}
            placeholder="标题"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
          />
          <input
            className="edit-note"
            placeholder="备注（可选）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
          />
        </div>
      ) : (
        <div
          className="plan-text"
          onDoubleClick={() => setEditing(true)}
          title="双击编辑：可修改标题和备注，回车保存，Esc 取消"
        >
          <div className="plan-title">{plan.title}</div>
          {plan.note && <div className="plan-note">{plan.note}</div>}
          <div className="plan-meta">
            添加于 {formatTime(plan.createdAt)}
            {plan.done && plan.completedAt && (
              <span> · 完成于 {formatTime(plan.completedAt)}</span>
            )}
          </div>
        </div>
      )}
      <button
        className={`done-toggle ${plan.done ? 'on' : ''}`}
        title={plan.done ? '标记未完成' : '标记完成'}
        onClick={() => onToggle(plan.id)}
      >
        {plan.done ? '✓' : ''}
      </button>
      <button className="del" title="删除" onClick={handleRemove}>
        ✕
      </button>
    </li>
  );
}
