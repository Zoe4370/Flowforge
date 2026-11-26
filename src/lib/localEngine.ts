import { dashboardSpecSchema, type DashboardSpec, type Widget } from './schema.js';

export type CsvSummary = {
  headers: string[];
  rows: Record<string, string>[];
  numericColumns: string[];
  labelColumn: string;
  categoryColumn: string | null;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function parseNumeric(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[$€£¥,\s%]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function clampLabel(text: string, max = 24): string {
  const clean = text.trim() || 'Item';
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function clampStr(text: string, max: number): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function formatMetric(value: number, sampleRaw?: string): string {
  const hasDollar = sampleRaw?.includes('$');
  const hasEuro = sampleRaw?.includes('€');
  const hasPound = sampleRaw?.includes('£');
  const hasPct = sampleRaw?.includes('%');
  const prefix = hasDollar ? '$' : hasEuro ? '€' : hasPound ? '£' : '';
  const suffix = hasPct ? '%' : '';
  const abs = Math.abs(value);
  const formatted = abs >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)}M`
    : abs >= 10_000
      ? `${(value / 1_000).toFixed(1)}k`
      : Number.isInteger(value)
        ? value.toLocaleString('en-US')
        : value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return clampStr(`${prefix}${formatted}${suffix}`, 36);
}

export function parseCsvSummary(csvText: string): CsvSummary | null {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const rawHeaders = splitCsvLine(lines[0]);
  if (rawHeaders.length < 2) return null;

  const headers = rawHeaders.map((h, i) => clampStr(h || `Column ${i + 1}`, 24));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length && rows.length < 250; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  if (rows.length < 1) return null;

  const numericColumns = headers.filter((h) => {
    const validCount = rows.reduce((acc, r) => acc + (parseNumeric(r[h] ?? '') !== null ? 1 : 0), 0);
    return validCount >= Math.max(1, Math.floor(rows.length * 0.6));
  });

  const nonNumeric = headers.filter((h) => !numericColumns.includes(h));
  const labelColumn = nonNumeric[0] ?? headers[0];
  const categoryColumn = nonNumeric.length > 1 ? nonNumeric[1] : null;

  return { headers, rows, numericColumns, labelColumn, categoryColumn };
}

function buildFromCsv(goal: string, summary: CsvSummary): DashboardSpec {
  const { headers, rows, numericColumns, labelColumn, categoryColumn } = summary;
  const primaryCol = numericColumns[0];
  const secondaryCol = numericColumns[1];
  const tertiaryCol = numericColumns[2];

  const widgets: Widget[] = [];
  const sampleRawPrimary = primaryCol ? rows[0]?.[primaryCol] : undefined;

  if (primaryCol) {
    const vals = rows.map((r) => Math.max(0, parseNumeric(r[primaryCol] ?? '') ?? 0));
    const total = vals.reduce((a, b) => a + b, 0);
    const avg = vals.length ? total / vals.length : 0;
    const first = vals[0] ?? 0;
    const last = vals[vals.length - 1] ?? 0;
    const pctChange = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

    widgets.push({
      type: 'kpi',
      title: clampStr(`Total ${primaryCol}`, 48),
      value: formatMetric(total, sampleRawPrimary),
      delta: `${pctChange >= 0 ? '+' : ''}${pctChange}% span`,
      trend: pctChange > 0 ? 'up' : pctChange < 0 ? 'down' : 'flat',
      icon: sampleRawPrimary?.includes('$') ? 'wallet' : 'activity',
    });

    if (secondaryCol) {
      const vals2 = rows.map((r) => Math.max(0, parseNumeric(r[secondaryCol] ?? '') ?? 0));
      const total2 = vals2.reduce((a, b) => a + b, 0);
      const avg2 = vals2.length ? total2 / vals2.length : 0;
      const sampleRaw2 = rows[0]?.[secondaryCol];
      widgets.push({
        type: 'kpi',
        title: clampStr(`Avg ${secondaryCol}`, 48),
        value: formatMetric(avg2, sampleRaw2),
        delta: `${rows.length} rows`,
        trend: 'flat',
        icon: 'target',
      });
    } else {
      widgets.push({
        type: 'kpi',
        title: clampStr(`Average ${primaryCol}`, 48),
        value: formatMetric(avg, sampleRawPrimary),
        delta: `${rows.length} records`,
        trend: 'flat',
        icon: 'target',
      });
    }

    if (tertiaryCol) {
      const vals3 = rows.map((r) => Math.max(0, parseNumeric(r[tertiaryCol] ?? '') ?? 0));
      const total3 = vals3.reduce((a, b) => a + b, 0);
      widgets.push({
        type: 'kpi',
        title: clampStr(`Total ${tertiaryCol}`, 48),
        value: formatMetric(total3, rows[0]?.[tertiaryCol]),
        delta: 'CSV verified',
        trend: 'up',
        icon: 'layers',
      });
    } else {
      const peak = Math.max(...vals);
      const peakIdx = vals.indexOf(peak);
      widgets.push({
        type: 'kpi',
        title: clampStr(`Peak ${primaryCol}`, 48),
        value: formatMetric(peak, sampleRawPrimary),
        delta: clampStr(rows[peakIdx]?.[labelColumn] || 'Peak', 24),
        trend: 'up',
        icon: 'sparkles',
      });
    }

    if (rows.length >= 3) {
      const chartRows = rows.slice(0, 12);
      widgets.push({
        type: 'line_chart',
        title: clampStr(`${primaryCol} across ${labelColumn}`, 48),
        color: 'lime',
        data: chartRows.map((r, idx) => ({
          label: clampLabel(r[labelColumn] || `#${idx + 1}`, 24),
          value: Math.max(0, parseNumeric(r[primaryCol] ?? '') ?? 0),
        })),
      });
    }

    const barSourceCol = secondaryCol ?? primaryCol;
    if (categoryColumn && rows.length >= 3) {
      const grouped = new Map<string, number>();
      for (const r of rows) {
        const key = clampLabel(r[categoryColumn] || 'Other', 24);
        const val = Math.max(0, parseNumeric(r[barSourceCol] ?? '') ?? 0);
        grouped.set(key, (grouped.get(key) ?? 0) + val);
      }
      const entries = [...grouped.entries()].slice(0, 8);
      if (entries.length >= 3) {
        widgets.push({
          type: 'bar_chart',
          title: clampStr(`${barSourceCol} by ${categoryColumn}`, 48),
          data: entries.map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 })),
        });
      }
    } else if (secondaryCol && rows.length >= 3) {
      widgets.push({
        type: 'bar_chart',
        title: clampStr(`${secondaryCol} comparison`, 48),
        data: rows.slice(0, 10).map((r, idx) => ({
          label: clampLabel(r[labelColumn] || `#${idx + 1}`, 24),
          value: Math.max(0, parseNumeric(r[secondaryCol] ?? '') ?? 0),
        })),
      });
    }
  } else {
    widgets.push(
      { type: 'kpi', title: 'Total Rows', value: String(rows.length), delta: 'Parsed CSV', trend: 'up', icon: 'layers' },
      { type: 'kpi', title: 'Columns Detected', value: String(headers.length), delta: 'Schema clean', trend: 'flat', icon: 'check' },
      { type: 'kpi', title: 'Primary Dimension', value: clampStr(labelColumn, 36), delta: 'Indexed', trend: 'up', icon: 'sparkles' },
    );
  }

  const displayCols = headers.slice(0, 5).map((h, i) => ({
    key: `c${i}`,
    label: clampStr(h, 28),
  }));
  if (displayCols.length >= 2 && rows.length >= 2) {
    widgets.push({
      type: 'table',
      title: 'Uploaded CSV Breakdown',
      columns: displayCols,
      rows: rows.slice(0, 8).map((r) => {
        const obj: Record<string, string | number> = {};
        headers.slice(0, 5).forEach((h, i) => {
          const raw = r[h] ?? '';
          const num = parseNumeric(raw);
          obj[`c${i}`] = num !== null && !raw.includes('$') && !raw.includes('%') ? num : clampStr(raw || '—', 80);
        });
        return obj;
      }),
    });
  }

  if (primaryCol && widgets.length < 8) {
    const vals = rows.map((r) => Math.max(0, parseNumeric(r[primaryCol] ?? '') ?? 0));
    const total = vals.reduce((a, b) => a + b, 0);
    const target = Math.max(1, Math.round(total * 1.2));
    widgets.push({
      type: 'progress',
      title: clampStr(`${primaryCol} Stretch Target`, 48),
      current: Math.round(total),
      target,
      unit: sampleRawPrimary?.includes('$') ? 'USD' : '',
    });
  }

  if (widgets.length < 8) {
    const summaryText = primaryCol
      ? `Analyzed ${rows.length} CSV rows across ${headers.length} columns (${headers.join(', ')}). Primary metric "${primaryCol}" shows real computed totals, averages, and period comparisons directly from your file.`
      : `Loaded ${rows.length} rows across ${headers.length} columns. Add a numeric column to unlock live trend charts and aggregations.`;
    widgets.push({
      type: 'note',
      title: 'CSV Analysis Brief',
      body: clampStr(summaryText, 500),
    });
  }

  const finalWidgets = widgets.slice(0, 8);
  while (finalWidgets.length < 3) {
    finalWidgets.push({
      type: 'task_list',
      title: 'Next Data Checks',
      items: [
        { label: `Verify ${labelColumn} entries against source`, done: true },
        { label: `Review ${primaryCol ?? headers[0]} outliers`, done: false },
      ],
    });
  }

  return dashboardSpecSchema.parse({
    title: clampStr(goal.length > 42 ? `${primaryCol ?? labelColumn} CSV Workspace` : goal, 48),
    subtitle: clampStr(`Computed live from ${rows.length} rows and ${headers.length} columns in your uploaded CSV.`, 120),
    widgets: finalWidgets,
  });
}

