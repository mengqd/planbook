import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { Attachment, Plan } from '../lib/types';
import { getDayInfo } from '../lib/holidays';
import { parseDate } from '../lib/date';
import { inspectPaths, type PathInfo } from '../lib/attachments';
import PlanItem from './PlanItem';
import DateTimePicker from './DateTimePicker';
import LabelDropdown from './LabelDropdown';
import NewTaskFromFilesDialog from './NewTaskFromFilesDialog';

interface Props {
  date: string;
  plans: Plan[];
  onAdd: (
    title: string,
    note?: string,
    dueAt?: string | null,
    attachments?: Attachment[],
  ) => void;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Plan>) => void;
  onAttach: (id: string, added: Attachment[]) => void;
  onRemove: (id: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

interface Hit {
  planId: string | null;
  inPanel: boolean;
}

/** Tauri 的拖拽坐标是物理像素，需换算成 CSS 像素再定位落点元素 */
function hitTest(x: number, y: number): Hit {
  const dpr = window.devicePixelRatio || 1;
  const el = document.elementFromPoint(x / dpr, y / dpr);
  if (!el) return { planId: null, inPanel: false };
  return {
    planId: el.closest<HTMLElement>('[data-plan-id]')?.dataset.planId ?? null,
    inPanel: !!el.closest('.day-panel'),
  };
}

export default function DayPanel({
  date,
  plans,
  onAdd,
  onToggle,
  onUpdate,
  onAttach,
  onRemove,
}: Props) {
  const [text, setText] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // 复制选择：选中的计划才会出现在“复制选中”的导出文本里
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [blankActive, setBlankActive] = useState(false);
  const [newTaskInfos, setNewTaskInfos] = useState<PathInfo[] | null>(null);
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
    onAdd(t, undefined, due);
    setText('');
    setDue(null);
  };

  const handleDrop = useCallback(
    async (paths: string[], pos: { x: number; y: number }) => {
      setDropTargetId(null);
      setBlankActive(false);
      if (paths.length === 0) return;
      const infos = await inspectPaths(paths);
      const valid = infos.filter((i) => i.exists);
      if (valid.length === 0) return;
      const added: Attachment[] = valid.map((i) => ({
        path: i.path,
        name: i.name,
        kind: i.kind,
      }));
      const hit = hitTest(pos.x, pos.y);
      if (hit.planId) {
        onAttach(hit.planId, added);
        return;
      }
      // 落在面板空白处：弹窗让用户决定标题，再新建任务
      if (hit.inPanel) setNewTaskInfos(valid);
    },
    [onAttach],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    try {
      getCurrentWebview()
        .onDragDropEvent((event) => {
          const p = event.payload;
          if (p.type === 'leave') {
            setDropTargetId(null);
            setBlankActive(false);
            return;
          }
          if (p.type === 'drop') {
            void handleDrop(p.paths, p.position);
            return;
          }
          const hit = hitTest(p.position.x, p.position.y);
          setDropTargetId(hit.planId);
          setBlankActive(hit.inPanel && !hit.planId);
        })
        .then((fn) => {
          if (active) unlisten = fn;
          else fn();
        })
        .catch(() => {});
    } catch {
      // 纯浏览器预览时没有 Tauri 拖拽事件，忽略
    }
    return () => {
      active = false;
      unlisten?.();
    };
  }, [handleDrop]);

  const confirmNewTask = (title: string) => {
    if (!newTaskInfos) return;
    const attachments: Attachment[] = newTaskInfos.map((i) => ({
      path: i.path,
      name: i.name,
      kind: i.kind,
    }));
    onAdd(title, undefined, null, attachments);
    setNewTaskInfos(null);
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
        <DateTimePicker value={due} onChange={setDue} placeholder="设置截止时间" />
        <LabelDropdown value={due} anchorDate={date} onChange={setDue} />
      </div>

      <ul className={`plan-list${blankActive ? ' drop-blank' : ''}`}>
        {plans.length === 0 && (
          <li className="empty">这一天还没有计划，写下第一件想做的事吧。</li>
        )}
        {plans.map((p) => (
          <PlanItem
            key={p.id}
            plan={p}
            selected={selected.has(p.id)}
            dropTarget={dropTargetId === p.id}
            onToggleSelect={toggleSelect}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </ul>

      {newTaskInfos && (
        <NewTaskFromFilesDialog
          infos={newTaskInfos}
          onCancel={() => setNewTaskInfos(null)}
          onConfirm={confirmNewTask}
        />
      )}
    </section>
  );
}
