import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  client: text('client').notNull().default(''),
  activityDate: text('activity_date'),
  pmName: text('pm_name').notNull(),
  status: text('status').notNull().default('進行中'),
  createdAt: integer('created_at').notNull(),
});

export const weeklyReports = sqliteTable(
  'weekly_reports',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    userEmail: text('user_email').notNull(),
    userName: text('user_name').notNull(),
    weekStart: text('week_start').notNull(),
    highlights: text('highlights').notNull().default(''),
    blockers: text('blockers').notNull().default(''),
    nextWeekFocus: text('next_week_focus').notNull().default(''),
    submittedAt: integer('submitted_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_weekly_reports_user_week').on(table.userId, table.weekStart),
    index('idx_weekly_reports_week').on(table.weekStart),
  ],
);

export const workLogs = sqliteTable(
  'work_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    reportId: text('report_id').notNull().references(() => weeklyReports.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    userEmail: text('user_email').notNull(),
    weekStart: text('week_start').notNull(),
    projectId: text('project_id').notNull().references(() => projects.id),
    taskName: text('task_name').notNull(),
    category: text('category').notNull(),
    regularHours: real('regular_hours').notNull().default(0),
    overtimeHours: real('overtime_hours').notNull().default(0),
    overtimeReason: text('overtime_reason').notNull().default(''),
    progress: text('progress').notNull().default(''),
    difficultyType: text('difficulty_type').notNull().default('無'),
    difficultyNote: text('difficulty_note').notNull().default(''),
    supportNeeded: text('support_needed').notNull().default(''),
    nextWeekHours: real('next_week_hours').notNull().default(0),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_work_logs_project_week').on(table.projectId, table.weekStart),
    index('idx_work_logs_user_week').on(table.userId, table.weekStart),
    index('idx_work_logs_report').on(table.reportId),
  ],
);
