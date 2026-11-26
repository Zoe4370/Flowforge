import { describe, expect, it } from 'vitest';
import { dashboardSpecSchema, generateRequestSchema } from '../src/lib/schema.js';
import { synthesizeDashboard } from '../src/lib/localEngine.js';

const kpi = (title: string) => ({ type: 'kpi', title, value: '10' });
const valid = { title: 'Studio pulse', widgets: [kpi('A'), kpi('B'), kpi('C')] };

describe('dashboardSpecSchema', () => {
  it('accepts a minimal valid dashboard', () => {
    expect(dashboardSpecSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects unknown widget types', () => {
    const bad = { ...valid, widgets: [...valid.widgets.slice(0, 2), { type: 'script', title: 'x' }] };
    expect(dashboardSpecSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects extra fields so markup cannot ride along', () => {
    const bad = { ...valid, widgets: [{ ...kpi('A'), html: '<img src=x onerror=alert(1)>' }, kpi('B'), kpi('C')] };
    expect(dashboardSpecSchema.safeParse(bad).success).toBe(false);
  });
  it('enforces 3 to 8 widgets', () => {
    expect(dashboardSpecSchema.safeParse({ ...valid, widgets: valid.widgets.slice(0, 2) }).success).toBe(false);
    expect(dashboardSpecSchema.safeParse({ ...valid, widgets: Array.from({ length: 9 }, (_, i) => kpi(`W${i}`)) }).success).toBe(false);
  });
  it('rejects a progress target of zero', () => {
    const bad = { ...valid, widgets: [{ type: 'progress', title: 'P', current: 1, target: 0 }, kpi('B'), kpi('C')] };
    expect(dashboardSpecSchema.safeParse(bad).success).toBe(false);
  });
});

describe('generateRequestSchema', () => {
  it('requires a goal of at least 4 characters', () => {
    expect(generateRequestSchema.safeParse({ goal: 'hi' }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ goal: 'plan my week' }).success).toBe(true);
  });
  it('caps CSV size at 12,000 characters', () => {
    expect(generateRequestSchema.safeParse({ goal: 'plan my week', sourceData: 'a'.repeat(12_001) }).success).toBe(false);
  });
});

describe('synthesizeDashboard', () => {
  it('refines an existing dashboard in place', () => {
    const initial = synthesizeDashboard('Build a SaaS financial KPI dashboard');
    const refined = synthesizeDashboard('Simplify to 4 widgets and switch chart to cyan', initial);
    expect(refined.widgets.length).toBeLessThanOrEqual(4);
    expect(dashboardSpecSchema.safeParse(refined).success).toBe(true);
  });
});
