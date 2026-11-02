import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Plan } from '../lib/types';
import {
  todayStr,
  dueStatus,
  dueBarWidth,
  formatTime,
} from '../lib/date';

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
  if (date === today) return { tag: '今天', past: false };
  const d = new Date(date + 'T00:00:00');
  return { tag: `周${WEEKDAYS[d.getDay()]}`, past: date < today };
}

// 大小写不敏感地把匹配片段用 <mark> 高亮
function Highlight({ text, q }: { text: string; q: string }) {
  const kw = q.trim().toLowerCase();
  if (!kw) return <>{text}</>;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i <= text.length) {
    const idx = lower.indexOf(kw, i);
    if (idx === -1) {
      if (i < text.length) parts.push(<span key={key++}>{text.slice(i)}</span>);
      break;
    }
    if (idx > i) parts.push(<span key={key++}>{text.slice(i, idx)}</span>);
    parts.push(<mark key={key++}>{text.slice(idx, idx + kw.length)}</mark>);
    i = idx + kw.length;
  }
  return <>{parts}</>;
}

export default function SearchDialog({
  open,
  onClose,
  plans,
  onToggle,
  onJump,
}: Props) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const today = todayStr();

  // 每次打开：清空搜索词并聚焦输入框
  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const groups = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const matched = plans.filter((p) => {
      if (!kw) return true;
      if (p.title.toLowerCase().includes(kw)) return true;
      if (p.note && p.note.toLowerCase().includes(kw)) return true;
      if (p.date.includes(kw)) return true; // 也支持按日期片段搜（如 2026-11）
      return false;
    });

    const m = new Map<string, Plan[]>();
    for (const p of matched) {
      const arr = m.get(p.date) ?? [];
      arr.push(p);
      m.set(p.date, arr);
    }

    const entries = [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
    // 组内：未完成在前、已完成在后；未完成的按紧急度降序
    for (const [, ps] of entries) {
      ps.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const wa = dueStatus(a.dueAt).weight;
        const wb = dueStatus(b.dueAt).weight;
        if (wb !== wa) return wb - wa;
        return (a.dueAt ?? '~').localeCompare(b.dueAt ?? '~');
      });
    }
    return entries;
  }, [plans, q]);

  if (!open) return null;

  const total = groups.reduce((n, [, ps]) => n + ps.length, 0);

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal todo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">搜索任务</div>
          <button className="del" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        <div className="search-box">
          <input
            ref={inputRef}
            className="search-input"
            value={q}
            placeholder="搜标题或备注，也支持按日期（如 2026-11）"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const first = groups[0]?.[1][0];
                if (first) onJump(first.date);
              }
            }}
          />
          <div className="search-count">
            {q.trim() ? `匹配 ${total} 项` : `共 ${total} 项`}
          </div>
        </div>

        <div className="modal-body todo-body">
          {total === 0 && (
            <div className="todo-empty">
              {q.trim() ? '没有匹配的任务 🔍' : '还没有任何任务'}
            </div>
          )}

          {groups.map(([date, ps]) => {
            const info = dayInfo(date, today);
            return (
              <div key={date} className="todo-group">
                <button
                  className={`todo-date ${info.past ? 'past' : 'future'}`}
                  title="在日历中查看这一天"
                  onClick={() => onJump(date)}
                >
                  {date} {info.tag}
                </button>
                <ul className="todo-list">
                  {ps.map((p) => {
                    const st = dueStatus(p.dueAt);
                    const w = dueBarWidth(p.dueAt);
                    return (
                      <li
                        key={p.id}
                        className={`todo-item lv-${st.level} ${
                          p.done ? 'done' : ''
                        }`}
                      >
                        {st.level !== 'none' && !p.done && (
                          <span
                            className={`todo-bar lv-${st.level}`}
                            style={{ width: `${w}%` }}
                          />
                        )}
                        <button
                          className={`todo-check ${p.done ? 'on' : ''}`}
                          title={p.done ? '标记未完成' : '标记完成'}
                          onClick={() => onToggle(p.id)}
                        />
                        <span className="todo-text">
                          <span className="todo-title">
                            <Highlight text={p.title} q={q} />
                          </span>
                          {p.note && (
                            <em>
                              （<Highlight text={p.note} q={q} />）
                            </em>
                          )}
                          {p.done && p.completedAt && (
                            <span className="todo-due">
                              完成于 {formatTime(p.completedAt)}
                            </span>
                          )}
                          {!p.done && st.level !== 'none' && (
                            <span className={`todo-due lv-${st.level}`}>
                              截止 {formatTime(p.dueAt)} · {st.text}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
