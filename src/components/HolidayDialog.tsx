import { useState } from 'react';
import {
  HOLIDAY_SOURCE_URL,
  applyOfficialDays,
  fetchOfficialDays,
  getHolidayYears,
  parseDaysText,
} from '../lib/holidays';

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

type Msg = { kind: 'ok' | 'err'; text: string } | null;

const SAMPLE = `{
  "year": 2027,
  "days": [
    { "name": "元旦", "date": "2027-01-01", "isOffDay": true },
    { "name": "元旦", "date": "2027-01-04", "isOffDay": false }
  ]
}`;

export default function HolidayDialog({ open, onClose, onUpdated }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  if (!open) return null;

  const years = getHolidayYears();

  const finish = (days: { name: string; date: string; isOffDay: boolean }[]) => {
    return applyOfficialDays(days).then(({ count, path }) => {
      const ys = [...new Set(days.map((d) => d.date.slice(0, 4)))].sort();
      setMsg({
        kind: 'ok',
        text:
          `已更新 ${ys.join('、')} 年数据，当前共 ${count} 条${path ? `，已保存到：${path}` : ''}`,
      });
      setText('');
      onUpdated();
    });
  };

  const handleFetch = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const y = Number(year);
      if (!Number.isInteger(y)) throw new Error('年份不正确');
      const days = await fetchOfficialDays(y);
      await finish(days);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const handlePaste = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const days = parseDaysText(text.trim());
      await finish(days);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">更新节假日 / 调休</div>
          <button className="del" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="hinfo">
            已包含数据年份：<b>{years.join('、') || '无'}</b>
          </div>

          <div className="hlabel">① 联网一键更新（推荐）</div>
          <div className="field-row">
            <input
              className="year-input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="年份"
            />
            <button className="primary-btn" onClick={handleFetch} disabled={busy}>
              {busy ? '更新中…' : '拉取该年数据'}
            </button>
          </div>
          <div className="source-note">
            数据源：<span className="mono">{HOLIDAY_SOURCE_URL(Number(year) || currentYear)}</span>
            <br />
            该数据源同步国务院办公厅放假安排，一般每年 11 月发布次年数据。
          </div>

          <div className="hlabel">② 手动粘贴（联网失败时用）</div>
          <div className="source-note">
            在浏览器打开上面的地址，全选复制返回的 JSON，粘贴到下面后点「导入」。
          </div>
          <textarea
            className="paste-area"
            value={text}
            placeholder={SAMPLE}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="primary-btn"
            onClick={handlePaste}
            disabled={busy || !text.trim()}
          >
            导入粘贴内容
          </button>

          {msg && (
            <div className={`hmsg ${msg.kind}`}>{msg.text}</div>
          )}
        </div>
      </div>
    </div>
  );
}
