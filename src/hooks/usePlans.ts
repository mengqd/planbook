import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Plan } from '../lib/types';
import { currentWindowLabel } from '../lib/window';
import {
  loadPlans,
  savePlans,
  exportPlans,
  importPlans,
  downloadTemplate,
} from '../lib/storage';
import { todayStr, type DateStr } from '../lib/date';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedDate, setSelectedDate] = useState<DateStr>(todayStr());
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<number | null>(null);
  // 从磁盘重新加载的数据不应再触发自动保存，避免两个窗口来回写造成死循环
  const skipNextSave = useRef(false);

  useEffect(() => {
    let active = true;
    loadPlans()
      .then((p) => {
        if (active) {
          setPlans(p);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // 其他窗口（如桌面便签）改了数据时，重新从磁盘加载
  const reloadFromDisk = useCallback(async () => {
    try {
      const data = await loadPlans();
      skipNextSave.current = true;
      setPlans(data);
    } catch (e) {
      console.warn('[planbook] 重新加载失败', e);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const ready = listen<string>('planbook:plans-changed', (e) => {
      if (e.payload === currentWindowLabel()) return; // 自己写的，忽略
      void reloadFromDisk();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      void ready.then(() => unlisten?.());
    };
  }, [reloadFromDisk]);

  // 改动后防抖 500ms 自动落盘
  useEffect(() => {
    if (loading) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      savePlans(plans).catch((e) => console.error('[planbook] 保存失败', e));
    }, 500);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [plans, loading]);

  const plansByDate = useMemo(() => {
    const m = new Map<string, Plan[]>();
    for (const p of plans) {
      const arr = m.get(p.date) ?? [];
      arr.push(p);
      m.set(p.date, arr);
    }
    return m;
  }, [plans]);

  const selectedPlans = useMemo(
    () => plansByDate.get(selectedDate) ?? [],
    [plansByDate, selectedDate],
  );

  const addPlan = useCallback(
    (title: string, note?: string, dueAt?: string | null) => {
      const now = new Date().toISOString();
      const plan: Plan = {
        id: uid(),
        date: selectedDate,
        title,
        note,
        done: false,
        createdAt: now,
        updatedAt: now,
        dueAt: dueAt ?? null,
      };
      setPlans((prev) => [...prev, plan]);
    },
    [selectedDate],
  );

  const updatePlan = useCallback((id: string, patch: Partial<Plan>) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, ...patch, updatedAt: new Date().toISOString() }
          : p,
      ),
    );
  }, []);

  const removePlan = useCallback((id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const togglePlan = useCallback((id: string) => {
    const now = new Date().toISOString();
    setPlans((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              done: !p.done,
              completedAt: !p.done ? now : null,
              updatedAt: now,
            }
          : p,
      ),
    );
  }, []);

  const doExport = useCallback(async () => {
    const path = await exportPlans(plans);
    if (path) alert(`已导出到：\n${path}`);
    else alert('已导出（浏览器下载）');
  }, [plans]);

  const doImport = useCallback(async () => {
    try {
      const imported = await importPlans();
      if (imported) setPlans(imported);
    } catch (e) {
      alert(
        '导入失败：' +
          (e instanceof Error ? e.message : String(e)) +
          '\n\n可先点「模板」下载示例文件，按相同格式填写后再导入。',
      );
    }
  }, []);

  const doTemplate = useCallback(async () => {
    const path = await downloadTemplate();
    if (path) alert(`已下载模板到：\n${path}`);
    else alert('已下载模板（浏览器下载）');
  }, []);

  return {
    plans,
    selectedDate,
    setSelectedDate,
    selectedPlans,
    plansByDate,
    addPlan,
    updatePlan,
    removePlan,
    togglePlan,
    doExport,
    doImport,
    doTemplate,
    loading,
  };
}
