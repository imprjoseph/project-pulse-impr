import { CalendarDays, Fingerprint, History } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { WeeklyReportForm } from '@/components/weekly-report-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserReports, listProjects } from '@/db/service';
import { currentWeekStart, formatWeekLabel } from '@/lib/dates';
import { getPageViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export default async function WeeklyPage() {
  const viewer = await getPageViewer('/weekly');
  const weekStart = currentWeekStart();
  const [projects, reports] = await Promise.all([listProjects(), getUserReports(viewer.userId)]);

  return (
    <AppShell viewer={viewer} active="/weekly">
      <main className="mx-auto max-w-[1200px] px-5 py-7 lg:px-8 lg:py-9">
        <section className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarDays className="size-4" />本週 {formatWeekLabel(weekStart)}
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">我的週報</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              回報實際投入、加班原因與困難點，讓主管能提早排除阻礙，而不是事後追工時。
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <Fingerprint className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">填寫者：{viewer.displayName}</p>
              <p className="text-xs text-muted-foreground">身分由登入資訊自動帶入，不可代填</p>
            </div>
          </div>
        </section>

        <WeeklyReportForm projects={projects} weekStart={weekStart} />

        <Card className="mt-7 border-0 shadow-[0_14px_40px_rgb(18_42_66/6%)] ring-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="size-5 text-primary" />最近週報</CardTitle>
            <CardDescription>顯示您最近 8 週的回報摘要。</CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">尚無週報紀錄，完成上方表單後會顯示在這裡。</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{formatWeekLabel(report.week_start)}</p>
                      <Badge variant={Number(report.overtime_hours) > 0 ? 'secondary' : 'outline'}>{Number(report.entry_count)} 工項</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <MiniStat label="正常" value={`${Number(report.regular_hours)}h`} />
                      <MiniStat label="加班" value={`${Number(report.overtime_hours)}h`} urgent={Number(report.overtime_hours) > 0} />
                      <MiniStat label="下週" value={`${Number(report.next_week_hours)}h`} />
                    </div>
                    {report.highlights && <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">成果：{report.highlights}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}

function MiniStat({ label, value, urgent = false }: { label: string; value: string; urgent?: boolean }) {
  return <div className="rounded-lg bg-muted/60 px-2 py-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`mt-1 font-bold tabular-nums ${urgent ? 'text-amber-700' : ''}`}>{value}</p></div>;
}
