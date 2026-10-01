import { BarChart3, CalendarDays, Clock3, Users } from 'lucide-react';

import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getProjectStats } from '@/db/service';
import { formatDate } from '@/lib/dates';
import { getPageViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const viewer = await getPageViewer('/projects');
  const projects = await getProjectStats();
  const regularTotal = projects.reduce((sum, project) => sum + Number(project.regular_hours), 0);
  const overtimeTotal = projects.reduce((sum, project) => sum + Number(project.overtime_hours), 0);
  const nextWeekTotal = projects.reduce((sum, project) => sum + Number(project.next_week_hours), 0);
  const maxHours = Math.max(1, ...projects.map((project) => Number(project.regular_hours) + Number(project.overtime_hours)));

  return (
    <AppShell viewer={viewer} active="/projects">
      <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
        <section className="mb-7">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><BarChart3 className="size-4" />累計至目前回報</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">每個專案的工作時數</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">所有同仁的週報會自動彙總到專案；正常工時、加班與下週預估分開呈現。</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric icon={Clock3} label="累計正常工時" value={`${regularTotal} h`} />
          <Metric icon={Clock3} label="累計加班工時" value={`${overtimeTotal} h`} urgent={overtimeTotal > 0} />
          <Metric icon={CalendarDays} label="下週預估投入" value={`${nextWeekTotal} h`} />
        </section>

        <Card className="mt-6 border-0 shadow-[0_14px_40px_rgb(18_42_66/6%)] ring-border/80">
          <CardHeader>
            <CardTitle>專案投入排行</CardTitle>
            <CardDescription>工時條包含正常與加班；加班另外以橘色標示。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-72">專案／客戶</TableHead>
                  <TableHead>PM</TableHead>
                  <TableHead>活動日</TableHead>
                  <TableHead className="min-w-52">累計投入</TableHead>
                  <TableHead className="text-right">下週</TableHead>
                  <TableHead className="text-right">人數</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const regular = Number(project.regular_hours);
                  const overtime = Number(project.overtime_hours);
                  const total = regular + overtime;
                  return (
                    <TableRow key={project.id}>
                      <TableCell>
                        <p className="max-w-96 truncate font-semibold">{project.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{project.client} · {project.status}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline">{project.pm_name}</Badge></TableCell>
                      <TableCell className={!project.activity_date ? 'font-medium text-amber-700' : ''}>{formatDate(project.activity_date)}</TableCell>
                      <TableCell>
                        <div className="mb-1 flex justify-between gap-3 text-xs"><span>{total}h</span><span className="text-muted-foreground">加班 {overtime}h</span></div>
                        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-label={`正常 ${regular} 小時，加班 ${overtime} 小時`}>
                          <div className="bg-primary" style={{ width: `${regular / maxHours * 100}%` }} />
                          <div className="bg-amber-500" style={{ width: `${overtime / maxHours * 100}%` }} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{Number(project.next_week_hours)}h</TableCell>
                      <TableCell className="text-right"><span className="inline-flex items-center gap-1"><Users className="size-3.5 text-muted-foreground" />{Number(project.contributor_count)}</span></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </AppShell>
  );
}

function Metric({ icon: Icon, label, value, urgent = false }: { icon: typeof Clock3; label: string; value: string; urgent?: boolean }) {
  return (
    <Card className="metric-card border-0 ring-border/80"><CardContent className="flex items-start gap-4"><div className={`grid size-10 place-items-center rounded-xl ${urgent ? 'bg-amber-100 text-amber-700' : 'bg-primary/8 text-primary'}`}><Icon className="size-5" /></div><div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-1 font-heading text-3xl font-bold tracking-tight">{value}</p></div></CardContent></Card>
  );
}
