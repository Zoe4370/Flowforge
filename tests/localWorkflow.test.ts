import { describe, expect, it } from 'vitest';
import { describeDataProvenance } from '../src/lib/dataProvenance.js';
import { parseCsvSummary, synthesizeDashboard } from '../src/lib/localEngine.js';
import { specToMarkdown } from '../src/lib/markdownExport.js';
import { dashboardSpecSchema } from '../src/lib/schema.js';

const salesCsv = [
  'Month,Revenue,Signups,Channel',
  'Jan,$100,10,Organic',
  'Feb,$200,15,Referral',
  'Mar,$300,25,Organic',
  'Apr,$400,50,Direct',
].join('\n');

describe('parseCsvSummary', () => {
  it('handles a BOM, CRLF, quoted commas, escaped quotes, and embedded line breaks', () => {
    const csv = '\uFEFF"Period","Comment","Amount"\r\n"Jan","He said ""yes, no""",10\r\n"Feb","first line\r\nsecond line",20\r\n';
    const summary = parseCsvSummary(csv);

    expect(summary?.headers).toEqual(['Period', 'Comment', 'Amount']);
    expect(summary?.rows[0]?.Comment).toBe('He said "yes, no"');
    expect(summary?.rows[1]?.Comment).toBe('first line\r\nsecond line');
    expect(summary?.numericColumns).toEqual(['Amount']);
  });

  it('keeps duplicate header columns distinct instead of overwriting values', () => {
    const summary = parseCsvSummary('name,name,score\nA,B,9');

    expect(summary?.headers).toEqual(['name', 'name (2)', 'score']);
    expect(summary?.rows[0]).toEqual({ name: 'A', 'name (2)': 'B', score: '9' });
  });

  it('rejects incomplete or malformed CSV instead of returning partial data', () => {
    expect(parseCsvSummary('name,value')).toBeNull();
    expect(parseCsvSummary('only_one_column\nvalue')).toBeNull();
    expect(parseCsvSummary('name,value\n"unterminated,4')).toBeNull();
    expect(parseCsvSummary('name,value\n"closed"oops,4')).toBeNull();
  });

  it('caps analysis at the first 250 non-empty data rows', () => {
    const csv = ['label,amount', ...Array.from({ length: 260 }, (_, i) => `row-${i + 1},${i + 1}`)].join('\n');

    expect(parseCsvSummary(csv)?.rows).toHaveLength(250);
    expect(parseCsvSummary(csv)?.rows[249]?.label).toBe('row-250');
  });
});

describe('local CSV workspace workflow', () => {
  it('calculates metrics from parsed rows, refines in place, and exports schema-valid JSON and Markdown', () => {
    const initial = synthesizeDashboard('Analyze monthly revenue and signups by channel', undefined, salesCsv);
    const totalRevenue = initial.widgets.find((widget) => widget.type === 'kpi' && widget.title === 'Total Revenue');
    const averageSignups = initial.widgets.find((widget) => widget.type === 'kpi' && widget.title === 'Avg Signups');
    const trend = initial.widgets.find((widget) => widget.type === 'line_chart');
    const channelChart = initial.widgets.find((widget) => widget.type === 'bar_chart');

    expect(dashboardSpecSchema.safeParse(initial).success).toBe(true);
    expect(totalRevenue?.type === 'kpi' && totalRevenue.value).toBe('$1,000');
    expect(averageSignups?.type === 'kpi' && averageSignups.value).toBe('25');
    expect(trend?.type === 'line_chart' ? trend.data.map((point) => point.value) : []).toEqual([100, 200, 300, 400]);
    expect(channelChart?.type === 'bar_chart' ? channelChart.data : []).toEqual([
      { label: 'Organic', value: 35 },
      { label: 'Referral', value: 15 },
      { label: 'Direct', value: 50 },
    ]);

    const refined = synthesizeDashboard('Simplify to 4 widgets and switch chart to cyan', initial, salesCsv);
    expect(refined.widgets).toHaveLength(4);
    expect(dashboardSpecSchema.safeParse(refined).success).toBe(true);
    expect(refined.widgets.some((widget) => widget.type === 'line_chart' && widget.color === 'cyan')).toBe(true);

    const parsedJson = JSON.parse(JSON.stringify(refined)) as unknown;
    expect(dashboardSpecSchema.safeParse(parsedJson).success).toBe(true);

    const provenance = describeDataProvenance({
      sourceData: salesCsv,
      sourceFileName: 'sales.csv',
      engineLabel: 'CSV + Local Engine',
    });
    const markdown = specToMarkdown(refined, 'Analyze monthly revenue and signups by channel', provenance);
    expect(markdown).toContain('## Data provenance');
    expect(markdown).toContain('sales.csv');
    expect(markdown).toContain('not independently verified');
  });

  it('adds a requested checklist at the widget limit without exceeding the schema cap', () => {
    const initial = synthesizeDashboard('Analyze monthly revenue and signups by channel', undefined, salesCsv);
    const refined = synthesizeDashboard('Add an action checklist', initial, salesCsv);

    expect(initial.widgets).toHaveLength(8);
    expect(refined.widgets).toHaveLength(8);
    expect(refined.widgets.some((widget) => widget.type === 'task_list')).toBe(true);
    expect(refined.widgets.some((widget) => widget.type === 'note')).toBe(false);
    expect(dashboardSpecSchema.safeParse(refined).success).toBe(true);
  });
});

