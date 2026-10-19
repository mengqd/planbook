// 中国法定节假日放假 / 调休安排（自动生成，请勿手改条目）
// 数据来源：国务院办公厅《关于2026年部分节假日安排的通知》 -> https://www.gov.cn
// 更新方式：每年官方公布后，在下面追加对应年份的数组，并加入 holidays.ts 的 officialDays

export type OfficialDay = {
  /** 节假日名称，如 春节 / 清明节 */
  name: string;
  /** 日期 yyyy-MM-dd */
  date: string;
  /** true = 放假(休)，false = 调休上班(班) */
  isOffDay: boolean;
};

export const OFFICIAL_DAYS_2026: OfficialDay[] = [
  { name: '元旦', date: '2026-01-01', isOffDay: true },
  { name: '元旦', date: '2026-01-02', isOffDay: true },
  { name: '元旦', date: '2026-01-03', isOffDay: true },
  { name: '元旦', date: '2026-01-04', isOffDay: false },
  { name: '春节', date: '2026-02-14', isOffDay: false },
  { name: '春节', date: '2026-02-15', isOffDay: true },
  { name: '春节', date: '2026-02-16', isOffDay: true },
  { name: '春节', date: '2026-02-17', isOffDay: true },
  { name: '春节', date: '2026-02-18', isOffDay: true },
  { name: '春节', date: '2026-02-19', isOffDay: true },
  { name: '春节', date: '2026-02-20', isOffDay: true },
  { name: '春节', date: '2026-02-21', isOffDay: true },
  { name: '春节', date: '2026-02-22', isOffDay: true },
  { name: '春节', date: '2026-02-23', isOffDay: true },
  { name: '春节', date: '2026-02-28', isOffDay: false },
  { name: '清明节', date: '2026-04-04', isOffDay: true },
  { name: '清明节', date: '2026-04-05', isOffDay: true },
  { name: '清明节', date: '2026-04-06', isOffDay: true },
  { name: '劳动节', date: '2026-05-01', isOffDay: true },
  { name: '劳动节', date: '2026-05-02', isOffDay: true },
  { name: '劳动节', date: '2026-05-03', isOffDay: true },
  { name: '劳动节', date: '2026-05-04', isOffDay: true },
  { name: '劳动节', date: '2026-05-05', isOffDay: true },
  { name: '劳动节', date: '2026-05-09', isOffDay: false },
  { name: '端午节', date: '2026-06-19', isOffDay: true },
  { name: '端午节', date: '2026-06-20', isOffDay: true },
  { name: '端午节', date: '2026-06-21', isOffDay: true },
  { name: '国庆节', date: '2026-09-20', isOffDay: false },
  { name: '中秋节', date: '2026-09-25', isOffDay: true },
  { name: '中秋节', date: '2026-09-26', isOffDay: true },
  { name: '中秋节', date: '2026-09-27', isOffDay: true },
  { name: '国庆节', date: '2026-10-01', isOffDay: true },
  { name: '国庆节', date: '2026-10-02', isOffDay: true },
  { name: '国庆节', date: '2026-10-03', isOffDay: true },
  { name: '国庆节', date: '2026-10-04', isOffDay: true },
  { name: '国庆节', date: '2026-10-05', isOffDay: true },
  { name: '国庆节', date: '2026-10-06', isOffDay: true },
  { name: '国庆节', date: '2026-10-07', isOffDay: true },
  { name: '国庆节', date: '2026-10-10', isOffDay: false },
];
