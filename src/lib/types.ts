export interface Plan {
  id: string;
  date: string; // YYYY-MM-DD（本地时区）
  title: string;
  note?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface Store {
  version: number;
  plans: Plan[];
}
