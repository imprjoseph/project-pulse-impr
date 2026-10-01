export type ProjectSeed = {
  id: string;
  name: string;
  client: string;
  activityDate: string | null;
  pmName: string;
  status: string;
};

export const projectSeeds: ProjectSeed[] = [
  { id: 'EVT-2026-001', name: '2026科技主權高峰會議', client: '通迅學會', activityDate: '2026-08-31', pmName: 'Hazel', status: '活動完成' },
  { id: 'EVT-2026-002', name: '2026SIG會議', client: '工研院', activityDate: '2026-09-15', pmName: 'Arlena', status: '活動完成' },
  { id: 'EVT-2026-003', name: '台馬第4海纜完工', client: '數發部', activityDate: '2026-09-18', pmName: 'Penny', status: '活動完成' },
  { id: 'EVT-2026-004', name: '5G體驗活動', client: '數發部', activityDate: '2026-09-18', pmName: 'Eden', status: '活動完成' },
  { id: 'EVT-2026-005', name: '台馬活動行程', client: '數發部', activityDate: '2026-09-17', pmName: 'Arlena', status: '活動完成' },
  { id: 'EVT-2026-006', name: '2026 6G SUMMIT', client: 'TAICS', activityDate: '2026-09-22', pmName: 'Penny', status: '活動完成' },
  { id: 'EVT-2026-007', name: '媒體託播', client: '電信協會', activityDate: null, pmName: 'Tiffany', status: '執行準備' },
  { id: 'EVT-2026-008', name: '電磁波宣導', client: 'NCC', activityDate: null, pmName: 'Yuki', status: '執行準備' },
  { id: 'EVT-2026-009', name: '小琉球電信訪查', client: '數發部', activityDate: '2026-09-23', pmName: 'Arlena', status: '執行準備' },
  { id: 'EVT-2026-010', name: '2026國防AI應用創新競賽暨論壇', client: '資策會AI院', activityDate: '2026-11-07', pmName: 'Joseph', status: '執行準備' },
  { id: 'EVT-2026-011', name: '高抗災基地臺成果訪查', client: '數發部', activityDate: '2026-11-03', pmName: 'Yuki', status: '執行準備' },
  { id: 'EVT-2026-012', name: '台澎金第4海纜完工', client: '數發部', activityDate: null, pmName: 'Arlena', status: '規劃中' },
  { id: 'EVT-2026-013', name: '國土署個資教育訓練', client: '國土署', activityDate: '2026-11-30', pmName: 'Tiffany', status: '籌備中' },
  { id: 'EVT-2026-014', name: '2026 第2場5G體驗', client: '數發部', activityDate: null, pmName: 'Penny', status: '規劃中' },
  { id: 'EVT-2026-015', name: '資策會誓師大會', client: '資策會數轉院', activityDate: '2026-10-19', pmName: 'Hazel', status: '執行準備' },
  { id: 'EVT-2026-016', name: '資策會淨零研討會', client: '資策會數轉院', activityDate: '2026-12-13', pmName: 'Hazel', status: '執行準備' },
  { id: 'EVT-2026-017', name: '電信業者防詐簽署儀式', client: '電信協會', activityDate: '2026-10-19', pmName: 'Jocelyn', status: '籌備中' },
  { id: 'EVT-2026-018', name: '台日智慧電桿及區域ICT平台活動與交流分享會', client: '資策會AI院', activityDate: '2026-12-03', pmName: 'Hazel', status: '規劃中' },
];

export const teamMembers = ['Joseph', 'Hazel', 'Arlena', 'Penny', 'Yuki', 'Eden', 'Steven', 'Navy', 'Moe', 'Tiffany', 'Jade', 'Jocelyn'];

export const workCategories = [
  '合約行政', '整體時程', '視覺設計', '網站報名', '講師貴賓', '交通住宿', '餐飲伴手禮',
  '場地規劃', '舞台硬體', '輸出物', '文稿流程', '司儀口譯', '媒體社群', '攝影錄影',
  '人力分工', '保險安全', '彩排進場', '活動當日', '撤場場復', '驗收結案', '內部行政',
];

export const difficultyTypes = ['無', '需求不清', '等待客戶', '等待廠商', '跨部門協作', '估時不足', '人力不足', '返工', '技術問題', '其他'];

export const overtimeReasons = ['客戶臨時需求', '需求或範圍變更', '等待回覆後集中趕工', '臨時插單', '人力不足', '原估時不足', '重工／版本反覆', '活動當日或進撤場', '其他'];
