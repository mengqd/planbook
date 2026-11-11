import { invoke } from '@tauri-apps/api/core';

/**
 * seca-oa 每日工时 API 的前端封装。
 * 网络请求统一走 Rust 命令 oa_request（绕开 WebView 的 CORS 限制），
 * AccessToken 仅存本机 localStorage，不写入仓库。
 */

const TOKEN_KEY = 'planbook_oa_token';

export function getOaToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function saveOaToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t.trim());
}

export interface OaOptionItem {
  id: number;
  name: string;
  pid?: number;
  info?: string;
}

export interface OaOptions {
  dayTypes: OaOptionItem[];
  workTypes: OaOptionItem[];
  projects: OaOptionItem[];
  workOvertimeOptions: string[];
  dateRange: { minDate: string; maxDate: string; today: string };
}

export interface OaEntry {
  date: string; // Y-m-d
  dayType: number; // 出勤类型：2=工作 3=加班 1=休息
  project: number; // 二级项目 id
  type: number; // 工作类型 id
  workOvertime: string; // 时长枚举（如 "8"）
  remarks: string; // 工作内容（≥2 字）
}

export interface OaBatchResult {
  ok: boolean;
  requestedCount: number;
  successCount: number;
  failedCount: number;
  results: {
    index: number;
    date: string;
    ok: boolean;
    id: number;
    hours: number;
    issues: string[];
  }[];
}

interface OaEnvelope {
  status: string;
  data: {
    ok?: boolean;
    issues?: string[];
    [k: string]: unknown;
  };
}

/** 调用 oa_request 转发命令并解包 {status, data} 响应 */
async function oaCall<T>(args: {
  token: string;
  method?: 'GET' | 'POST';
  path: string;
  query?: string;
  payload?: unknown;
}): Promise<T> {
  const res = await invoke<OaEnvelope>('oa_request', {
    token: args.token,
    method: args.method ?? 'GET',
    path: args.path,
    query: args.query ?? null,
    payload: args.payload ?? null,
  });
  if (res.status === '401') {
    throw new Error('AccessToken 无效或已撤销，请到 OA「99.获取AccessToken」页重新生成');
  }
  if (res.status !== '200') {
    throw new Error(`OA 接口返回异常 status=${res.status}`);
  }
  const d = res.data ?? {};
  if (d.ok === false) {
    const issues = (d.issues as string[] | undefined) ?? [];
    throw new Error(issues.join('；') || 'OA 接口返回 ok=false');
  }
  return d as T;
}

/** 校验令牌并返回用户信息（弹窗启动自检用） */
export function oaMe(token: string) {
  return oaCall<{ ok: boolean; userId: number; name: string; account: string }>({
    token,
    path: 'me',
  });
}

let optionsCache: { at: number; data: OaOptions } | null = null;

/** 出勤类型 / 工作类型 / 项目树 / 时长枚举（10 分钟内存缓存） */
export async function oaOptions(token: string): Promise<OaOptions> {
  if (optionsCache && Date.now() - optionsCache.at < 10 * 60_000) {
    return optionsCache.data;
  }
  const d = await oaCall<OaOptions>({ token, path: 'options' });
  optionsCache = { at: Date.now(), data: d };
  return d;
}

/** 追加式批量提交（不清空 OA 已有记录；可跨多天） */
export function oaBatchSave(token: string, entries: OaEntry[]) {
  return oaCall<OaBatchResult>({
    token,
    method: 'POST',
    path: 'batch-save',
    payload: { entries },
  });
}
