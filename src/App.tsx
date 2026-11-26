import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  Box,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers3,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import AmbientStage from './components/AmbientStage';
import { CsvPreviewModal, EngineModal, GuideModal, type HealthInfo } from './components/Modals';
import { examples, sampleCsvData, sampleCsvName } from './lib/examples';
import { parseCsvSummary, synthesizeDashboard } from './lib/localEngine';
import { dashboardSpecSchema, type DashboardSpec, type ProviderChoice, type Widget } from './lib/schema';

const ChartWidget = lazy(() => import('./components/ChartWidget'));

type IconName = 'activity' | 'wallet' | 'users' | 'target' | 'clock' | 'sparkles' | 'check' | 'layers';
const iconMap: Record<IconName, typeof Activity> = {
  activity: Activity,
  wallet: Wallet,
  users: Users,
  target: Target,
  clock: Clock3,
  sparkles: Sparkles,
  check: Check,
  layers: Layers3,
};

type WorkspaceSession = {
  id: string;
  spec: DashboardSpec;
  prompt: string;
  sourceData: string;
  sourceFileName: string;
  engineLabel: string;
  createdAt: number;
};

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  tiltEnabled?: boolean;
};

function Surface({ children, className = '', delay = 0, tiltEnabled = true }: SurfaceProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(x, { stiffness: 190, damping: 22 });
  const rotateY = useSpring(y, { stiffness: 190, damping: 22 });

  function point(e: MouseEvent<HTMLElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - box.left) / Math.max(1, box.width);
    const py = (e.clientY - box.top) / Math.max(1, box.height);
    e.currentTarget.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    e.currentTarget.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    if (!tiltEnabled) return;
    x.set((py - 0.5) * -4.2);
    y.set((px - 0.5) * 4.2);
  }

  function clear() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.article
      layout
      className={`surface ${className}`}
      style={tiltEnabled ? { rotateX, rotateY, transformPerspective: 1100 } : undefined}
      onMouseMove={point}
      onMouseLeave={clear}
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, delay, ease: 'easeOut' }}
    >
      <span className="surface-glare" aria-hidden="true" />
      {children}
    </motion.article>
  );
}

type WidgetCardProps = {
  widget: Widget;
  index: number;
  tiltEnabled: boolean;
  taskOverrides: Record<string, boolean>;
  extraTasks: Record<number, { label: string; done: boolean }[]>;
  progressOverrides: Record<number, number>;
  noteOverrides: Record<number, string>;
  calendarDone: Record<string, boolean>;
  onToggleTask: (key: string, value: boolean) => void;
  onAddTask: (widgetIdx: number, label: string) => void;
  onAdjustProgress: (widgetIdx: number, nextVal: number) => void;
  onUpdateNote: (widgetIdx: number, body: string) => void;
  onToggleCalendar: (key: string) => void;
};

