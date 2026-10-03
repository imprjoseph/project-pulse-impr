import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, FolderKanban, Users } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardSummary, listProjects } from '@/db/service';
import { currentWeekStart, formatDate, formatWeekLabel } from '@/lib/dates';
import { teamMembers } from '@/lib/projects';
import { getPageViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const viewer = await getPageViewer('/');
  const weekStart = currentWeekStart();
  const [summary, projects] = await Promise.all([getDashboardSummary(weekStart), listProjects()]);
  const reportRate = Math.round(summary.submitted / teamMembers.length * 100);
  const workload = getWorkload(projects);
  const focusProjects = projects
    .filter((project) => project.status !== '活動完成')
    .sort((a, b) => (a.activityDate ?? '9999-12-31').localeCompare(b.activityDate ?? '9999-12-31'))
    .slice(0, 5);

  return (
    <AppShell viewer={viewer} active="/">
      <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
        <section className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><CalendarDays className="size-4" />本週 {formatWeekLabel(weekStart)}</div>
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">先看負載，再排工作。</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">同仁只需在網頁回報工時與困難點；專案底稿維持後台管理，不開放直接共筆。</p>
          </div>
          <Button size="lg" render={<a href="/weekly" />} className="h-11 px-4 shadow-sm">填寫本週週報<ArrowRight data-icon="inline-end" /></Button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="本週摘要">
          <MetricCard icon={Users} label="已回報人數" value={`${summary.submitted}/${teamMembers.length}`} note={`本週回報率 ${reportRate}%`} />
          <MetricCard icon={FolderKanban} label="進行中專案" value={String(summary.totalProjects)} note={`本週正常工時 ${summary.regularHours}h`} />
          <MetricCard icon={Clock3} label="本週加班" value={`${summary.overtimeHours} h`} note={summary.overtimeHours > 0 ? `${summary.difficulties} 個困難點待處理` : '目前尚無加班回報'} urgent={summary.overtimeHours > 0} />
          <MetricCard icon={AlertTriangle} label="未排定活動" value={String(summary.unscheduledProjects)} note="需補活動日期，才能正確預警" urgent={summary.unscheduledProjects > 0} />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
          <Card className="border-0 shadow-[0_14px_40px_rgb(18_42_66/6%)] ring-border/80">
            <CardHeader className="border-b border-border/70 pb-4">
              <CardTitle>人力集中月份</CardTitle>
              <CardDescription>依活動日期與 PM 歸屬，快速發現工作是否集中。</CardDescription>
              <CardAction><Badge variant="outline">專案件數</Badge></CardAction>
            </CardHeader>
            <CardContent className="space-y-5 pt-1">
              {workload.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">尚無已排定活動日期的專案。</p> : workload.map((person) => (
                <div key={`${person.name}-${person.month}`} className="grid grid-cols-[80px_54px_1fr_44px] items-center gap-3">
                  <span className="font-semibold">{person.name}</span><span className="text-xs text-muted-foreground">{person.month} 月</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${person.projects >= 3 ? 'workload-danger' : person.projects === 2 ? 'workload-warning' : 'workload-healthy'}`} style={{ width: `${Math.min(person.projects / 3, 1) * 100}%` }} /></div>
                  <span className="text-right text-sm font-bold tabular-nums">{person.projects} 件</span>
                </div>
              ))}
              <div className="rounded-xl border border-dashed border-border bg-muted/35 px-4 py-3 text-xs leading-5 text-muted-foreground">專案件數是前置預警；實際負載請搭配週報的正常工時、加班工時與下週預估判讀。</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_14px_40px_rgb(18_42_66/6%)] ring-border/80">
            <CardHeader className="border-b border-border/70 pb-4">
              <CardTitle>客戶／重要工作進度</CardTitle>
              <CardDescription>依活動日排列近期節點；活動日異動後排序會跟著調整。</CardDescription>
              <CardAction><Badge className="bg-teal-100 text-teal-800">{focusProjects.length} 項</Badge></CardAction>
            </CardHeader>
            <CardContent className="space-y-1 pt-1">
              {focusProjects.map((project) => (
                <div key={project.id} className="group flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-muted/55">
                  <div className={`grid size-11 shrink-0 place-items-center rounded-xl text-xs font-bold ${project.activityDate ? 'bg-primary/8 text-primary' : 'bg-amber-100 text-amber-700'}`}>{formatDate(project.activityDate)}</div>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{project.name}</p><p className="mt-1 text-xs text-muted-foreground">{project.client} · PM {project.pmName} · {project.status}</p>{project.progressNote && <p className="mt-1 truncate text-xs font-medium text-primary">{project.progressNote}</p>}</div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-6 rounded-2xl bg-[linear-gradient(120deg,oklch(.34_.07_230),oklch(.43_.1_203))] px-5 py-5 text-white shadow-lg sm:flex sm:items-center sm:justify-between sm:px-7">
          <div><p className="font-heading text-lg font-bold">週報不是打卡，是提早看見阻礙。</p><p className="mt-1 text-sm text-white/75">請同仁每週回報投入工項、加班原因與需要的協助。</p></div>
          <Button className="mt-4 bg-white text-slate-800 hover:bg-white/90 sm:mt-0" render={<a href="/weekly" />}>開始填寫<CheckCircle2 /></Button>
        </section>
      </main>
    </AppShell>
  );
}

function getWorkload(projects: Awaited<ReturnType<typeof listProjects>>) {
  const counts = new Map<string, { name: string; month: string; projects: number }>();
  projects.filter((project) => project.activityDate).forEach((project) => {
    const month = String(Number(project.activityDate!.slice(5, 7)));
    const key = `${project.pmName}-${month}`;
    const current = counts.get(key) ?? { name: project.pmName, month, projects: 0 };
    current.projects += 1;
    counts.set(key, current);
  });
  return [...counts.values()].sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name)).slice(0, 6);
}

function MetricCard({ icon: Icon, label, value, note, urgent = false }: { icon: typeof Users; label: string; value: string; note: string; urgent?: boolean }) {
  return (
    <Card className="metric-card border-0 ring-border/80"><CardContent className="flex items-start gap-4"><div className={`grid size-10 place-items-center rounded-xl ${urgent ? 'bg-amber-100 text-amber-700' : 'bg-primary/8 text-primary'}`}><Icon className="size-5" /></div><div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-1 font-heading text-3xl font-bold tracking-tight">{value}</p><p className={`mt-1 text-xs ${urgent ? 'font-medium text-amber-700' : 'text-muted-foreground'}`}>{note}</p></div></CardContent></Card>
  );
}
