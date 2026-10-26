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
}

export interface Store {
  version: number;
  plans: Plan[];
}