function WidgetCard({
  widget,
  index,
  tiltEnabled,
  taskOverrides,
  extraTasks,
  progressOverrides,
  noteOverrides,
  calendarDone,
  onToggleTask,
  onAddTask,
  onAdjustProgress,
  onUpdateNote,
  onToggleCalendar,
}: WidgetCardProps) {
  const [newTask, setNewTask] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(widget.type === 'note' ? noteOverrides[index] ?? widget.body : '');

  const trend = widget.type === 'kpi' ? widget.trend : undefined;
  const Icon = widget.type === 'kpi' ? iconMap[(widget.icon as IconName | undefined) ?? 'activity'] : Activity;
  const span =
    widget.type === 'kpi'
      ? 'span-kpi'
      : widget.type === 'line_chart' || widget.type === 'table'
        ? 'span-wide'
        : widget.type === 'bar_chart'
          ? 'span-chart'
          : 'span-half';

  const mergedTasks = useMemo(() => {
    if (widget.type !== 'task_list') return [];
    return [...widget.items, ...(extraTasks[index] ?? [])];
  }, [widget, extraTasks, index]);

  const completedTasks = useMemo(() => {
    return mergedTasks.filter((item, i) => taskOverrides[`${index}-${i}`] ?? item.done).length;
  }, [mergedTasks, taskOverrides, index]);

  const sortedRows = useMemo(() => {
    if (widget.type !== 'table') return [];
    const query = tableFilter.trim().toLowerCase();
    const filtered = query
      ? widget.rows.filter((r) => widget.columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(query)))
      : [...widget.rows];
    if (!sortCol) return filtered;
    return filtered.sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      const an = Number(String(av).replace(/[$€£,%\s]/g, ''));
      const bn = Number(String(bv).replace(/[$€£,%\s]/g, ''));
      if (Number.isFinite(an) && Number.isFinite(bn) && String(av).trim() !== '' && String(bv).trim() !== '') {
        return sortAsc ? an - bn : bn - an;
      }
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [widget, tableFilter, sortCol, sortAsc]);

  function submitNewTask(e: FormEvent) {
    e.preventDefault();
    const clean = newTask.trim();
    if (!clean) return;
    onAddTask(index, clean.slice(0, 96));
    setNewTask('');
  }

  function handleSort(colKey: string) {
    if (sortCol === colKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortCol(colKey);
      setSortAsc(true);
    }
  }

  const currentProgress = widget.type === 'progress' ? (progressOverrides[index] ?? widget.current) : 0;
  const progressPct =
    widget.type === 'progress' ? Math.round(Math.min(100, Math.max(0, (currentProgress / widget.target) * 100))) : 0;

  return (
    <Surface className={`widget ${span}`} delay={index * 0.05} tiltEnabled={tiltEnabled}>
      <div className="widget-head">
        <span className="widget-title">{widget.title}</span>
        <div className="widget-head-right">
          {widget.type === 'task_list' && (
            <span className="widget-pill">
              {completedTasks}/{mergedTasks.length} done
            </span>
          )}
          {widget.type === 'progress' && <span className="widget-pill">{progressPct}%</span>}
          <span className="widget-mark">
            {widget.type === 'calendar' ? <CalendarDays size={14} strokeWidth={1.7} /> : <Icon size={15} strokeWidth={1.7} />}
          </span>
        </div>
      </div>

      {widget.type === 'kpi' && (
        <div className="kpi-content">
          <div>
            <div className="kpi-value">{widget.value}</div>
            <div className="kpi-spark" aria-hidden="true">
              <span style={{ height: '42%' }} />
              <span style={{ height: '60%' }} />
              <span style={{ height: '54%' }} />
              <span style={{ height: '78%' }} />
              <span style={{ height: trend === 'down' ? '48%' : '96%' }} />
            </div>
          </div>
          <div className="kpi-foot">
            <span className={`trend trend-${trend ?? 'flat'}`}>
              {trend === 'down' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
              {widget.delta ?? 'On track'}
            </span>
            <span className="metric-dot" />
          </div>
        </div>
      )}

      {(widget.type === 'line_chart' || widget.type === 'bar_chart') && (
        <Suspense fallback={<div className="chart-skeleton" aria-label="Loading chart" />}>
          <ChartWidget widget={widget} index={index} />
        </Suspense>
      )}

      {widget.type === 'task_list' && (
        <>
          <div className="task-list">
            {mergedTasks.map((item, i) => {
              const key = `${index}-${i}`;
              const done = taskOverrides[key] ?? item.done;
              return (
                <button
                  className={`task-row ${done ? 'is-done' : ''}`}
                  key={key}
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  onClick={() => onToggleTask(key, !done)}
                >
                  <span className="task-check">{done ? <Check size={13} /> : <Circle size={15} />}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          {mergedTasks.length < 10 && (
            <form className="task-add" onSubmit={submitNewTask}>
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="+ Add task item…"
                maxLength={96}
                aria-label={`Add task to ${widget.title}`}
              />
              <button type="submit" disabled={!newTask.trim()} aria-label="Add task">
                <Plus size={13} />
              </button>
            </form>
          )}
        </>
      )}

      {widget.type === 'table' && (
        <>
          {widget.rows.length >= 3 && (
            <div className="table-filter">
              <Search size={12} />
              <input
                type="search"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="Filter rows…"
                aria-label={`Filter rows in ${widget.title}`}
              />
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {widget.columns.map((col) => (
                    <th key={col.key} aria-sort={sortCol === col.key ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="th-sort" onClick={() => handleSort(col.key)}>
                        <span>{col.label}</span>
                        <ArrowUpDown size={11} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => (
                  <tr key={i}>
                    {widget.columns.map((col, j) => (
                      <td key={col.key}>
                        {j === 0 ? (
                          <span className="table-primary">{String(row[col.key] ?? '—')}</span>
                        ) : (
                          <span className={j === 1 ? 'stage-pill' : 'table-value'}>{String(row[col.key] ?? '—')}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {widget.type === 'progress' && (
        <div className="progress-content">
          <div className="progress-top-row">
            <div className="progress-number">
              {currentProgress.toLocaleString('en-US')}
              <span>
                {' '}
                / {widget.target.toLocaleString('en-US')} {widget.unit}
              </span>
            </div>
            <div className="progress-controls">
              <button
                type="button"
                aria-label={`Decrease ${widget.title}`}
                onClick={() => {
                  const step = Math.max(1, Math.round(widget.target * 0.05));
                  onAdjustProgress(index, Math.max(0, currentProgress - step));
                }}
              >
                <Minus size={12} />
              </button>
              <button
                type="button"
                aria-label={`Increase ${widget.title}`}
                onClick={() => {
                  const step = Math.max(1, Math.round(widget.target * 0.05));
                  onAdjustProgress(index, Math.min(widget.target * 2, currentProgress + step));
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label={widget.title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
          >
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <div className="progress-caption">{progressPct}% of goal · click +/- to simulate live</div>
        </div>
      )}

      {widget.type === 'note' && (
        <div className="note-content">
          <span className="note-quote">“</span>
          {editingNote ? (
            <div className="note-edit">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                maxLength={500}
                aria-label={`Edit ${widget.title}`}
              />
              <div className="note-edit-actions">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateNote(index, noteDraft.trim() || widget.body);
                    setEditingNote(false);
                  }}
                >
                  Save note
                </button>
                <button type="button" className="is-cancel" onClick={() => setEditingNote(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p>{noteOverrides[index] ?? widget.body}</p>
              <button
                type="button"
                className="note-edit-trigger"
                onClick={() => {
                  setNoteDraft(noteOverrides[index] ?? widget.body);
                  setEditingNote(true);
                }}
              >
                <Edit3 size={11} /> Edit note
              </button>
            </>
          )}
        </div>
      )}

      {widget.type === 'calendar' && (
        <div className="calendar-list">
          {widget.events.map((event, i) => {
            const key = `${index}-${i}`;
            const isChecked = Boolean(calendarDone[key]);
            return (
              <button
                type="button"
                className={`calendar-row ${isChecked ? 'is-checked' : ''}`}
                key={`${event.date}-${i}`}
                onClick={() => onToggleCalendar(key)}
              >
                <span className="calendar-date">{event.date}</span>
                <span className="calendar-event">{event.label}</span>
                <span className="calendar-mark">{isChecked ? <Check size={12} /> : <Circle size={12} />}</span>
              </button>
            );
          })}
        </div>
      )}
    </Surface>
  );
}

function CompositionCard({ onTryDemo }: { onTryDemo: () => void }) {
  const [tab, setTab] = useState<'pipeline' | 'schema' | 'preview'>('pipeline');
  const [activeStep, setActiveStep] = useState<number>(0);

  return (
    <div className="preview-stage" role="group" aria-label="FlowForge interactive composition process">
      <div className="preview-halo" />
      <div className="preview-topline">
        <span className="preview-live">
          <i /> GENERATION PIPELINE
        </span>
        <div className="preview-tabs" role="tablist" aria-label="Preview mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pipeline'}
            className={tab === 'pipeline' ? 'is-active' : ''}
            onClick={() => setTab('pipeline')}
          >
            Flow
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'schema'}
            className={tab === 'schema' ? 'is-active' : ''}
            onClick={() => setTab('schema')}
          >
            Schema
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={tab === 'preview' ? 'is-active' : ''}
            onClick={() => setTab('preview')}
          >
            3D Card
          </button>
        </div>
      </div>

      <div className="preview-head">
        <div>
          <span className="preview-eyebrow">FROM YOUR BRIEF</span>
          <h3>{tab === 'pipeline' ? 'Intent → structure' : tab === 'schema' ? 'Zod Schema Guard' : 'Live 3D Output'}</h3>
        </div>
        <button
          type="button"
          className="preview-icon"
          title="Try sample SaaS dashboard"
          aria-label="Generate sample dashboard"
          onClick={onTryDemo}
        >
          <Sparkles size={16} />
        </button>
      </div>

      {tab === 'pipeline' && (
        <>
          <button
            type="button"
            className={`flow-step ${activeStep === 0 ? 'flow-step-final' : ''}`}
            onClick={() => setActiveStep(0)}
          >
            <span className="flow-number">01</span>
            <div>
              <strong>Describe the work</strong>
              <span>Goal, Hugging Face / Gemini prompt, or real CSV data</span>
            </div>
            <span className="flow-status">INPUT</span>
          </button>
          <div className="flow-connector">
            <span />
          </div>
          <button
            type="button"
            className={`flow-step ${activeStep === 1 ? 'flow-step-final' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <span className="flow-number">02</span>
            <div>
              <strong>Validate the structure</strong>
              <span>Allow-listed widgets checked strictly before rendering</span>
            </div>
            <span className="flow-status">SCHEMA</span>
          </button>
          <div className="flow-connector">
            <span />
          </div>
          <button
            type="button"
            className={`flow-step ${activeStep === 2 ? 'flow-step-final' : ''}`}
            onClick={() => setActiveStep(2)}
          >
            <span className="flow-number">03</span>
            <div>
              <strong>Build your 3D workspace</strong>
              <span>Sortable tables, switchable charts, live tasks &amp; export</span>
            </div>
            <span className="flow-status">LIVE UI</span>
          </button>
        </>
      )}

      {tab === 'schema' && (
        <pre className="preview-code" aria-label="Dashboard JSON schema preview">{`{
  "title": "SaaS Growth Pulse",
  "widgets": [
    { "type": "kpi", "value": "$84.2k", "delta": "+19%" },
    { "type": "line_chart", "color": "lime", "data": [...] },
    { "type": "table", "columns": [...], "rows": [...] },
    { "type": "task_list", "items": [...] }
  ]
}`}</pre>
      )}

      {tab === 'preview' && (
        <div className="preview-mini-dash">
          <div className="mini-kpis">
            <div>
              <span>MRR</span>
              <strong>$84.2k</strong>
              <em>+19.4%</em>
            </div>
            <div>
              <span>NDR</span>
              <strong>118%</strong>
              <em>+4.2%</em>
            </div>
          </div>
          <div className="mini-bars" aria-hidden="true">
            <span style={{ height: '38%' }} />
            <span style={{ height: '54%' }} />
            <span style={{ height: '66%' }} />
            <span style={{ height: '79%' }} />
            <span style={{ height: '94%' }} />
          </div>
          <button type="button" className="mini-launch" onClick={onTryDemo}>
            Launch full interactive workspace <ArrowRight size={13} />
          </button>
        </div>
      )}

      <div className="preview-footnote">
        <span>The model creates a validated data spec, never unsafe UI code.</span>
      </div>
    </div>
  );
}

function specToMarkdown(spec: DashboardSpec, prompt: string): string {
  const lines: string[] = [`# ${spec.title}`, spec.subtitle ? `> ${spec.subtitle}` : '', `_Built from: ${prompt}_`, ''];
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

const QUICK_REFINES = [
  'Add a weekly bar chart',
  'Add a KPI metric',
  'Add an action checklist',
  'Simplify to 4 widgets',
  'Switch chart to cyan',
];

export default function App() {
  const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [refinement, setRefinement] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('Composing layout');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [sourceData, setSourceData] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Interactive widget states
  const [taskOverrides, setTaskOverrides] = useState<Record<string, boolean>>({});
  const [extraTasks, setExtraTasks] = useState<Record<number, { label: string; done: boolean }[]>>({});
  const [progressOverrides, setProgressOverrides] = useState<Record<number, number>>({});
  const [noteOverrides, setNoteOverrides] = useState<Record<number, string>>({});
  const [calendarDone, setCalendarDone] = useState<Record<string, boolean>>({});

  // UI/UX states & modals
  const [tiltEnabled, setTiltEnabled] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [engineOpen, setEngineOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  // AI provider & session keys
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [provider, setProvider] = useState<ProviderChoice>('auto');
  const [model, setModel] = useState('Qwen/Qwen2.5-72B-Instruct');
  const [hfToken, setHfToken] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId],
  );
  const dashboard = activeSession?.spec ?? null;
  const lastGoal = activeSession?.prompt ?? '';
  const lastSourceFile = activeSession?.sourceFileName ?? '';
  const activeCsvText = activeSession?.sourceData || sourceData;

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: HealthInfo | null) => {
        if (data?.ok) setHealth(data);
      })
      .catch(() => {
        // Offline / local fallback remains available
      });
  }, []);

  const csvQuickStats = useMemo(() => {
    if (!sourceData) return null;
    const summary = parseCsvSummary(sourceData);
    return summary ? `${summary.rows.length} rows · ${summary.headers.length} cols` : null;
  }, [sourceData]);

  function resetInteractiveOverrides() {
    setTaskOverrides({});
    setExtraTasks({});
    setProgressOverrides({});
    setNoteOverrides({});
    setCalendarDone({});
  }

  async function buildWorkspace(prompt: string, current?: DashboardSpec, data = activeSession?.sourceData ?? sourceData) {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 4) {
      setError('Add a little more detail (at least 4 characters) so FlowForge can shape a useful workspace.');
      return;
    }
    setError('');
    setLoading(true);
    setLoadingStage(data ? 'Analyzing CSV & intent' : 'Generating layout spec');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (hfToken.trim()) headers['x-hf-token'] = hfToken.trim();
      if (geminiKey.trim()) headers['x-gemini-key'] = geminiKey.trim();

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          goal: cleanPrompt,
          ...(current ? { current } : {}),
          ...(data ? { sourceData: data } : {}),
          provider,
          ...(provider === 'huggingface' && model ? { model } : {}),
        }),
      });

      const rawText = await response.text();
      let result: unknown = null;
      try {
        result = rawText ? JSON.parse(rawText) : null;
      } catch {
        result = null;
      }

      let validSpec: DashboardSpec | null = null;
      let engineLabel = 'Local Engine';

      if (response.ok && result) {
        const parsed = dashboardSpecSchema.safeParse(result);
        if (parsed.success) {
          validSpec = parsed.data;
          const respProvider = response.headers.get('X-FlowForge-Provider');
          const respModel = response.headers.get('X-FlowForge-Model');
          if (respProvider === 'huggingface') engineLabel = `HF · ${respModel?.split('/').pop() || 'Qwen2.5'}`;
          else if (respProvider === 'gemini') engineLabel = `Gemini · ${respModel || '2.5-flash'}`;
          else if (respProvider === 'groq') engineLabel = 'Groq · Llama 3.3';
          else if (respProvider === 'openai') engineLabel = 'OpenAI';
          else engineLabel = data ? 'CSV + Local Engine' : 'Smart Local Engine';
        }
      } else if (response.status === 400 || response.status === 413 || response.status === 429) {
        const msg =
          typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Please refine your prompt and try again.';
        throw new Error(msg);
      }

      // Resilient client-side fallback if serverless endpoint was unreachable or returned non-JSON
      if (!validSpec) {
        validSpec = synthesizeDashboard(cleanPrompt, current, data || undefined);
        engineLabel = data ? 'Browser CSV Engine' : 'Browser Local Engine';
      }

      const usedFileName = current ? activeSession?.sourceFileName || sourceFileName : sourceFileName;
      if (current && activeSession) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? { ...s, spec: validSpec, engineLabel, sourceData: data || s.sourceData }
              : s,
          ),
        );
      } else {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const entry: WorkspaceSession = {
          id,
          spec: validSpec,
          prompt: cleanPrompt,
          sourceData: data || '',
          sourceFileName: usedFileName,
          engineLabel,
          createdAt: Date.now(),
        };
        setSessions((prev) => [entry, ...prev].slice(0, 8));
        setActiveId(id);
      }

      resetInteractiveOverrides();
      setGoal('');
      setRefinement('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build workspace. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function processCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setError('Choose a .csv file.');
      return;
    }
    if (file.size > 12_000) {
      setError('CSV files are limited to 12 KB. Trim extra rows or columns and try again.');
      return;
    }
    try {
      const text = await file.text();
      if (text.length > 12_000 || text.split(/\r?\n/).filter((row) => row.trim()).length < 2) {
        setError('Add a header row and at least one data row (max 12 KB).');
        return;
      }
      setSourceData(text);
      setSourceFileName(file.name);
      setError('');
    } catch {
      setError('That CSV could not be read. Please try another file.');
    }
  }

  async function attachCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = '';
    await processCsvFile(file);
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processCsvFile(file);
  }

  function loadSampleCsv() {
    setSourceData(sampleCsvData);
    setSourceFileName(sampleCsvName);
    if (!goal.trim()) {
      setGoal('Analyze my SaaS growth CSV: MRR trajectory, acquisition channels, conversion rate, and targets.');
    }
    setError('');
  }

  function submitGoal(event: FormEvent) {
    event.preventDefault();
    void buildWorkspace(goal);
  }

  function handlePromptKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!loading && goal.trim().length >= 4) void buildWorkspace(goal);
    }
  }

  function submitRefinement(event: FormEvent) {
    event.preventDefault();
    if (dashboard) void buildWorkspace(refinement, dashboard, activeSession?.sourceData ?? sourceData);
  }

  function newWorkspace() {
    setActiveId(null);
    setFocusMode(false);
    setGoal('');
    setRefinement('');
    setError('');
    resetInteractiveOverrides();
  }

  function removeSession(id: string) {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
        resetInteractiveOverrides();
      }
      return next;
    });
  }

  async function copySpec() {
    if (!dashboard) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(dashboard, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access is unavailable in this browser.');
    }
  }

  function downloadFile(kind: 'json' | 'md') {
    if (!dashboard) return;
    const slug = dashboard.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    const content = kind === 'json' ? JSON.stringify(dashboard, null, 2) : specToMarkdown(dashboard, lastGoal);
    const mime = kind === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeProviderBadge =
    provider === 'local'
      ? 'LOCAL ENGINE'
      : hfToken.trim() || health?.providers.huggingface
        ? 'HUGGING FACE LIVE'
        : geminiKey.trim() || health?.providers.gemini
          ? 'GEMINI 2.5 LIVE'
          : 'SMART ENGINE + CSV';

  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <AmbientStage enabled={tiltEnabled} />
      <div className={`app-shell ${dashboard ? 'has-dashboard' : 'is-landing'} ${focusMode ? 'is-focus' : ''} ${compactMode ? 'is-compact' : ''}`}>
        {dashboard && !focusMode && (
          <aside className="sidebar" aria-label="Workspace navigation">
            <button className="brand" type="button" onClick={newWorkspace} aria-label="FlowForge home">
              <span className="brand-mark">
                <span />
                <span />
                <span />
              </span>
              <span>flowforge</span>
            </button>

            <button className="new-workspace" type="button" onClick={newWorkspace}>
              <Plus size={16} /> New workspace
            </button>

            <div className="side-label">SESSION WORKSPACES ({sessions.length})</div>
            <div className="side-history">
              {sessions.map((s) => (
                <div className={`side-item-wrap ${s.id === activeSession?.id ? 'is-current' : ''}`} key={s.id}>
                  <button
                    type="button"
                    className="side-active"
                    onClick={() => {
                      setActiveId(s.id);
                      resetInteractiveOverrides();
                    }}
                  >
                    <span className="side-active-icon">
                      <Layers3 size={14} />
                    </span>
                    <span className="side-item-title">{s.spec.title}</span>
                    {s.id === activeSession?.id && <span className="active-dot" />}
                  </button>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      className="side-remove"
                      aria-label={`Remove ${s.spec.title}`}
                      onClick={() => removeSession(s.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="side-label">VIEW CONTROLS</div>
            <div className="side-toggles">
              <button
                type="button"
                className={`side-toggle ${tiltEnabled ? 'is-on' : ''}`}
                aria-pressed={tiltEnabled}
                onClick={() => setTiltEnabled((v) => !v)}
              >
                <Box size={14} /> <span>3D Glossy Tilt</span> <em>{tiltEnabled ? 'ON' : 'OFF'}</em>
              </button>
              <button
                type="button"
                className={`side-toggle ${compactMode ? 'is-on' : ''}`}
                aria-pressed={compactMode}
                onClick={() => setCompactMode((v) => !v)}
              >
                <Eye size={14} /> <span>Compact Grid</span> <em>{compactMode ? 'ON' : 'OFF'}</em>
              </button>
            </div>

            <button type="button" className="sidebar-bottom" onClick={() => setEngineOpen(true)}>
              <div className="credit-orb">
                <Sparkles size={15} />
              </div>
              <p>
                <strong>{activeSession?.engineLabel || 'Smart Engine'}</strong>
                <br />
                Click to configure Hugging Face or Gemini models.
              </p>
              <div className="local-badge">
                <span /> SCHEMA GUARD ACTIVE
              </div>
            </button>
          </aside>
        )}

        <main className="main-area" id="content" tabIndex={-1}>
          <header className="topbar">
            <button className="brand mobile-brand" type="button" onClick={newWorkspace}>
              <span className="brand-mark">
                <span />
                <span />
                <span />
              </span>
              <span>flowforge</span>
            </button>
            <div className="breadcrumbs">
              <button type="button" className="crumb-home" onClick={newWorkspace}>
                WORKSPACE
              </button>
              <span className="crumb-slash">/</span>
              <strong>{dashboard ? dashboard.title : 'BUILDER'}</strong>
            </div>
            <div className="topbar-right">
              <button type="button" className="ai-chip" onClick={() => setEngineOpen(true)}>
                <span /> {activeProviderBadge}
              </button>
              <button className="top-help" type="button" onClick={() => setGuideOpen(true)}>
                How it works <span>?</span>
              </button>
            </div>
          </header>

          {!dashboard ? (
            <section className="landing-content">
              <div className="landing-copy">
                <div className="eyebrow">
                  <span className="eyebrow-line" /> PROMPT-TO-WORKSPACE ENGINE <span className="eyebrow-version">v2.0 · 3D UI</span>
                </div>
                <h1>
                  Your goal.
                  <br />
                  <em>
                    A workspace
                    <br className="mobile-break" /> that fits.
                  </em>
                </h1>
                <p className="hero-copy">
                  Skip static templates. Describe what you’re building or drop a CSV to generate a glossy 3D, interactive,
                  schema-validated command center in seconds.
                </p>

                <form
                  className={`prompt-panel ${isDragging ? 'is-dragging' : ''}`}
                  onSubmit={submitGoal}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <label className="prompt-label" htmlFor="main-prompt">
                    <Sparkles size={14} /> WHAT ARE YOU BUILDING OR ANALYZING?
                  </label>
                  <textarea
                    id="main-prompt"
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    onKeyDown={handlePromptKeyDown}
                    placeholder="e.g. SaaS financial KPIs, Similarweb SEO traffic funnel, freelance studio pipeline, or attach a CSV…"
                    maxLength={500}
                    rows={3}
                    disabled={loading}
                  />
                  <div className="csv-row">
                    <label className="csv-button" htmlFor="csv-file">
                      <FileSpreadsheet size={14} /> Attach CSV
                      <input id="csv-file" className="sr-only" type="file" accept=".csv,text/csv" onChange={attachCsv} disabled={loading} />
                    </label>
                    <button type="button" className="csv-sample-btn" onClick={loadSampleCsv} disabled={loading}>
                      Try sample SaaS CSV
                    </button>
                    {sourceFileName ? (
                      <div className="csv-pill-group">
                        <button type="button" className="csv-filename" title={sourceFileName} onClick={() => setCsvOpen(true)}>
                          {sourceFileName} {csvQuickStats ? `(${csvQuickStats})` : ''}
                        </button>
                        <button
                          className="csv-remove"
                          type="button"
                          aria-label="Remove uploaded CSV"
                          onClick={() => {
                            setSourceData('');
                            setSourceFileName('');
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <span className="csv-hint">Or drag &amp; drop a .csv (up to 12 KB)</span>
                    )}
                  </div>
                  <div className="prompt-footer">
                    <span className="prompt-note">
                      {goal.length}/500 <span>·</span> Ctrl+Enter to build
                    </span>
                    <button className="primary-button" type="submit" disabled={loading || goal.trim().length < 4}>
                      {loading ? (
                        <>
                          <LoaderCircle size={16} className="spinner" /> {loadingStage}
                        </>
                      ) : (
                        <>
                          Generate workspace <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {error && (
                  <div className="error-box" role="alert">
                    <span>{error}</span>
                    <button className="error-close" type="button" aria-label="Dismiss error" onClick={() => setError('')}>
                      <X size={15} />
                    </button>
                  </div>
                )}

                <div className="examples">
                  <span className="examples-heading">LAUNCH A LIVE WORKSPACE IN ONE CLICK</span>
                  <div className="example-chips">
                    {examples.map((example, index) => (
                      <button
                        type="button"
                        key={example.label}
                        className="example-chip"
                        onClick={() => {
                          setGoal(example.prompt);
                          void buildWorkspace(example.prompt);
                        }}
                        disabled={loading}
                      >
                        <span className="chip-index">0{index + 1}</span>
                        {example.label}
                        <ArrowRight size={13} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="landing-foot">
                  <span>
                    <span className="privacy-dot" /> Zero-code Zod schema guard · Session-only data
                  </span>
                  <span>HUGGING FACE · GEMINI · REAL CSV</span>
                </div>
              </div>

              <div className="landing-visual">
                <div className="visual-side-label">INTENT → 3D INTERFACE</div>
                <CompositionCard
                  onTryDemo={() => {
                    const first = examples[0];
                    setGoal(first.prompt);
                    void buildWorkspace(first.prompt);
                  }}
                />
                <div className="visual-caption">
                  <span>YOUR BRIEF</span>
                  <ArrowRight size={15} />
                  <span>INTERACTIVE WORKSPACE</span>
                </div>
              </div>
            </section>
          ) : (
            <section className="dashboard-content">
              <div className="dashboard-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" /> YOUR WORKSPACE
                    <span className="live-badge">
                      <span /> {activeSession?.engineLabel || 'ACTIVE'}
                    </span>
                  </div>
                  <h1>{dashboard.title}</h1>
                  <p>{dashboard.subtitle || 'A workspace assembled around your goal.'}</p>
                </div>
                <div className="dashboard-actions">
                  <button className="quiet-button" type="button" onClick={copySpec}>
                    <Copy size={14} /> {copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                  <button className="quiet-button" type="button" onClick={() => downloadFile('json')} title="Download JSON spec">
                    <Download size={14} /> JSON
                  </button>
                  <button className="quiet-button" type="button" onClick={() => downloadFile('md')} title="Export Markdown brief">
                    <FileText size={14} /> MD
                  </button>
                  <button
                    className="quiet-button"
                    type="button"
                    onClick={() => setFocusMode((v) => !v)}
                    aria-pressed={focusMode}
                    title={focusMode ? 'Exit focus mode' : 'Presentation focus mode'}
                  >
                    {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {focusMode ? 'Exit focus' : 'Focus'}
                  </button>
                  <button
                    className="regen-button"
                    type="button"
                    onClick={() => void buildWorkspace(lastGoal || 'Create a practical dashboard for my goal.', dashboard, activeSession?.sourceData)}
                    disabled={loading}
                  >
                    <Sparkles size={14} /> Regenerate
                  </button>
                </div>
              </div>

              <div className="context-strip">
                <span className="context-mark">
                  <Zap size={13} />
                </span>
                <span className="context-label">BUILT FROM</span>
                <span className="context-prompt">{lastGoal || 'Your current workspace prompt'}</span>
                {lastSourceFile && (
                  <button type="button" className="source-badge" onClick={() => setCsvOpen(true)}>
                    <FileSpreadsheet size={12} /> {lastSourceFile}
                  </button>
                )}
                <button type="button" aria-label="Start a new workspace" onClick={newWorkspace}>
                  <Plus size={14} /> New
                </button>
              </div>

              {error && (
                <div className="error-box dashboard-error" role="alert">
                  <span>{error}</span>
                  <button className="error-close" type="button" aria-label="Dismiss error" onClick={() => setError('')}>
                    <X size={15} />
                  </button>
                </div>
              )}

              <div className={`widget-grid ${loading ? 'is-refreshing' : ''}`} aria-live="polite">
                {dashboard.widgets.map((widget, index) => (
                  <WidgetCard
                    key={`${widget.type}-${index}-${widget.title}`}
                    widget={widget}
                    index={index}
                    tiltEnabled={tiltEnabled}
                    taskOverrides={taskOverrides}
                    extraTasks={extraTasks}
                    progressOverrides={progressOverrides}
                    noteOverrides={noteOverrides}
                    calendarDone={calendarDone}
                    onToggleTask={(key, value) => setTaskOverrides((prev) => ({ ...prev, [key]: value }))}
                    onAddTask={(widgetIdx, label) =>
                      setExtraTasks((prev) => ({
                        ...prev,
                        [widgetIdx]: [...(prev[widgetIdx] ?? []), { label, done: false }],
                      }))
                    }
                    onAdjustProgress={(widgetIdx, nextVal) =>
                      setProgressOverrides((prev) => ({ ...prev, [widgetIdx]: nextVal }))
                    }
                    onUpdateNote={(widgetIdx, body) => setNoteOverrides((prev) => ({ ...prev, [widgetIdx]: body }))}
                    onToggleCalendar={(key) => setCalendarDone((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                ))}
              </div>

              <div className="data-note">
                <span className="data-note-dot" />
                {lastSourceFile
                  ? `Computed from ${lastSourceFile}. Click the CSV badge above to inspect raw parsed rows.`
                  : 'Illustrative sample figures unless a CSV is attached. Click charts, table headers, tasks, notes, or progress +/- to interact live.'}
              </div>

              <div className="quick-refines" aria-label="Quick refinements">
                <span>QUICK REFINE</span>
                {QUICK_REFINES.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={loading}
                    onClick={() => void buildWorkspace(chip, dashboard, activeSession?.sourceData)}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <form className="refine-bar" onSubmit={submitRefinement}>
                <span className="refine-icon">
                  <Sparkles size={16} />
                </span>
                <label className="sr-only" htmlFor="refine-input">
                  Refine this workspace
                </label>
                <input
                  id="refine-input"
                  value={refinement}
                  onChange={(event) => setRefinement(event.target.value)}
                  placeholder="Ask for a change: add a weekly chart, add task Launch campaign, simplify, switch to cyan…"
                  maxLength={400}
                  disabled={loading}
                />
                <button type="submit" disabled={loading || refinement.trim().length < 4}>
                  {loading ? (
                    <LoaderCircle size={15} className="spinner" />
                  ) : (
                    <>
                      Refine <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              <div className="dashboard-bottom">
                <span>
                  FLOWFORGE <span>·</span> 3D GENERATIVE WORKSPACE
                </span>
                <span>
                  STRUCTURED OUTPUT <i /> VALIDATED WIDGETS <i /> SESSION-ONLY DATA
                </span>
              </div>
            </section>
          )}
        </main>
      </div>

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <EngineModal
        open={engineOpen}
        onClose={() => setEngineOpen(false)}
        health={health}
        provider={provider}
        setProvider={setProvider}
        model={model}
        setModel={setModel}
        hfToken={hfToken}
        setHfToken={setHfToken}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
      />
      <CsvPreviewModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        fileName={lastSourceFile || sourceFileName}
        csvText={activeCsvText}
      />
    </>
  );
}
