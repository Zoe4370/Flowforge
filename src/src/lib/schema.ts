import { z } from 'zod';

const title = z.string().trim().min(1).max(48);
const chartPoint = z.object({ label: z.string().trim().min(1).max(24), value: z.number().finite().min(0).max(1_000_000_000) }).strict();

export const widgetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('kpi'), title, value: z.string().trim().min(1).max(36), delta: z.string().max(24).optional(), trend: z.enum(['up', 'down', 'flat']).optional(), icon: z.enum(['activity', 'wallet', 'users', 'target', 'clock', 'sparkles', 'check', 'layers']).optional() }).strict(),
  z.object({ type: z.literal('line_chart'), title, data: z.array(chartPoint).min(3).max(12), color: z.enum(['lime', 'cyan', 'violet']).optional() }).strict(),
  z.object({ type: z.literal('bar_chart'), title, data: z.array(chartPoint).min(3).max(12) }).strict(),
  z.object({ type: z.literal('table'), title, columns: z.array(z.object({ key: z.string().trim().min(1).max(24), label: z.string().trim().min(1).max(28) }).strict()).min(2).max(5), rows: z.array(z.record(z.string(), z.union([z.string().max(80), z.number().finite()]))).min(2).max(8) }).strict(),
  z.object({ type: z.literal('task_list'), title, items: z.array(z.object({ label: z.string().trim().min(1).max(96), done: z.boolean() }).strict()).min(2).max(8) }).strict(),
  z.object({ type: z.literal('progress'), title, current: z.number().finite().min(0).max(1_000_000_000), target: z.number().finite().gt(0).max(1_000_000_000), unit: z.string().max(18).optional() }).strict(),
  z.object({ type: z.literal('note'), title, body: z.string().trim().min(1).max(500) }).strict(),
  z.object({ type: z.literal('calendar'), title, events: z.array(z.object({ date: z.string().trim().min(1).max(32), label: z.string().trim().min(1).max(72) }).strict()).min(2).max(7) }).strict(),
]);

export const dashboardSpecSchema = z.object({
  title: z.string().trim().min(2).max(48),
  subtitle: z.string().trim().max(120).optional(),
  widgets: z.array(widgetSchema).min(3).max(8),
}).strict();

export const generateRequestSchema = z.object({
  goal: z.string().trim().min(4).max(500),
  current: dashboardSpecSchema.optional(),
  sourceData: z.string().max(12_000).optional(),
}).strict();

export type Widget = z.infer<typeof widgetSchema>;
export type DashboardSpec = z.infer<typeof dashboardSpecSchema>;
