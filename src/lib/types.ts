/** 任务绑定的本地文件 / 文件夹（只存路径，不复制文件本身） */
export interface Attachment {
  path: string;
  name: string;
  kind: 'file' | 'dir';
}

export interface Plan {
  id: string;
  date: string; // YYYY-MM-DD（本地时区）
  title: string;
  note?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  dueAt?: string | null; // 截止时间（ISO），设置后用于未完成列表的紧急度展示
  attachments?: Attachment[];
  /** 工时时长（seca-oa 的 workOvertime 枚举值：'8','2',...,'01'），提交日报与复制选中时使用 */
  duration?: string;
}

export interface Store {
  version: number;
  plans: Plan[];
  /** 每天独立的记事本：key=日期（YYYY-MM-DD）。旧数据可能没有该字段 */
  dayNotes?: Record<string, string>;
}
