import type { DashboardSpec } from './schema.js';

export function specToMarkdown(spec: DashboardSpec, prompt: string, provenanceNote?: string): string {
  const lines: string[] = [`# ${spec.title}`, spec.subtitle ? `> ${spec.subtitle}` : '', `_Built from: ${prompt}_`, ''];
  if (provenanceNote) lines.push('## Data provenance', provenanceNote, '');
  for (const w of spec.widgets) {
    lines.push(`## ${w.title}`);
    if (w.type === 'kpi') lines.push(`- **Value:** ${w.value} (${w.delta ?? 'On track'})`);
    if (w.type === 'progress') lines.push(`- **Progress:** ${w.current} / ${w.target} ${w.unit ?? ''}`);
    if (w.type === 'note') lines.push(w.body);
    if (w.type === 'task_list') {
      w.items.forEach((t) => lines.push(`- [${t.done ? 'x' : ' '}] ${t.label}`));
    }
    if (w.type === 'calendar') {
      w.events.forEach((e) => lines.push(`- **${e.date}**: ${e.label}`));
    }
    if (w.type === 'line_chart' || w.type === 'bar_chart') {
      w.data.forEach((p) => lines.push(`- ${p.label}: ${p.value}`));
    }
    if (w.type === 'table') {
      lines.push(`| ${w.columns.map((c) => c.label).join(' | ')} |`);
      lines.push(`| ${w.columns.map(() => '---').join(' | ')} |`);
      w.rows.forEach((r) => lines.push(`| ${w.columns.map((c) => String(r[c.key] ?? '—')).join(' | ')} |`));
    }
    lines.push('');
  }
  return lines.join('\n');
}
