'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { Project } from '@/db/service';
import { difficultyTypes, overtimeReasons, workCategories } from '@/lib/projects';

type Entry = {
  projectId: string;
  taskName: string;
  category: string;
  regularHours: number;
  overtimeHours: number;
  overtimeReason: string;
  progress: string;
  difficultyType: string;
  difficultyNote: string;
  supportNeeded: string;
  nextWeekHours: number;
};

const emptyEntry = (projectId = ''): Entry => ({
  projectId,
  taskName: '',
  category: workCategories[0],
  regularHours: 0,
  overtimeHours: 0,
  overtimeReason: '',
  progress: '',
  difficultyType: '無',
  difficultyNote: '',
  supportNeeded: '',
  nextWeekHours: 0,
});

export function WeeklyReportForm({ projects, weekStart }: { projects: Project[]; weekStart: string }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([emptyEntry(projects[0]?.id)]);
  const [highlights, setHighlights] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextWeekFocus, setNextWeekFocus] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function updateEntry(index: number, patch: Partial<Entry>) {
    setEntries((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const invalid = entries.find((entry) => !entry.projectId || !entry.taskName.trim() || entry.regularHours + entry.overtimeHours <= 0);
    if (invalid) {
      setStatus({ type: 'error', message: '每個工項都需選擇專案、填寫工作內容，且至少有正常或加班工時。' });
      return;
    }
    if (entries.some((entry) => entry.overtimeHours > 0 && !entry.overtimeReason)) {
      setStatus({ type: 'error', message: '有填加班工時的工項，請一併選擇加班原因。' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/weekly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, highlights, blockers, nextWeekFocus, entries }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || '送出失敗，請稍後再試。');
      setStatus({ type: 'success', message: '本週週報已儲存；再次送出會更新同一週資料。' });
      router.refresh();
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : '送出失敗，請稍後再試。' });
    } finally {
      setSaving(false);
    }
  }

  const regularTotal = entries.reduce((sum, entry) => sum + entry.regularHours, 0);
  const overtimeTotal = entries.reduce((sum, entry) => sum + entry.overtimeHours, 0);

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card className="border-0 shadow-[0_14px_40px_rgb(18_42_66/6%)] ring-border/80">
        <CardHeader>
          <CardTitle>本週摘要</CardTitle>
          <CardDescription>先說明成果與卡點，再逐項填入實際投入。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <Field label="本週重要成果">
            <Textarea value={highlights} onChange={(event) => setHighlights(event.target.value)} maxLength={1000} placeholder="完成哪些里程碑、交付或客戶確認？" />
          </Field>
          <Field label="整體卡點／風險">
            <Textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} maxLength={1000} placeholder="有哪些等待、阻礙或需要主管協調？" />
          </Field>
          <Field label="下週工作重點">
            <Textarea value={nextWeekFocus} onChange={(event) => setNextWeekFocus(event.target.value)} maxLength={1000} placeholder="下週最重要的交付與決策節點。" />
          </Field>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {entries.map((entry, index) => (
          <Card key={index} className="border-0 shadow-[0_10px_30px_rgb(18_42_66/5%)] ring-border/80">
            <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/70">
              <div>
                <CardTitle className="text-base">工項 {index + 1}</CardTitle>
                <CardDescription>工作內容與工時會彙總到對應專案。</CardDescription>
              </div>
              {entries.length > 1 && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`刪除工項 ${index + 1}`} onClick={() => setEntries((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 pt-1 md:grid-cols-2 xl:grid-cols-4">
              <Field label="專案 *" className="xl:col-span-2">
                <NativeSelect className="w-full" value={entry.projectId} onChange={(event) => updateEntry(index, { projectId: event.target.value })}>
                  <NativeSelectOption value="">選擇專案</NativeSelectOption>
                  {projects.map((project) => <NativeSelectOption key={project.id} value={project.id}>{project.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field label="工作類別 *">
                <NativeSelect className="w-full" value={entry.category} onChange={(event) => updateEntry(index, { category: event.target.value })}>
                  {workCategories.map((category) => <NativeSelectOption key={category} value={category}>{category}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field label="完成進度">
                <Input value={entry.progress} onChange={(event) => updateEntry(index, { progress: event.target.value })} maxLength={100} placeholder="例：已完成 80%" />
              </Field>
              <Field label="投入工作內容 *" className="md:col-span-2 xl:col-span-4">
                <Input value={entry.taskName} onChange={(event) => updateEntry(index, { taskName: event.target.value })} maxLength={200} placeholder="例：完成議程定稿與三位講者確認" />
              </Field>
              <Field label="正常工時">
                <Input type="number" min={0} max={80} step={0.5} value={entry.regularHours || ''} placeholder="0" onChange={(event) => updateEntry(index, { regularHours: Number(event.target.value) })} />
              </Field>
              <Field label="加班工時">
                <Input type="number" min={0} max={40} step={0.5} value={entry.overtimeHours || ''} placeholder="0" onChange={(event) => updateEntry(index, { overtimeHours: Number(event.target.value) })} />
              </Field>
              <Field label="加班原因">
                <NativeSelect className="w-full" value={entry.overtimeReason} onChange={(event) => updateEntry(index, { overtimeReason: event.target.value })}>
                  <NativeSelectOption value="">{entry.overtimeHours > 0 ? '必填：選擇原因' : '無加班'}</NativeSelectOption>
                  {overtimeReasons.map((reason) => <NativeSelectOption key={reason} value={reason}>{reason}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field label="下週預估工時">
                <Input type="number" min={0} max={80} step={0.5} value={entry.nextWeekHours || ''} placeholder="0" onChange={(event) => updateEntry(index, { nextWeekHours: Number(event.target.value) })} />
              </Field>
              <Field label="困難類型">
                <NativeSelect className="w-full" value={entry.difficultyType} onChange={(event) => updateEntry(index, { difficultyType: event.target.value })}>
                  {difficultyTypes.map((type) => <NativeSelectOption key={type} value={type}>{type}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field label="困難說明" className="md:col-span-1 xl:col-span-2">
                <Input value={entry.difficultyNote} onChange={(event) => updateEntry(index, { difficultyNote: event.target.value })} maxLength={500} placeholder="卡在哪裡、影響什麼？" />
              </Field>
              <Field label="需要的協助">
                <Input value={entry.supportNeeded} onChange={(event) => updateEntry(index, { supportNeeded: event.target.value })} maxLength={500} placeholder="需要誰在何時協助？" />
              </Field>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={() => setEntries((current) => [...current, emptyEntry(projects[0]?.id)])}>
        <Plus />新增工項
      </Button>

      <Card className="border-primary/20 bg-primary/[.045]">
        <CardContent className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">本週合計：正常 {regularTotal} 小時、加班 {overtimeTotal} 小時</p>
            <p className="mt-1 text-xs text-muted-foreground">送出時會自動記錄目前登入者與更新時間。</p>
          </div>
          <Button type="submit" size="lg" disabled={saving} className="sm:min-w-36">
            <Save />{saving ? '儲存中…' : '儲存週報'}
          </Button>
        </CardContent>
      </Card>

      {status && (
        <div role="status" className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {status.type === 'success' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          {status.message}
        </div>
      )}
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
