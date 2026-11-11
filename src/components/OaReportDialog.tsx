import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Plan } from '../lib/types';
import { formatDate, parseDate, todayStr, WEEKDAY_LABELS } from '../lib/date';
import {
  getOaToken,
  saveOaToken,
  oaMe,
  oaOptions,
  oaBatchSave,
  type OaOptions,
  type OaEntry,
  type OaBatchResult,
} from '../lib/oa';

type RangeKey = 'today' | 'yesterday' | 'week';

const RANGE_LABELS: Record<RangeKey, string> = {
  today: '今天',
  yesterday: '昨天',
  week: '本周（周一~今天）',
};

/** 每条任务对应的工时配置；时长不设默认，全部手动填 */
interface RowConfig {
  dayType: number; // 出勤类型：默认工作日=工作(2) 周末=加班(3)，可改
  project: number; // 二级项目 id，0=未选
  type: number; // 工作类型 id，0=未选
  workOvertime: string; // 时长枚举，''=未选
  remarks: string; // 工作内容，默认=任务标题
}

function mondayOfToday(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return formatDate(d);
}

export default function OaReportDialog({
  plans,
  onClose,
}: {
  plans: Plan[];
  onClose: () => void;
}) {
  const [me, setMe] = useState<string | null>(null);
  const [options, setOptions] = useState<OaOptions | null>(null);
  const [editingToken, setEditingToken] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [connError, setConnError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [range, setRange] = useState<RangeKey>('today');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<Record<string, RowConfig>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [results, setResults] = useState<{ titles: string[]; res: OaBatchResult } | null>(null);

  const connect = useCallback(async (t: string) => {
    setConnecting(true);
    setConnError('');
    try {
      const [m, o] = await Promise.all([oaMe(t), oaOptions(t)]);
      setMe(m.name);
      setOptions(o);
      setEditingToken(false);
      setConnError('');
    } catch (e) {
      setMe(null);
      setOptions(null);
      setConnError(e instanceof Error ? e.message : String(e));
      setEditingToken(true);
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    const t = getOaToken();
    if (t) void connect(t);
    else setEditingToken(true);
  }, [connect]);

  const saveTokenAndConnect = () => {
    const t = tokenDraft.trim();
    if (!t) return;
    saveOaToken(t);
    setTokenDraft('');
    void connect(t);
  };

  /** 范围内已完成的任务（仅已完成，按日期升序） */
  const inRangePlans = useMemo(() => {
    const today = todayStr();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = formatDate(y);
    let lo: string;
    let hi: string;
    if (range === 'today') {
      lo = hi = today;
    } else if (range === 'yesterday') {
      lo = hi = yesterday;
    } else {
      lo = mondayOfToday();
      hi = today;
    }
    return plans
      .filter((p) => p.done && p.date >= lo && p.date <= hi)
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  }, [plans, range]);

  /** 按日期分组；颜色按周几固定（周一~周日各一色），切换范围时同一天颜色不变 */
  const dayGroups = useMemo(() => {
    const map = new Map<string, Plan[]>();
    for (const p of inRangePlans) {
      if (!map.has(p.date)) map.set(p.date, []);
      map.get(p.date)!.push(p);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      dayIdx: (parseDate(date).getDay() + 6) % 7,
    }));
  }, [inRangePlans]);

  // 范围变化时重置勾选与配置（出勤类型按星期给初值：周末=加班，工作日=工作）
  useEffect(() => {
    setChecked(Object.fromEntries(inRangePlans.map((p) => [p.id, true])));
    setConfig(
      Object.fromEntries(
        inRangePlans.map((p) => {
          const wd = parseDate(p.date).getDay();
          return [
            p.id,
            {
              dayType: wd === 0 || wd === 6 ? 3 : 2,
              project: 0,
              type: 0,
              workOvertime: '',
              remarks: p.title,
            } satisfies RowConfig,
          ];
        }),
      ),
    );
    setResults(null);
    setFormError('');
  }, [inRangePlans]);

  const selectedCount = inRangePlans.filter((p) => checked[p.id]).length;

  /** 项目下拉分组：一级项目为 optgroup，只列可选的二级项目（pid>0） */
  const projectGroups = useMemo(() => {
    if (!options) return [];
    const parents = new Map(
      options.projects.filter((p) => (p.pid ?? 0) === 0).map((p) => [p.id, p.name]),
    );
    const groups = new Map<number, { name: string; items: typeof options.projects }>();
    for (const c of options.projects) {
      const pid = c.pid ?? 0;
      if (pid <= 0) continue;
      if (!groups.has(pid)) {
        groups.set(pid, { name: parents.get(pid) ?? '其他', items: [] });
      }
      groups.get(pid)!.items.push(c);
    }
    return [...groups.entries()].map(([pid, g]) => ({ pid, ...g }));
  }, [options]);

  const patchConfig = (id: string, patch: Partial<RowConfig>) => {
    setConfig((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const submit = async () => {
    const token = getOaToken();
    if (!token) {
      setEditingToken(true);
      return;
    }
    const sel = inRangePlans.filter((p) => checked[p.id]);
    if (sel.length === 0) {
      setFormError('请至少勾选一条任务');
      return;
    }
    for (const p of sel) {
      const c = config[p.id];
      const t = p.title.length > 12 ? `${p.title.slice(0, 12)}…` : p.title;
      if (!c.project) {
        setFormError(`「${t}」未选择项目`);
        return;
      }
      if (!c.type) {
        setFormError(`「${t}」未选择工作类型`);
        return;
      }
      if (!c.workOvertime) {
        setFormError(`「${t}」未选择工时时长`);
        return;
      }
      if (c.remarks.trim().length < 2) {
        setFormError(`「${t}」工作内容至少 2 个字`);
        return;
      }
    }
    setFormError('');
    setSubmitting(true);
    try {
      const entries: OaEntry[] = sel.map((p) => {
        const c = config[p.id];
        return {
          date: p.date,
          dayType: c.dayType,
          project: c.project,
          type: c.type,
          workOvertime: c.workOvertime,
          remarks: c.remarks.trim(),
        };
      });
      const res = await oaBatchSave(token, entries);
      setResults({ titles: sel.map((p) => p.title), res });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div
        className="modal oa-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>提交日报 / 周报（seca-oa 工时）</h3>

        {/* 连接状态与令牌管理 */}
        {me && !editingToken ? (
          <div className="oa-conn">
            <span className="oa-conn-ok">✓ 已连接：{me}</span>
            <button className="oa-conn-edit" onClick={() => setEditingToken(true)}>
              更换令牌
            </button>
          </div>
        ) : null}
        {editingToken ? (
          <div className="oa-token-row">
            <input
              className="oa-token-input"
              placeholder="粘贴 OA AccessToken（OA 菜单「99.获取AccessToken」页生成，仅存本机）"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTokenAndConnect();
              }}
            />
            <button
              className="primary-btn"
              disabled={connecting || !tokenDraft.trim()}
              onClick={saveTokenAndConnect}
            >
              {connecting ? '验证中…' : '验证并保存'}
            </button>
          </div>
        ) : null}
        {connError ? <div className="oa-error">{connError}</div> : null}

        {me && options ? (
          <>
            <div className="oa-ranges">
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
                <button
                  key={k}
                  className={range === k ? 'on' : ''}
                  onClick={() => setRange(k)}
                >
                  {RANGE_LABELS[k]}
                </button>
              ))}
            </div>

            {inRangePlans.length === 0 ? (
              <div className="oa-empty">
                所选范围内没有「已完成」的任务。先把完成的任务打上勾，或切换范围。
              </div>
            ) : (
              <div className="oa-rows">
                {dayGroups.map((g) => (
                  <div key={g.date} className={`oa-day-group oa-day-${g.dayIdx}`}>
                    <div className="oa-day-head">
                      <span className="oa-day-dot" />
                      <span className="oa-day-label">
                        {Number(g.date.slice(5, 7))}月{Number(g.date.slice(8, 10))}日 · 周{WEEKDAY_LABELS[g.dayIdx]}
                      </span>
                      {g.date === todayStr() ? (
                        <span className="oa-today-badge">今天</span>
                      ) : null}
                      <span className="oa-day-count">{g.items.length} 项已完成</span>
                    </div>
                    {g.items.map((p) => {
                      const on = !!checked[p.id];
                      const c = config[p.id];
                      return (
                        <div key={p.id} className={`oa-row ${on ? '' : 'off'}`}>
                          <label className="oa-row-head">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(e) =>
                                setChecked((prev) => ({ ...prev, [p.id]: e.target.checked }))
                              }
                            />
                            <span className="oa-row-dot" />
                        <span className="oa-row-title" title={p.title}>
                          {p.title}
                        </span>
                      </label>
                      {on && c ? (
                        <div className="oa-row-cfg">
                          <select
                            value={c.project}
                            onChange={(e) =>
                              patchConfig(p.id, { project: Number(e.target.value) })
                            }
                          >
                            <option value={0}>选择项目…</option>
                            {projectGroups.map((g) => (
                              <optgroup key={g.pid} label={g.name}>
                                {g.items.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          <select
                            value={c.type}
                            onChange={(e) =>
                              patchConfig(p.id, { type: Number(e.target.value) })
                            }
                          >
                            <option value={0}>工作类型…</option>
                            {options.workTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={c.dayType}
                            onChange={(e) =>
                              patchConfig(p.id, { dayType: Number(e.target.value) })
                            }
                            title="出勤类型（周末默认加班，可改）"
                          >
                            {options.dayTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={c.workOvertime}
                            onChange={(e) =>
                              patchConfig(p.id, { workOvertime: e.target.value })
                            }
                          >
                            <option value="">时长…</option>
                            {options.workOvertimeOptions.map((h) => (
                              <option key={h} value={h}>
                                {h} 小时
                              </option>
                            ))}
                          </select>
                          <input
                            className="oa-remarks"
                            value={c.remarks}
                            placeholder="工作内容（≥2 字）"
                            onChange={(e) =>
                              patchConfig(p.id, { remarks: e.target.value })
                            }
                          />
                        </div>
                      ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {formError ? <div className="oa-error">{formError}</div> : null}

            {results ? (
              <div className="oa-results">
                <div className="oa-results-sum">
                  提交完成：成功 {results.res.successCount} 条、失败{' '}
                  {results.res.failedCount} 条（追加模式，未影响 OA 已有记录）
                </div>
                {results.res.results.map((r, i) => (
                  <div
                    key={i}
                    className={`oa-result ${r.ok ? 'ok' : 'fail'}`}
                  >
                    {r.ok ? '✓' : '✗'} {results.titles[r.index]}
                    {r.ok
                      ? `（${r.date} · ${r.hours}h）`
                      : `：${r.issues.join('；') || '未知原因'}`}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="oa-actions">
              <span className="oa-hint">batch-save 追加写入，不会清除 OA 已录工时</span>
              <button onClick={onClose}>关闭</button>
              <button
                className="primary-btn"
                disabled={submitting || selectedCount === 0}
                onClick={() => void submit()}
              >
                {submitting ? '提交中…' : `提交 ${selectedCount} 条`}
              </button>
            </div>
          </>
        ) : !editingToken ? (
          <div className="oa-empty">正在连接 OA…</div>
        ) : null}
      </div>
    </div>
  );
}
