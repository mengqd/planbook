import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import Calendar from './components/Calendar';
import DayPanel from './components/DayPanel';
import HolidayDialog from './components/HolidayDialog';
import { usePlans } from './hooks/usePlans';
import { initHolidays } from './lib/holidays';
import UnfinishedDialog from './components/UnfinishedDialog';
import LabelManagerDialog from './components/LabelManagerDialog';

export default function App() {
  const {
    selectedDate,
    setSelectedDate,
    selectedPlans,
    plansByDate,
    plans,
    addPlan,
    updatePlan,
    removePlan,
    togglePlan,
    doExport,
    doImport,
    doTemplate,
    loading,
  } = usePlans();

  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [, setTick] = useState(0);

  // 启动时加载用户更新过的节假日数据，再渲染日历
  useEffect(() => {
    initHolidays().finally(() => setReady(true));
  }, []);

  // 便签窗口内部自行关闭时（✕ 或 Esc），主窗口按钮状态同步回「钉桌面」
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const ready = listen('planbook:sticky-closed', () => setPinned(false))
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      void ready.then(() => unlisten?.());
    };
  }, []);

  const undoneCount = plans.filter((p) => !p.done).length;

  const toggleSticky = async () => {
    try {
      if (pinned) {
        await invoke('hide_sticky');
        setPinned(false);
      } else {
        await invoke('show_sticky');
        setPinned(true);
      }
    } catch (e) {
      alert(
        '操作桌面便签失败：' + (e instanceof Error ? e.message : String(e)),
      );
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🗒 便签</div>
        <div className="actions">
          <button
            onClick={() => setTodoOpen(true)}
            title="列出所有未完成的事项"
          >
            未完成{undoneCount > 0 ? `（${undoneCount}）` : ''}
          </button>
          <button
            onClick={() => setLabelOpen(true)}
            title="管理“下班前”等快捷时间标签"
          >
            时间标签
          </button>
          <button
            onClick={toggleSticky}
            title={
              pinned
                ? '关闭桌面便签'
                : '把今日任务钉到桌面（透明置顶，可随时开关）'
            }
          >
            {pinned ? '关闭便签' : '钉桌面'}
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            title="更新节假日与调休数据"
          >
            节假日
          </button>
          <button onClick={doTemplate} title="下载示例模板，照格式填写后导入">
            模板
          </button>
          <button onClick={doImport}>导入</button>
          <button onClick={doExport}>导出</button>
        </div>
      </header>

      {loading || !ready ? (
        <div className="loading">加载中…</div>
      ) : (
        <main className="layout">
          <Calendar
            selectedDate={selectedDate}
            plansByDate={plansByDate}
            onSelect={setSelectedDate}
          />
          <DayPanel
            date={selectedDate}
            plans={selectedPlans}
            onAdd={addPlan}
            onToggle={togglePlan}
            onUpdate={updatePlan}
            onRemove={removePlan}
          />
        </main>
      )}

      <HolidayDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onUpdated={() => setTick((t) => t + 1)}
      />

      <UnfinishedDialog
        open={todoOpen}
        onClose={() => setTodoOpen(false)}
        plans={plans}
        onToggle={togglePlan}
        onJump={(d) => {
          setSelectedDate(d);
          setTodoOpen(false);
        }}
      />

      <LabelManagerDialog
        open={labelOpen}
        onClose={() => setLabelOpen(false)}
      />
    </div>
  );
}