describe('data provenance copy', () => {
  it('distinguishes local CSV calculations from model-provided interpretations', () => {
    const local = describeDataProvenance({ sourceData: salesCsv, sourceFileName: 'sales.csv', engineLabel: 'CSV + Local Engine' });
    const model = describeDataProvenance({ sourceData: salesCsv, sourceFileName: 'sales.csv', engineLabel: 'HF · Qwen' });

    expect(local).toContain('4 data rows × 4 columns');
    expect(local).toContain('not independently verified');
    expect(local).toContain('blank and non-numeric cells are excluded');
    expect(model).toContain('supplied to HF · Qwen as context');
    expect(model).toContain('may be estimates');
  });

  it('labels workspaces without a CSV as illustrative rather than measured', () => {
    expect(describeDataProvenance({ sourceData: '', engineLabel: 'Smart Local Engine' })).toContain('not measurements from your records');
  });
});

describe('signed CSV values', () => {
  it('preserves negative amounts in totals and trend charts', () => {
    const csv = 'Month,Net Revenue\nJan,-$100\nFeb,-$50\nMar,-$25';
    const dashboard = synthesizeDashboard('Analyze net revenue', undefined, csv);
    const total = dashboard.widgets.find((widget) => widget.type === 'kpi' && widget.title === 'Total Net Revenue');
    const chart = dashboard.widgets.find((widget) => widget.type === 'line_chart');

    expect(total?.type === 'kpi' && total.value).toBe('-$175');
    expect(chart?.type === 'line_chart' ? chart.data.map((point) => point.value) : []).toEqual([-100, -50, -25]);
    expect(dashboardSpecSchema.safeParse(dashboard).success).toBe(true);
  });

  it('excludes blank and non-numeric cells from calculations and reports numeric coverage', () => {
    const csv = [
      'Period,Revenue,Signups,Channel',
      'Jan,$100,10,Organic',
      'Feb,,not-a-number,Referral',
      'Mar,$300,30,Organic',
      'Apr,,50,Direct',
      'May,$400,40,Partner',
    ].join('\n');
    const dashboard = synthesizeDashboard('Analyze revenue and signups', undefined, csv);
    const totalRevenue = dashboard.widgets.find((widget) => widget.type === 'kpi' && widget.title === 'Total Revenue');
    const averageSignups = dashboard.widgets.find((widget) => widget.type === 'kpi' && widget.title === 'Avg Signups');
    const revenueTrend = dashboard.widgets.find((widget) => widget.type === 'line_chart');
    const analysisNote = dashboard.widgets.find((widget) => widget.type === 'note' && widget.title === 'CSV Analysis Brief');

    expect(totalRevenue?.type === 'kpi' && totalRevenue.value).toBe('$800');
    expect(averageSignups?.type === 'kpi' && averageSignups.value).toBe('32.5');
    expect(averageSignups?.type === 'kpi' && averageSignups.delta).toBe('4/5 rows');
    expect(revenueTrend?.type === 'line_chart' ? revenueTrend.data.map((point) => point.value) : []).toEqual([100, 300, 400]);
    expect(analysisNote?.type === 'note' && analysisNote.body).toContain('3/5 numeric cells');
    expect(analysisNote?.type === 'note' && analysisNote.body).toContain('blank and non-numeric cells are excluded');
    expect(dashboardSpecSchema.safeParse(dashboard).success).toBe(true);
  });
});
