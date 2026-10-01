'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarSync, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import type { Project } from '@/db/service';

const statuses = ['規劃中', '籌備中', '執行準備', '執行中', '等待客戶', '暫停', '活動完成', '驗收結案'];

export function ProjectUpdateForm({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const project = useMemo(() => projects.find((item) => item.id === projectId), [projectId, projects]);
  const [activityDate, setActivityDate] = useState(project?.activityDate ?? '');
  const [status, setStatus] = useState(project?.status ?? '規劃中');
  const [progressNote, setProgressNote] = useState(project?.progressNote ?? '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function chooseProject(id: string) {
    setProjectId(id);
    const selected = projects.find((item) => item.id === id);
    setActivityDate(selected?.activityDate ?? '');
    setStatus(selected?.status ?? '規劃中');
    setProgressNote(selected?.progressNote ?? '');
    setMessage('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityDate: activityDate || null, status, progressNote }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || '更新失敗。');
      setMessage('已更新，月份配置與近期活動排序會自動調整。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新失敗。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_2fr_auto] lg:items-end">
      <div className="space-y-2"><Label>專案／重要工作</Label><NativeSelect className="w-full" value={projectId} onChange={(event) => chooseProject(event.target.value)}>{projects.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></div>
      <div className="space-y-2"><Label>活動日期</Label><Input type="date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} /></div>
      <div className="space-y-2"><Label>進度狀態</Label><NativeSelect className="w-full" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect></div>
      <div className="space-y-2"><Label>最新進度／客戶待辦</Label><Input value={progressNote} onChange={(event) => setProgressNote(event.target.value)} maxLength={500} placeholder="例：等待客戶確認主視覺第二版" /></div>
      <Button type="submit" disabled={saving || !projectId}><CalendarSync />{saving ? '更新中…' : '更新'}</Button>
      {message && <p className="flex items-center gap-2 text-xs font-medium text-primary lg:col-span-5"><CheckCircle2 className="size-4" />{message}</p>}
    </form>
  );
}
