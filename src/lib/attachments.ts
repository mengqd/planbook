import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { Attachment } from './types';

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface PathInfo {
  path: string;
  name: string;
  kind: 'file' | 'dir';
  exists: boolean;
}

/** 探测一组路径：名称、文件/文件夹、是否仍存在 */
export async function inspectPaths(paths: string[]): Promise<PathInfo[]> {
  if (!isTauri || paths.length === 0) return [];
  try {
    return await invoke<PathInfo[]>('inspect_paths', { paths });
  } catch (e) {
    console.warn('[planbook] 路径探测失败', e);
    return [];
  }
}

/** 把拖入 / 选中的路径转成附件记录（过滤掉已经不存在的） */
export async function toAttachments(paths: string[]): Promise<Attachment[]> {
  const infos = await inspectPaths(paths);
  return infos
    .filter((i) => i.exists)
    .map((i) => ({ path: i.path, name: i.name, kind: i.kind }));
}

/** reveal=true 表示在文件管理器中定位文件（文件夹不需要） */
export async function openAttachment(
  path: string,
  reveal: boolean,
): Promise<void> {
  if (!isTauri) throw new Error('请在桌面应用中使用');
  await invoke('open_attachment', { path, reveal });
}

/** 系统文件选择框，可多选文件 */
export async function pickFiles(): Promise<string[]> {
  if (!isTauri) return [];
  const r = await open({ multiple: true, directory: false });
  if (!r) return [];
  return Array.isArray(r) ? r : [r];
}

/** 系统文件夹选择框 */
export async function pickFolder(): Promise<string[]> {
  if (!isTauri) return [];
  const r = await open({ multiple: false, directory: true });
  if (!r) return [];
  return Array.isArray(r) ? r : [r];
}

/** 合并附件，按路径去重 */
export function mergeAttachments(
  current: Attachment[],
  added: Attachment[],
): Attachment[] {
  const next = [...current];
  for (const a of added) {
    if (!next.some((x) => x.path === a.path)) next.push(a);
  }
  return next;
}
