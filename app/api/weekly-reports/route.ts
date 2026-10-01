import { NextResponse } from 'next/server';

import { listProjects, saveWeeklyReport, type WeeklyReportInput } from '@/db/service';
import { getApiViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const viewer = await getApiViewer();
  if (!viewer) return NextResponse.json({ error: '請先登入後再填寫週報。' }, { status: 401 });

  let input: WeeklyReportInput;
  try {
    input = await request.json() as WeeklyReportInput;
  } catch {
    return NextResponse.json({ error: '資料格式錯誤。' }, { status: 400 });
  }

  const weekPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!input || !weekPattern.test(input.weekStart) || !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 30) {
    return NextResponse.json({ error: '請確認週次與工項內容。' }, { status: 400 });
  }

  const projectIds = new Set((await listProjects()).map((project) => project.id));
  for (const entry of input.entries) {
    const regular = Number(entry.regularHours);
    const overtime = Number(entry.overtimeHours);
    const nextWeek = Number(entry.nextWeekHours);
    if (!projectIds.has(entry.projectId) || !entry.taskName?.trim() || entry.taskName.length > 200 ||
      !Number.isFinite(regular) || !Number.isFinite(overtime) || !Number.isFinite(nextWeek) ||
      regular < 0 || regular > 80 || overtime < 0 || overtime > 40 || nextWeek < 0 || nextWeek > 80 ||
      regular + overtime <= 0 || (overtime > 0 && !entry.overtimeReason)) {
      return NextResponse.json({ error: '工項內容或工時不符合填寫規則。' }, { status: 400 });
    }
  }

  const clean: WeeklyReportInput = {
    weekStart: input.weekStart,
    highlights: String(input.highlights ?? '').trim().slice(0, 1000),
    blockers: String(input.blockers ?? '').trim().slice(0, 1000),
    nextWeekFocus: String(input.nextWeekFocus ?? '').trim().slice(0, 1000),
    entries: input.entries.map((entry) => ({
      projectId: entry.projectId,
      taskName: entry.taskName.trim().slice(0, 200),
      category: String(entry.category ?? '').slice(0, 60),
      regularHours: Number(entry.regularHours),
      overtimeHours: Number(entry.overtimeHours),
      overtimeReason: String(entry.overtimeReason ?? '').slice(0, 100),
      progress: String(entry.progress ?? '').trim().slice(0, 100),
      difficultyType: String(entry.difficultyType ?? '無').slice(0, 100),
      difficultyNote: String(entry.difficultyNote ?? '').trim().slice(0, 500),
      supportNeeded: String(entry.supportNeeded ?? '').trim().slice(0, 500),
      nextWeekHours: Number(entry.nextWeekHours),
    })),
  };

  try {
    await saveWeeklyReport(viewer, clean);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('saveWeeklyReport failed', error);
    return NextResponse.json({ error: '系統暫時無法儲存，請稍後再試。' }, { status: 500 });
  }
}
