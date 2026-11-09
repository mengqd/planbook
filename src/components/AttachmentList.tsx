import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attachment } from '../lib/types';
import {
  inspectPaths,
  mergeAttachments,
  openAttachment,
  pickFiles,
  pickFolder,
  toAttachments,
} from '../lib/attachments';

interface Props {
  items: Attachment[];
  onChange: (next: Attachment[]) => void;
}

export default function AttachmentList({ items, onChange }: Props) {
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const addRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (items.length === 0) {
      setMissing(new Set());
      return;
    }
    const infos = await inspectPaths(items.map((i) => i.path));
    setMissing(new Set(infos.filter((i) => !i.exists).map((i) => i.path)));
  }, [items]);

  // 挂载、附件变化、窗口重新获得焦点时检查路径是否仍有效
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const handleOpen = async (a: Attachment, reveal: boolean) => {
    setError('');
    if (missing.has(a.path)) {
      setError(
        `「${a.name}」已失效：原路径不存在，可能已被移动或删除。可点 ✕ 解除绑定。`,
      );
      return;
    }
    try {
      await openAttachment(a.path, reveal);
    } catch (e) {
      setError(typeof e === 'string' ? e : `打开失败：${String(e)}`);
    }
  };

  const add = async (kind: 'file' | 'dir') => {
    setMenuOpen(false);
    setError('');
    try {
      const paths = kind === 'file' ? await pickFiles() : await pickFolder();
      if (paths.length === 0) return;
      const added = await toAttachments(paths);
      if (added.length === 0) {
        setError('所选路径无效，未添加。');
        return;
      }
      onChange(mergeAttachments(items, added));
    } catch (e) {
      setError(`添加失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="attach" onDoubleClick={(e) => e.stopPropagation()}>
      {items.length > 0 && (
        <ul className="attach-list">
          {items.map((a) => {
            const gone = missing.has(a.path);
            return (
              <li
                key={a.path}
                className={`attach-item${gone ? ' gone' : ''}`}
                title={a.path}
              >
                <span className="attach-icon">
                  {a.kind === 'dir' ? '📁' : '📄'}
                </span>
                <span className="attach-name">{a.name}</span>
                {gone && <span className="attach-gone">已失效</span>}
                <button
                  className="attach-op"
                  onClick={() => void handleOpen(a, false)}
                >
                  {a.kind === 'dir' ? '打开文件夹' : '打开文件'}
                </button>
                {a.kind === 'file' && (
                  <button
                    className="attach-op"
                    onClick={() => void handleOpen(a, true)}
                  >
                    所在文件夹
                  </button>
                )}
                <button
                  className="attach-op del"
                  title="解除绑定（不会删除本地文件）"
                  onClick={() =>
                    onChange(items.filter((x) => x.path !== a.path))
                  }
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="attach-add" ref={addRef}>
        <button
          className="attach-add-btn"
          onClick={() => setMenuOpen((o) => !o)}
          title="也可直接把文件/文件夹拖到任务上"
        >
          + 添加文件 / 文件夹
        </button>
        {menuOpen && (
          <div className="attach-menu">
            <button onClick={() => void add('file')}>添加文件（可多选）</button>
            <button onClick={() => void add('dir')}>添加文件夹</button>
          </div>
        )}
      </div>

      {error && <div className="attach-error">{error}</div>}
    </div>
  );
}
