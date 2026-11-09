import { useEffect, useState } from 'react';
import type { PathInfo } from '../lib/attachments';

interface Props {
  infos: PathInfo[];
  onCancel: () => void;
  onConfirm: (title: string) => void;
}

/** 把文件拖到任务列表空白处时：新建一个任务，并让用户决定标题 */
export default function NewTaskFromFilesDialog({
  infos,
  onCancel,
  onConfirm,
}: Props) {
  const defaultTitle = infos[0]?.name ?? '新任务';
  const [mode, setMode] = useState<'default' | 'custom'>('default');
  const [custom, setCustom] = useState(defaultTitle);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const title = mode === 'default' ? defaultTitle : custom.trim();

  return (
    <div className="modal-mask" onMouseDown={onCancel}>
      <div
        className="modal ntf-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">新建任务并绑定文件</span>
          <button className="link" onClick={onCancel} title="取消">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="hinfo">
            拖入了 {infos.length} 个文件 / 文件夹，将创建一条新任务并把它们绑定上去。
          </p>

          <div className="ntf-files">
            {infos.slice(0, 5).map((i) => (
              <div key={i.path} className="ntf-file" title={i.path}>
                {i.kind === 'dir' ? '📁' : '📄'} {i.name}
              </div>
            ))}
            {infos.length > 5 && (
              <div className="ntf-file more">…等共 {infos.length} 项</div>
            )}
          </div>

          <label className="ntf-choice">
            <input
              type="radio"
              checked={mode === 'default'}
              onChange={() => setMode('default')}
            />
            用文件名做标题{infos.length > 1 ? '（取第一个文件）' : ''}
          </label>
          {mode === 'default' && (
            <div className="ntf-preview">{defaultTitle}</div>
          )}

          <label className="ntf-choice">
            <input
              type="radio"
              checked={mode === 'custom'}
              onChange={() => setMode('custom')}
            />
            自己输入标题
          </label>
          {mode === 'custom' && (
            <input
              className="ntf-input"
              autoFocus
              value={custom}
              placeholder="输入任务标题"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title) onConfirm(title);
              }}
            />
          )}

          <div className="ntf-actions">
            <button className="link" onClick={onCancel}>
              取消
            </button>
            <button
              className="primary-btn"
              disabled={!title}
              onClick={() => onConfirm(title)}
            >
              创建任务
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