function extractTopicLabel(goal: string): string {
  const cleaned = goal
    .replace(/^(build|create|make|design|generate|help me|give me|track|manage)\s+(a|an|my|the)?\s*/i, '')
    .replace(/dashboard|workspace|tracker|planner|for\s+my|for\s+a|in\s+one\s+place/gi, '')
    .replace(/[^\w\s&/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Custom Workspace';
  const words = cleaned.split(' ').slice(0, 4).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return clampStr(words.join(' '), 48);
}

function buildDomainSpec(goal: string): DashboardSpec {
  const g = goal.toLowerCase();

  if (/(seo|similarweb|traffic|search|keyword|organic|marketing|campaign|funnel|conversion|growth|ad\b|social)/.test(g)) {
    return dashboardSpecSchema.parse({
      title: 'Growth, Traffic & AI SEO Pulse',
      subtitle: 'Channel acquisition velocity, organic share, conversion lift, and campaign execution.',
      widgets: [
        { type: 'kpi', title: 'Monthly Organic Visits', value: '148.4k', delta: '+24.6%', trend: 'up', icon: 'users' },
        { type: 'kpi', title: 'Conversion Rate', value: '4.38%', delta: '+0.8%', trend: 'up', icon: 'target' },
        { type: 'kpi', title: 'Avg. Engagement Time', value: '3m 42s', delta: '+18s', trend: 'up', icon: 'clock' },
        {
          type: 'line_chart',
          title: 'Organic + AI Referral Traffic',
          color: 'cyan',
          data: [
            { label: 'Jun', value: 78400 },
            { label: 'Jul', value: 89200 },
            { label: 'Aug', value: 101500 },
            { label: 'Sep', value: 118900 },
            { label: 'Oct', value: 132400 },
            { label: 'Nov', value: 148400 },
          ],
        },
        {
          type: 'bar_chart',
          title: 'Signups by Acquisition Channel',
          data: [
            { label: 'Organic SEO', value: 1840 },
            { label: 'AI Search', value: 920 },
            { label: 'Product Hunt', value: 760 },
            { label: 'YouTube', value: 640 },
            { label: 'Referral', value: 510 },
          ],
        },
        {
          type: 'table',
          title: 'Top Performing Landing Pages',
          columns: [
            { key: 'page', label: 'Page / Cluster' },
            { key: 'intent', label: 'Stage' },
            { key: 'visits', label: 'Visits' },
            { key: 'cvr', label: 'CVR' },
          ],
          rows: [
            { page: '/prompt-to-dashboard', intent: 'High Intent', visits: 42800, cvr: '5.9%' },
            { page: '/csv-kpi-generator', intent: 'Solution', visits: 31400, cvr: '4.8%' },
            { page: '/ai-workspace-templates', intent: 'Discovery', visits: 26900, cvr: '3.2%' },
            { page: '/vs-static-bi-tools', intent: 'Comparison', visits: 18200, cvr: '6.4%' },
          ],
        },
        { type: 'progress', title: 'Q4 Qualified Lead Goal', current: 4670, target: 6000, unit: 'leads' },
        {
          type: 'task_list',
          title: 'Campaign & SEO Priorities',
          items: [
            { label: 'Ship JSON-LD schema & comparison clusters', done: true },
            { label: 'Launch interactive CSV benchmark magnet', done: true },
            { label: 'A/B test hero CTA psychological framing', done: false },
            { label: 'Publish AI Prompt Wars product video', done: false },
          ],
        },
      ],
    });
  }

  if (/(finance|financial|saas|mrr|arr|revenue|burn|budget|cac|ltv|profit|expense|cash|startup|investor|kpi)/.test(g)) {
    return dashboardSpecSchema.parse({
      title: 'Financial & SaaS KPI Command',
      subtitle: 'Recurring revenue momentum, unit economics, burn efficiency, and runway targets.',
      widgets: [
        { type: 'kpi', title: 'Monthly Recurring Rev', value: '$84,200', delta: '+19.4%', trend: 'up', icon: 'wallet' },
        { type: 'kpi', title: 'Net Dollar Retention', value: '118%', delta: '+4.2%', trend: 'up', icon: 'activity' },
        { type: 'kpi', title: 'LTV : CAC Ratio', value: '4.6x', delta: 'Healthy', trend: 'up', icon: 'target' },
        {
          type: 'line_chart',
          title: 'MRR Growth Trajectory ($)',
          color: 'lime',
          data: [
            { label: 'Jun', value: 49200 },
            { label: 'Jul', value: 55800 },
            { label: 'Aug', value: 62400 },
            { label: 'Sep', value: 70900 },
            { label: 'Oct', value: 76500 },
            { label: 'Nov', value: 84200 },
          ],
        },
        {
          type: 'bar_chart',
          title: 'Operating Spend Breakdown ($)',
          data: [
            { label: 'R&D / Infra', value: 18400 },
            { label: 'Growth', value: 11200 },
            { label: 'Ops', value: 6800 },
            { label: 'AI Tokens', value: 3900 },
          ],
        },
        {
          type: 'table',
          title: 'Revenue Segment Breakdown',
          columns: [
            { key: 'tier', label: 'Plan Tier' },
            { key: 'status', label: 'Momentum' },
            { key: 'accounts', label: 'Accounts' },
            { key: 'mrr', label: 'MRR' },
          ],
          rows: [
            { tier: 'Enterprise Annual', status: 'Expanding', accounts: 14, mrr: '$38,500' },
            { tier: 'Pro Team', status: 'Core', accounts: 192, mrr: '$32,640' },
            { tier: 'Starter Plus', status: 'Steady', accounts: 435, mrr: '$13,060' },
          ],
        },
        { type: 'progress', title: 'Q4 ARR Milestone ($1.2M)', current: 1010400, target: 1200000, unit: 'USD' },
        {
          type: 'note',
          title: 'CFO Executive Summary',
          body: 'Gross margin stands at 81.4% with 18.5 months of runway. Enterprise annual upgrades drove 62% of net new ARR this quarter while AI inference cost per workspace dropped 28%.',
        },
      ],
    });
  }

  if (/(freelance|studio|client|agency|invoice|retainer|design)/.test(g)) {
    return dashboardSpecSchema.parse({
      title: 'Freelance Studio Operations',
      subtitle: 'Monthly retainers, active client deliverables, billable utilization, and milestones.',
      widgets: [
        { type: 'kpi', title: 'Monthly Revenue', value: '$14,800', delta: '+16%', trend: 'up', icon: 'wallet' },
        { type: 'kpi', title: 'Active Retainers', value: '5 clients', delta: '+1 new', trend: 'up', icon: 'users' },
        { type: 'kpi', title: 'Billable Utilization', value: '82%', delta: '33h / wk', trend: 'flat', icon: 'clock' },
        {
          type: 'line_chart',
          title: '6-Month Studio Billings ($)',
          color: 'lime',
          data: [
            { label: 'Jun', value: 9800 },
            { label: 'Jul', value: 11200 },
            { label: 'Aug', value: 10900 },
            { label: 'Sep', value: 12600 },
            { label: 'Oct', value: 13400 },
            { label: 'Nov', value: 14800 },
          ],
        },
        {
          type: 'table',
          title: 'Active Client Pipeline',
          columns: [
            { key: 'client', label: 'Client' },
            { key: 'stage', label: 'Stage' },
            { key: 'value', label: 'Value' },
          ],
          rows: [
            { client: 'Northstar AI', stage: 'Design Sprint', value: '$4,800' },
            { client: 'Kestrel Labs', stage: 'Final Review', value: '$3,600' },
            { client: 'Verve Commerce', stage: 'Retainer', value: '$3,200' },
            { client: 'Lumen Health', stage: 'Proposal', value: '$3,200' },
          ],
        },
        { type: 'progress', title: 'Quarterly Revenue Goal', current: 40800, target: 45000, unit: 'USD' },
        {
          type: 'task_list',
          title: 'Next Studio Actions',
          items: [
            { label: 'Send interactive prototype to Northstar AI', done: true },
            { label: 'Issue November milestone invoice to Kestrel', done: false },
            { label: 'Finalize Lumen Health scope & deposit link', done: false },
            { label: 'Update case study reel for Q1 inbound', done: false },
          ],
        },
        {
          type: 'calendar',
          title: 'Upcoming Deadlines',
          events: [
            { date: 'Nov 28', label: 'Kestrel Labs handoff call' },
            { date: 'Dec 02', label: 'Northstar UI design review' },
            { date: 'Dec 06', label: 'Monthly tax & invoice reconciliation' },
          ],
        },
      ],
    });
  }

  if (/(study|exam|student|school|revision|homework|course|math|science|learn)/.test(g)) {
    return dashboardSpecSchema.parse({
      title: 'Weekly Study & Exam Planner',
      subtitle: 'Focused deep-work blocks, subject balance, practice scores, and upcoming exams.',
      widgets: [
        { type: 'kpi', title: 'Weekly Study Hours', value: '24.5 hrs', delta: '+3.5 hrs', trend: 'up', icon: 'clock' },
        { type: 'kpi', title: 'Practice Test Avg', value: '88%', delta: '+6% lift', trend: 'up', icon: 'target' },
        { type: 'kpi', title: 'Streak & Focus', value: '11 days', delta: 'On track', trend: 'up', icon: 'sparkles' },
        {
          type: 'bar_chart',
          title: 'Hours by Subject',
          data: [
            { label: 'Maths', value: 8.5 },
            { label: 'Physics', value: 6.5 },
            { label: 'Chemistry', value: 5.0 },
            { label: 'CS / Code', value: 4.5 },
          ],
        },
        {
          type: 'line_chart',
          title: 'Mock Exam Score Trend (%)',
          color: 'violet',
          data: [
            { label: 'Wk 1', value: 74 },
            { label: 'Wk 2', value: 79 },
            { label: 'Wk 3', value: 82 },
            { label: 'Wk 4', value: 85 },
            { label: 'Wk 5', value: 88 },
          ],
        },
        { type: 'progress', title: 'Syllabus Chapters Mastered', current: 18, target: 24, unit: 'topics' },
        {
          type: 'task_list',
          title: 'This Week’s Revision Checklist',
          items: [
            { label: 'Complete 2 timed calculus past papers', done: true },
            { label: 'Summarize organic reaction mechanisms', done: false },
            { label: 'Review electromagnetism flashcards (30m)', done: false },
            { label: 'Take full rest block Sunday afternoon', done: false },
          ],
        },
        {
          type: 'calendar',
          title: 'Exam & Lab Schedule',
          events: [
            { date: 'Mon 16:00', label: 'Maths Problem Set Clinic' },
            { date: 'Wed 14:00', label: 'Science Mock Quiz' },
            { date: 'Fri 10:00', label: 'Weekly Review & Reset' },
          ],
        },
      ],
    });
  }

  if (/(health|wellness|habit|sleep|water|fitness|workout|run|gym|steps)/.test(g)) {
    return dashboardSpecSchema.parse({
      title: 'Daily Wellness & Habit Pulse',
      subtitle: 'Consistent movement, restorative sleep, hydration, and balanced weekly recovery.',
      widgets: [
        { type: 'kpi', title: 'Daily Movement', value: '8,940', delta: '+1,200 steps', trend: 'up', icon: 'activity' },
        { type: 'kpi', title: 'Avg Nightly Sleep', value: '7h 42m', delta: '+28 min', trend: 'up', icon: 'clock' },
        { type: 'kpi', title: 'Hydration Streak', value: '9 days', delta: '2.4L / day', trend: 'up', icon: 'sparkles' },
        {
          type: 'line_chart',
          title: 'Weekly Active Minutes',
          color: 'lime',
          data: [
            { label: 'Mon', value: 42 },
            { label: 'Tue', value: 35 },
            { label: 'Wed', value: 54 },
            { label: 'Thu', value: 40 },
            { label: 'Fri', value: 60 },
            { label: 'Sat', value: 75 },
            { label: 'Sun', value: 38 },
          ],
        },
        {
          type: 'bar_chart',
          title: 'Sleep Quality Score by Day',
          data: [
            { label: 'Mon', value: 81 },
            { label: 'Tue', value: 78 },
            { label: 'Wed', value: 86 },
            { label: 'Thu', value: 84 },
            { label: 'Fri', value: 88 },
          ],
        },
        { type: 'progress', title: 'Weekly Zone-2 Cardio Goal', current: 185, target: 220, unit: 'mins' },
        {
          type: 'task_list',
          title: 'Daily Non-Negotiables',
          items: [
            { label: 'Morning 500ml water + sunlight walk', done: true },
            { label: '10-minute mobility & posture reset', done: true },
            { label: '25-minute brisk walk or strength session', done: false },
            { label: 'Screens off 45 mins before bedtime', done: false },
          ],
        },
        {
          type: 'note',
          title: 'Coach Guidance',
          body: 'Small repeatable wins beat high-intensity burnout. Keep hydration steady before noon and protect your wind-down window on weeknights.',
        },
      ],
    });
  }

  // Dynamic Custom Domain Synthesizer for ANY arbitrary goal!
  const topic = extractTopicLabel(goal);
  return dashboardSpecSchema.parse({
    title: topic,
    subtitle: clampStr(`Interactive workspace shaped around: ${goal}`, 120),
    widgets: [
      { type: 'kpi', title: `${clampStr(topic, 34)} Velocity`, value: '92.4%', delta: '+14.2%', trend: 'up', icon: 'activity' },
      { type: 'kpi', title: 'Active Workstreams', value: '6 active', delta: '2 high priority', trend: 'up', icon: 'layers' },
      { type: 'kpi', title: 'Target Completion', value: '74%', delta: 'Ahead of pace', trend: 'up', icon: 'target' },
      {
        type: 'line_chart',
        title: `${clampStr(topic, 30)} Momentum`,
        color: 'lime',
        data: [
          { label: 'Wk 1', value: 38 },
          { label: 'Wk 2', value: 49 },
          { label: 'Wk 3', value: 61 },
          { label: 'Wk 4', value: 74 },
          { label: 'Wk 5', value: 86 },
          { label: 'Wk 6', value: 94 },
        ],
      },
      {
        type: 'bar_chart',
        title: 'Impact by Focus Area',
        data: [
          { label: 'Execution', value: 88 },
          { label: 'Quality', value: 94 },
          { label: 'Speed', value: 79 },
          { label: 'Reach', value: 83 },
        ],
      },
      {
        type: 'table',
        title: `${clampStr(topic, 30)} Breakdown`,
        columns: [
          { key: 'stream', label: 'Workstream' },
          { key: 'status', label: 'Status' },
          { key: 'impact', label: 'Impact' },
        ],
        rows: [
          { stream: 'Core Foundation', status: 'Live', impact: 'High' },
          { stream: 'Data & Validation', status: 'In Progress', impact: 'High' },
          { stream: 'Automation Loop', status: 'Planned', impact: 'Medium' },
          { stream: 'Review & Polish', status: 'Ready', impact: 'High' },
        ],
      },
      { type: 'progress', title: 'Milestone Completion', current: 74, target: 100, unit: '%' },
      {
        type: 'task_list',
        title: 'Immediate Next Steps',
        items: [
          { label: `Define core success metric for ${clampStr(topic, 40)}`, done: true },
          { label: 'Validate data inputs & edge cases', done: false },
          { label: 'Ship primary milestone & gather feedback', done: false },
        ],
      },
    ],
  });
}

function refineSpec(goal: string, current: DashboardSpec, sourceData?: string): DashboardSpec {
  const g = goal.toLowerCase();
  let widgets = [...current.widgets];
  let title = current.title;
  let subtitle = current.subtitle;

  const titleMatch = goal.match(/(?:rename|title(?:\s+to)?|call\s+it)\s+["']?([^"'\n]{2,46})["']?/i);
  if (titleMatch?.[1]) {
    title = clampStr(titleMatch[1], 48);
  }

  // Color preference for line charts
  const colorMatch = g.includes('cyan') ? 'cyan' : g.includes('violet') || g.includes('purple') ? 'violet' : g.includes('lime') ? 'lime' : null;
  if (colorMatch) {
    widgets = widgets.map((w) => (w.type === 'line_chart' ? { ...w, color: colorMatch } : w));
  }

  // Remove requests
  if (/(remove|drop|hide|delete)\s+(the\s+)?calendar/.test(g)) widgets = widgets.filter((w) => w.type !== 'calendar');
  if (/(remove|drop|hide|delete)\s+(the\s+)?note/.test(g)) widgets = widgets.filter((w) => w.type !== 'note');
  if (/(remove|drop|hide|delete)\s+(the\s+)?table/.test(g)) widgets = widgets.filter((w) => w.type !== 'table');
  if (/(remove|drop|hide|delete)\s+(the\s+)?progress/.test(g)) widgets = widgets.filter((w) => w.type !== 'progress');
  if (/(remove|drop|hide|delete)\s+(the\s+)?bar/.test(g)) widgets = widgets.filter((w) => w.type !== 'bar_chart');

  // Simplify request
  if (/(simplify|minimal|compact|cleaner|fewer)/.test(g) && widgets.length > 4) {
    widgets = widgets.slice(0, 4);
    subtitle = clampStr('Streamlined view focused on your highest-signal metrics.', 120);
  }

  // Add task item explicitly
  const taskMatch = goal.match(/add\s+(?:a\s+)?task(?:\s+to|\s+for|:)?\s+(.+)/i);
  if (taskMatch?.[1]) {
    const label = clampStr(taskMatch[1], 96);
    const existingIdx = widgets.findIndex((w) => w.type === 'task_list');
    if (existingIdx >= 0) {
      const targetWidget = widgets[existingIdx];
      if (targetWidget.type === 'task_list') {
        widgets[existingIdx] = {
          ...targetWidget,
          items: [...targetWidget.items.slice(0, 7), { label, done: false }],
        };
      }
    } else if (widgets.length < 8) {
      widgets.push({
        type: 'task_list',
        title: 'Action Checklist',
        items: [
          { label, done: false },
          { label: 'Review next milestone', done: false },
        ],
      });
    }
  }

  // Add chart / KPI / table / calendar / note / progress
  if (/(add|include|show)\s+.*(weekly\s+chart|bar\s+chart|breakdown\s+chart)/.test(g) && widgets.length < 8) {
    widgets.push({
      type: 'bar_chart',
      title: 'Weekly Breakdown',
      data: [
        { label: 'Mon', value: 42 },
        { label: 'Tue', value: 58 },
        { label: 'Wed', value: 64 },
        { label: 'Thu', value: 51 },
        { label: 'Fri', value: 73 },
      ],
    });
  } else if (/(add|include|show)\s+.*(line\s+chart|trend|chart)/.test(g) && widgets.length < 8) {
    widgets.push({
      type: 'line_chart',
      title: 'Weekly Momentum Trend',
      color: colorMatch ?? 'cyan',
      data: [
        { label: 'W1', value: 45 },
        { label: 'W2', value: 54 },
        { label: 'W3', value: 63 },
        { label: 'W4', value: 78 },
        { label: 'W5', value: 91 },
      ],
    });
  }

  if (/(add|include|show)\s+.*(kpi|metric|roi|revenue)/.test(g) && widgets.length < 8) {
    widgets.unshift({
      type: 'kpi',
      title: g.includes('roi') ? 'Estimated ROI' : 'Momentum Index',
      value: g.includes('roi') ? '3.4x' : '+22.8%',
      delta: 'Refined',
      trend: 'up',
      icon: 'sparkles',
    });
  }

  if (/(add|include|show)\s+.*(action|task|checklist|todo)/.test(g) && !widgets.some((w) => w.type === 'task_list') && widgets.length < 8) {
    widgets.push({
      type: 'task_list',
      title: 'Action Plan',
      items: [
        { label: 'Review top-performing KPI driver', done: false },
        { label: 'Ship next iteration & measure lift', done: false },
        { label: 'Share updated snapshot with team', done: false },
      ],
    });
  }

  if (/(add|include|show)\s+.*(calendar|schedule|timeline)/.test(g) && !widgets.some((w) => w.type === 'calendar') && widgets.length < 8) {
    widgets.push({
      type: 'calendar',
      title: 'Milestone Timeline',
      events: [
        { date: 'This Week', label: 'Checkpoint & data sync' },
        { date: 'Next Week', label: 'Target review & launch' },
      ],
    });
  }

  if (/(add|include|show)\s+.*(note|summary|insight)/.test(g) && !widgets.some((w) => w.type === 'note') && widgets.length < 8) {
    widgets.push({
      type: 'note',
      title: 'Executive Insight',
      body: clampStr(`Refined around "${goal}". Focus on the top upward trend and close out open checklist items first.`, 500),
    });
  }

  // If user asks to focus on a completely new domain (e.g. "focus on SEO" or "switch to finance"), blend in fresh domain widgets!
  if (/(focus on|switch to|pivot to|convert to)\s+/.test(g) && widgets.length === current.widgets.length) {
    const fresh = buildDomainSpec(goal);
    return dashboardSpecSchema.parse({
      title: fresh.title,
      subtitle: clampStr(`Refined: ${goal}`, 120),
      widgets: fresh.widgets.slice(0, 8),
    });
  }

  // If CSV is attached and user refined, ensure at least 3 widgets
  if (widgets.length < 3) {
    const fallback = sourceData ? synthesizeDashboard(goal, undefined, sourceData) : buildDomainSpec(goal);
    while (widgets.length < 3 && fallback.widgets.length > widgets.length) {
      widgets.push(fallback.widgets[widgets.length]);
    }
  }

  return dashboardSpecSchema.parse({
    title,
    subtitle: clampStr(subtitle || `Updated for: ${goal}`, 120),
    widgets: widgets.slice(0, 8),
  });
}

export function synthesizeDashboard(goal: string, current?: DashboardSpec, sourceData?: string): DashboardSpec {
  if (current) {
    return refineSpec(goal, current, sourceData);
  }
  if (sourceData) {
    const csv = parseCsvSummary(sourceData);
    if (csv) {
      return buildFromCsv(goal, csv);
    }
  }
  return buildDomainSpec(goal);
}
