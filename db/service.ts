import { env } from 'cloudflare:workers';

import type { Viewer } from '@/lib/viewer';

export type Project = {
  id: string;
  name: string;
  client: string;
  activityDate: string | null;
  pmName: string;
  status: string;
  progressNote: string;
  updatedByEmail: string;
};

export type WorkLogInput = {
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

export type WeeklyReportInput = {
  weekStart: string;
  highlights: string;
  blockers: string;
  nextWeekFocus: string;
  entries: WorkLogInput[];
};

type ProjectRow = {
  id: string;
  name: string;
  client: string;
  activity_date: string | null;
  pm_name: string;
  status: string;
  progress_note: string;
  updated_by_email: string;
};

function db() {
  if (!env.DB) throw new Error('Database binding is unavailable.');
  return env.DB;
}

export function ensureDatabase() {
  return Promise.resolve();
}

export async function listProjects(): Promise<Project[]> {
  await ensureDatabase();
  const result = await db().prepare(
    `SELECT id, name, client, activity_date, pm_name, status, progress_note, updated_by_email
     FROM projects ORDER BY CASE WHEN activity_date IS NULL THEN 1 ELSE 0 END, activity_date, name`,
  ).all<ProjectRow>();
  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    client: row.client,
    activityDate: row.activity_date,
    pmName: row.pm_name,
    status: row.status,
    progressNote: row.progress_note,
    updatedByEmail: row.updated_by_email,
  }));
}

export async function updateProject(viewer: Viewer, projectId: string, input: { activityDate: string | null; status: string; progressNote: string }) {
  await ensureDatabase();
  const d1 = db();
  const now = Math.floor(Date.now() / 1000);
  const result = await d1.batch([
    d1.prepare(`UPDATE projects SET activity_date = ?, status = ?, progress_note = ?, updated_by_email = ?, updated_at = ? WHERE id = ?`)
      .bind(input.activityDate, input.status, input.progressNote, viewer.email, now, projectId),
    d1.prepare(`INSERT INTO project_updates (project_id, activity_date, status, progress_note, user_id, user_email, user_name, created_at)
      SELECT id, ?, ?, ?, ?, ?, ?, ? FROM projects WHERE id = ?`)
      .bind(input.activityDate, input.status, input.progressNote, viewer.userId, viewer.email, viewer.displayName, now, projectId),
  ]);
  return result;
}

export async function saveWeeklyReport(viewer: Viewer, input: WeeklyReportInput) {
  await ensureDatabase();
  const d1 = db();
  const reportId = `${viewer.userId}:${input.weekStart}`;
  const now = Math.floor(Date.now() / 1000);
  const statements = [
    d1.prepare(
      `INSERT INTO weekly_reports
       (id, user_id, user_email, user_name, week_start, highlights, blockers, next_week_focus, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, week_start) DO UPDATE SET user_email=excluded.user_email,
         user_name=excluded.user_name, highlights=excluded.highlights, blockers=excluded.blockers,
         next_week_focus=excluded.next_week_focus, updated_at=excluded.updated_at`,
    ).bind(reportId, viewer.userId, viewer.email, viewer.displayName, input.weekStart, input.highlights,
      input.blockers, input.nextWeekFocus, now, now),
    d1.prepare('DELETE FROM work_logs WHERE report_id = ?').bind(reportId),
    ...input.entries.map((entry) => d1.prepare(
      `INSERT INTO work_logs
       (report_id, user_id, user_email, week_start, project_id, task_name, category,
        regular_hours, overtime_hours, overtime_reason, progress, difficulty_type,
        difficulty_note, support_needed, next_week_hours, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(reportId, viewer.userId, viewer.email, input.weekStart, entry.projectId, entry.taskName,
      entry.category, entry.regularHours, entry.overtimeHours, entry.overtimeReason, entry.progress,
      entry.difficultyType, entry.difficultyNote, entry.supportNeeded, entry.nextWeekHours, now)),
  ];
  await d1.batch(statements);
  return reportId;
}

export async function getUserReports(userId: string) {
  await ensureDatabase();
  const result = await db().prepare(
    `SELECT r.id, r.week_start, r.highlights, r.blockers, r.next_week_focus, r.updated_at,
      COALESCE(SUM(w.regular_hours), 0) AS regular_hours,
      COALESCE(SUM(w.overtime_hours), 0) AS overtime_hours,
      COALESCE(SUM(w.next_week_hours), 0) AS next_week_hours,
      COUNT(w.id) AS entry_count
     FROM weekly_reports r LEFT JOIN work_logs w ON w.report_id = r.id
     WHERE r.user_id = ? GROUP BY r.id ORDER BY r.week_start DESC LIMIT 8`,
  ).bind(userId).all<{
    id: string; week_start: string; highlights: string; blockers: string; next_week_focus: string;
    updated_at: number; regular_hours: number; overtime_hours: number; next_week_hours: number; entry_count: number;
  }>();
  return result.results;
}

export async function getProjectStats() {
  await ensureDatabase();
  const result = await db().prepare(
    `SELECT p.id, p.name, p.client, p.activity_date, p.pm_name, p.status, p.progress_note, p.updated_by_email,
      COALESCE(SUM(w.regular_hours), 0) AS regular_hours,
      COALESCE(SUM(w.overtime_hours), 0) AS overtime_hours,
      COALESCE(SUM(w.next_week_hours), 0) AS next_week_hours,
      COUNT(DISTINCT w.user_id) AS contributor_count,
      COUNT(DISTINCT w.report_id) AS report_count
     FROM projects p LEFT JOIN work_logs w ON w.project_id = p.id
     GROUP BY p.id ORDER BY (COALESCE(SUM(w.regular_hours), 0) + COALESCE(SUM(w.overtime_hours), 0)) DESC,
       CASE WHEN p.activity_date IS NULL THEN 1 ELSE 0 END, p.activity_date`,
  ).all<{
    id: string; name: string; client: string; activity_date: string | null; pm_name: string; status: string;
    progress_note: string; updated_by_email: string;
    regular_hours: number; overtime_hours: number; next_week_hours: number; contributor_count: number; report_count: number;
  }>();
  return result.results;
}

export async function getDashboardSummary(weekStart: string) {
  await ensureDatabase();
  const [projects, weekly] = await Promise.all([
    db().prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN activity_date IS NULL THEN 1 ELSE 0 END) AS unscheduled FROM projects`).first<{ total: number; unscheduled: number }>(),
    db().prepare(
      `SELECT COUNT(DISTINCT r.user_id) AS submitted,
       COALESCE(SUM(w.regular_hours), 0) AS regular_hours,
       COALESCE(SUM(w.overtime_hours), 0) AS overtime_hours,
       COALESCE(SUM(CASE WHEN w.difficulty_type != '無' THEN 1 ELSE 0 END), 0) AS difficulties
       FROM weekly_reports r LEFT JOIN work_logs w ON w.report_id = r.id WHERE r.week_start = ?`,
    ).bind(weekStart).first<{ submitted: number; regular_hours: number; overtime_hours: number; difficulties: number }>(),
  ]);
  return {
    totalProjects: Number(projects?.total ?? 0),
    unscheduledProjects: Number(projects?.unscheduled ?? 0),
    submitted: Number(weekly?.submitted ?? 0),
    regularHours: Number(weekly?.regular_hours ?? 0),
    overtimeHours: Number(weekly?.overtime_hours ?? 0),
    difficulties: Number(weekly?.difficulties ?? 0),
  };
}
