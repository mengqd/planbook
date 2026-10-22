import { useMemo } from 'react';
import type { Plan } from '../lib/types';
import { todayStr } from '../lib/date';

interface Props {
  open: boolean;
  onClose: () => void;
  plans: Plan[];
  onToggle: (id: string) => void;
  /** 点击某个日期：跳转到日历对应日期 */
  onJump: (date: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function dayInfo(date: string, today: string) {
  if (date === today) return { label: date, tag: '今天' };
  const d = new Date(date + 'T00:00:00');
  return { label: date, tag: `周${WEEKDAYS[d.getDay()]}` };
}

export default function UnfinishedDialog({
  open,
  onClose,
  plans,
  onToggle,
  onJump,
}: Props) {
  const today = todayStr();

  // 未完成事项按日期升序分组（最早的排最前，逾期的一眼能看到）
  const groups = useMemo(() => {
    const m = new Map<string, Plan[]>();
    for (const p of plans) {
      if (p.done) continue;
      const arr = m.get(p.date) ?? [];
      arr.push(p);
      m.set(p.date, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [plans]);

  if (!open) return null;

  const total = groups.reduce((n, [, ps]) => n + ps.length, 0);

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal todo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">未完成事项（{total}）</div>
          <button className="del" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        <div className="modal-body todo-body">
          {total === 0 && (
            <div className="todo-empty">太棒了，没有未完成的事项 🎉</div>
          )}

          {groups.map(([date, ps]) => {
            const info = dayInfo(date, today);
            return (
              <div key={date} className="todo-group">
                <button
                  className="todo-date"
                  title="在日历中查看这一天"
                  onClick={() => onJump(date)}
                >
                  {info.label} {info.tag}
                </button>
                <ul className="todo-list">
                  {ps.map((p) => (
                    <li key={p.id} className="todo-item">
                      <button
                        className="todo-check"
                        title="标记完成"
                        onClick={() => onToggle(p.id)}
                      />
                      <span className="todo-text">
                        {p.title}
                        {p.note ? <em>（{p.note}）</em> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
