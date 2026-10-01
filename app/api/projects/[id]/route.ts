import { NextResponse } from 'next/server';

import { listProjects, updateProject } from '@/db/service';
import { getApiViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getApiViewer();
  if (!viewer) return NextResponse.json({ error: '請先登入。' }, { status: 401 });
  const { id } = await context.params;
  const exists = (await listProjects()).some((project) => project.id === id);
  if (!exists) return NextResponse.json({ error: '找不到此專案。' }, { status: 404 });

  const body = await request.json() as { activityDate?: string | null; status?: string; progressNote?: string };
  const activityDate = body.activityDate || null;
  if (activityDate && !/^\d{4}-\d{2}-\d{2}$/.test(activityDate)) return NextResponse.json({ error: '活動日期格式不正確。' }, { status: 400 });
  const status = String(body.status ?? '').trim().slice(0, 40);
  if (!status) return NextResponse.json({ error: '請選擇進度狀態。' }, { status: 400 });

  await updateProject(viewer, id, { activityDate, status, progressNote: String(body.progressNote ?? '').trim().slice(0, 500) });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
