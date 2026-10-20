import { useCallback, useEffect, useRef, useState } from 'react';
import type { Plan } from '../lib/types';
import { loadPlans, savePlans } from '../lib/storage';
import { listen } from '@tauri-apps/api/event';
import {
  closeStickyWindow,
  currentWindowLabel,
  setWindowSize,
  startWindowDrag,
  stickyDebug,
} from '../lib/window';

/** 边缘判定宽度（px） */
const RESIZE_MARGIN = 10;
const MIN_W = 200;
const MIN_H = 90;
import { todayStr } from '../lib/date';

const LS_THEME = 'planbook:sticky-theme';

/** 大乐透：前区 5 个（1–35），后区 2 个（1–12），号码升序、两位补零 */
function rollLotto(): { front: string[]; back: string[] } {
  const pick = (max: number, count: number): number[] => {
    const pool = Array.from({ length: max }, (_, i) => i + 1);
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out.sort((a, b) => a - b);
  };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    front: pick(35, 5).map(pad),
    back: pick(12, 2).map(pad),
  };
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function StickyOverlay() {
  const today = todayStr();
  const [all, setAll] = useState<Plan[]>([]);
  const [text, setText] = useState('');
  const [light, setLight] = useState(
    () => localStorage.getItem(LS_THEME) === 'light',
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [lotto, setLotto] = useState(rollLotto);

  const refresh = useCallback(async () => {
    try {
      const data = await loadPlans();
      setAll(data);
    } catch (e) {
      console.warn('[planbook] 便签读取失败', e);
    }
  }, []);

  // 每 3 秒同步一次，主窗口的改动会自动出现在这里
  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    inputRef.current?.focus();
    stickyDebug('sticky mounted (便签界面已渲染)');
  }, []);

  // 主窗口改了数据时立即同步（除轮询外的即时通道）
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const ready = listen<string>('planbook:plans-changed', (e) => {
      if (e.payload === currentWindowLabel()) return; // 自己写的，忽略
      void refresh();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      void ready.then(() => unlisten?.());
    };
  }, [refresh]);

  // Esc 关闭便签，避免无处关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const todayPlans = all.filter((p) => p.date === today);
  const doneCount = todayPlans.filter((p) => p.done).length;

  const persist = async (next: Plan[]) => {
    setAll(next);
    try {
      await savePlans(next);
    } catch (e) {
      console.warn('[planbook] 便签保存失败', e);
    }
    await refresh();
  };

  const addPlan = async () => {
    const t = text.trim();
    if (!t) return;
    const now = new Date().toISOString();
    const plan: Plan = {
      id: uid(),
      date: today,
      title: t,
      done: false,
      createdAt: now,
      updatedAt: now,
    };
    setText('');
    await persist([...all, plan]);
    inputRef.current?.focus();
  };

  const togglePlan = async (id: string) => {
    const now = new Date().toISOString();
    const next = all.map((p) =>
      p.id === id
        ? {
            ...p,
            done: !p.done,
            completedAt: !p.done ? now : null,
            updatedAt: now,
          }
        : p,
    );
    await persist(next);
  };

  const removePlan = async (id: string) => {
    await persist(all.filter((p) => p.id !== id));
  };

  const toggleTheme = () => {
    const v = !light;
    setLight(v);
    localStorage.setItem(LS_THEME, v ? 'light' : 'dark');
  };

  // 自己记录拖动增量来改窗口大小，不依赖原生边缘拖动
  const beginResize = (dir: 'East' | 'South' | 'SouthEast', startX: number, startY: number) => {
    const baseW = window.innerWidth;
    const baseH = window.innerHeight;
    stickyDebug(
      `resize begin dir=${dir} from=${baseW}x${baseH} pointer=${Math.round(startX)},${Math.round(startY)}`,
    );
    let lastW = baseW;
    let lastH = baseH;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let nw = dir.includes('East') ? baseW + dx : baseW;
      let nh = dir.includes('South') ? baseH + dy : baseH;
      nw = Math.max(MIN_W, Math.round(nw));
      nh = Math.max(MIN_H, Math.round(nh));
      if (nw === lastW && nh === lastH) return;
      lastW = nw;
      lastH = nh;
      void setWindowSize(nw, nh);
    };

    const finish = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', finish);
      window.removeEventListener('blur', finish);
      stickyDebug(
        `resize end size=${window.innerWidth}x${window.innerHeight}`,
      );
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', finish);
    window.addEventListener('blur', finish);
  };

  /**
   * 统一的指针路由：按坐标判断是「移动」还是「缩放」，
   * 避免多个处理器互相干扰导致的时灵时不灵。
   */
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('input')) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const nearBottom = e.clientY >= h - RESIZE_MARGIN;
    const nearRight = e.clientX >= w - RESIZE_MARGIN;

    let dir: 'East' | 'South' | 'SouthEast' | null = null;
    if (nearRight && nearBottom) dir = 'SouthEast';
    else if (nearRight) dir = 'East';
    else if (nearBottom) dir = 'South';

    stickyDebug(
      `pointer at=${Math.round(e.clientX)},${Math.round(e.clientY)} win=${w}x${h} -> ${
        dir ? 'resize ' + dir : 'move'
      }`,
    );

    if (!dir) {
      void startWindowDrag();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    beginResize(dir, e.clientX, e.clientY);
  };

  const close = async () => {
    const ok = await closeStickyWindow();
    if (!ok) {
      alert(
        '关闭便签失败（已记录到 sticky-debug.log）。\n' +
          '可以改用主窗口顶栏的「关闭便签」按钮关闭。',
      );
    }
  };

  return (
    <div
      className={`stick-root ${light ? 'light' : 'dark'}`}
      onMouseDown={onMouseDown}
    >
      <div className="stick-lotto">
        <span className="lotto-label">大乐透</span>
        {lotto.front.map((n) => (
          <span key={`f-${n}`} className="ball ball-front">
            {n}
          </span>
        ))}
        <span className="lotto-plus">+</span>
        {lotto.back.map((n) => (
          <span key={`b-${n}`} className="ball ball-back">
            {n}
          </span>
        ))}
        <button
          className="stick-btn lotto-reroll"
          title="换一注"
          onClick={() => setLotto(rollLotto())}
        >
          ⟳
        </button>
      </div>

      <div className="stick-head">
        <span className="stick-title">今日任务</span>
        <span className="stick-count">
          {doneCount}/{todayPlans.length}
        </span>
        <button
          className="stick-btn theme"
          title="切换文字颜色"
          onClick={toggleTheme}
        >
          {light ? '🌙' : '☀️'}
        </button>
        <button className="stick-btn close" title="关闭便签（也可按 Esc）" onClick={close}>
          ✕
        </button>
      </div>

      <ul className="stick-list">
        {todayPlans.length === 0 && (
          <li className="stick-empty">今天还没有计划，在下面添加一条</li>
        )}
        {todayPlans.map((p) => (
          <li key={p.id} className={`stick-item ${p.done ? 'done' : ''}`}>
            <button
              className="stick-dot"
              title={p.done ? '标记未完成' : '标记完成'}
              onClick={() => togglePlan(p.id)}
            >
              {p.done ? '✓' : ''}
            </button>
            <span className="stick-text">
              {p.title}
              {p.note ? `（${p.note}）` : ''}
            </span>
            <button
              className="stick-btn"
              title="删除"
              onClick={() => removePlan(p.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="stick-add">
        <input
          ref={inputRef}
          value={text}
          placeholder="添加计划，回车保存"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addPlan();
          }}
        />
      </div>

      {/* 边缘热区：仅用于显示光标，实际由根节点的坐标路由处理 */}
      <div className="rs rs-e" />
      <div className="rs rs-s" />
      <div className="rs rs-se" />
    </div>
  );
}
