import { useEffect, useRef, useState } from 'react';
import type { Plan } from '../lib/types';
import { getDayInfo } from '../lib/holidays';
import { parseDate, fromLocalInput } from '../lib/date';
import PlanItem from './PlanItem';

interface Props {
  date: string;
  plans: Plan[];
  onAdd: (title: string, note?: string, dueAt?: string | null) => void;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Plan>) => void;
  onRemove: (id: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function DayPanel({
  date,
  plans,
  onAdd,
  onToggle,
  onUpdate,
  onRemove,
}: Props) {
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [copied, setCopied] = useState(false);
  // 复制选择：选中的计划才会出现在“复制选中”的导出文本里
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const d = parseDate(date);
  const weekday = WEEKDAYS[d.getDay()];
  const doneCount = plans.filter((p) => p.done).length;
  const dayInfo = getDayInfo(date);

  // 新添加的计划默认进入选择集合
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of plans) next.add(p.id);
      return next;
    });
  }, [plans]);

  // 打开应用 / 切换日期后自动把焦点放到添加输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, [date]);

  const selectedCount = plans.filter((p) => selected.has(p.id)).length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyText = async (value: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // 回退到 execCommand
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopy = async () => {
    const toCopy = plans.filter((p) => selected.has(p.id));
    if (toCopy.length === 0) return;
    const body = toCopy
      .map((p) => `${p.title}${p.note ? `（${p.note}）` : ''}`)
      .join('\n');
    const ok = await copyText(body);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleAdd = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t, undefined, fromLocalInput(due));
    setText('');
    setDue('');
  };

  return (
    <section className="day-panel">
      <header className="day-header">
        <div>
          <div className="day-title">
            {d.getMonth() + 1}月{d.getDate()}日
          </div>
          <div className="day-sub">
            星期{weekday}
            {dayInfo.kind === 'holiday' && (
              <span className="chip rest">{dayInfo.name} · 放假</span>
            )}
            {dayInfo.kind === 'makeup' && (
              <span className="chip work">{dayInfo.name} · 调休上班</span>
            )}
            {dayInfo.kind === 'weekend' && (
              <span className="chip soft">周末</span>
            )}
            {dayInfo.festival && (
              <span className="chip fest">{dayInfo.festival}</span>
            )}
          </div>
        </div>
        <div className="day-actions">
          <div className="day-progress">
            {plans.length ? `${doneCount}/${plans.length} 已完成` : '暂无计划'}
          </div>
          <button
            className="copy-btn"
            onClick={handleCopy}
            disabled={selectedCount === 0}
          >
            {copied ? '已复制' : `复制选中${selectedCount ? `(${selectedCount})` : ''}`}
          </button>
        </div>
      </header>

      <div className="add-row">
        <input
          ref={inputRef}
          value={text}
          placeholder="添加今日计划，回车保存"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button onClick={handleAdd}>添加</button>
      </div>
      <div className="add-due">
        <span>截止时间</span>
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        {due && (
          <button className="due-clear" onClick={() => setDue('')}>
            清除
          </button>
        )}
      </div>

      <ul className="plan-list">
        {plans.length === 0 && (
          <li className="empty">这一天还没有计划，写下第一件想做的事吧。</li>
        )}
        {plans.map((p) => (
          <PlanItem
            key={p.id}
            plan={p}
            selected={selected.has(p.id)}
            onToggleSelect={toggleSelect}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </section>
  );
}
