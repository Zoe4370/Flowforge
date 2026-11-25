import type { DashboardSpec } from './schema';

export const examples = [
  { label: 'Freelance studio', prompt: 'Build a dashboard for my freelance design studio: income, active projects, and next steps.' },
  { label: 'Study routine', prompt: 'Make a weekly study planner for a high-school student balancing maths, science, and rest.' },
  { label: 'Healthy habits', prompt: 'Create a beginner wellness dashboard to track movement, sleep, water, and small weekly goals.' },
];

export const sampleDashboard: DashboardSpec = {
  title: 'Studio pulse',
  subtitle: 'A sample workspace for a small independent design studio',
  widgets: [
    { type: 'kpi', title: 'Monthly income', value: '$4,820', delta: '+12% this month', trend: 'up', icon: 'wallet' },
    { type: 'kpi', title: 'Active projects', value: '06', delta: '2 due this week', trend: 'flat', icon: 'layers' },
    { type: 'kpi', title: 'Focus time', value: '28.5 h', delta: '+3.5 h this week', trend: 'up', icon: 'clock' },
    { type: 'line_chart', title: 'Income over the last 6 months', color: 'lime', data: [{ label: 'Jun', value: 2700 }, { label: 'Jul', value: 3200 }, { label: 'Aug', value: 2950 }, { label: 'Sep', value: 3800 }, { label: 'Oct', value: 3950 }, { label: 'Nov', value: 4820 }] },
    { type: 'task_list', title: 'Next steps', items: [{ label: 'Send the Northline concept boards', done: true }, { label: 'Review two new project enquiries', done: false }, { label: 'Share the November invoice', done: false }, { label: 'Block a Friday studio session', done: false }] },
    { type: 'table', title: 'Project pipeline', columns: [{ key: 'project', label: 'PROJECT' }, { key: 'stage', label: 'STAGE' }, { key: 'value', label: 'VALUE' }], rows: [{ project: 'Northline identity', stage: 'Review', value: '$1,800' }, { project: 'Fieldnotes site', stage: 'In progress', value: '$2,400' }, { project: 'June coffee', stage: 'Discovery', value: '$900' }] },
  ],
};
