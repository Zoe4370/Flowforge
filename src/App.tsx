import { lazy, Suspense, useState, type ChangeEvent, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Check, Circle, Clock3, Copy, FileSpreadsheet, Layers3, LoaderCircle, Plus, Sparkles, Target, Wallet, X, Zap } from 'lucide-react';
import { dashboardSpecSchema, type DashboardSpec, type Widget } from './lib/schema';
import { examples } from './lib/examples';

const ChartWidget = lazy(() => import('./components/ChartWidget'));
type IconName = 'activity' | 'wallet' | 'users' | 'target' | 'clock' | 'sparkles' | 'check' | 'layers';
const iconMap: Record<IconName, typeof Activity> = { activity: Activity, wallet: Wallet, users: Activity, target: Target, clock: Clock3, sparkles: Sparkles, check: Check, layers: Layers3 };

function Surface({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(x, { stiffness: 180, damping: 22 });
  const rotateY = useSpring(y, { stiffness: 180, damping: 22 });
  function point(e: MouseEvent<HTMLElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientY - box.top) / box.height - 0.5) * -3.2);
    y.set(((e.clientX - box.left) / box.width - 0.5) * 3.2);
  }
  function clear() { x.set(0); y.set(0); }
  return <motion.article className={`surface ${className}`} style={{ rotateX, rotateY, transformPerspective: 1100 }} onMouseMove={point} onMouseLeave={clear} initial={{ opacity: 0, y: 14, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .42, delay, ease: 'easeOut' }}>{children}</motion.article>;
}

function WidgetCard({ widget, index, taskOverrides, onToggle }: { widget: Widget; index: number; taskOverrides: Record<string, boolean>; onToggle: (key: string, value: boolean) => void }) {
  const trend = widget.type === 'kpi' ? widget.trend : undefined;
  const Icon = widget.type === 'kpi' ? iconMap[(widget.icon as IconName | undefined) ?? 'activity'] : Activity;
  const span = widget.type === 'kpi' ? 'span-kpi' : widget.type === 'line_chart' || widget.type === 'table' ? 'span-wide' : widget.type === 'bar_chart' ? 'span-chart' : 'span-half';
  return <Surface className={`widget ${span}`} delay={index * .055}>
    <div className="widget-head"><span className="widget-title">{widget.title}</span><span className="widget-mark"><Icon size={15} strokeWidth={1.7} /></span></div>
    {widget.type === 'kpi' && <div className="kpi-content"><div className="kpi-value">{widget.value}</div><div className="kpi-foot"><span className={`trend trend-${trend ?? 'flat'}`}>{trend === 'down' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{widget.delta ?? 'On track'}</span><span className="metric-dot" /></div></div>}
    {(widget.type === 'line_chart' || widget.type === 'bar_chart') && <Suspense fallback={<div className="chart-skeleton" aria-label="Loading chart" />}><ChartWidget widget={widget} index={index} /></Suspense>}
    {widget.type === 'task_list' && <div className="task-list">{widget.items.map((item, i) => { const key = `${index}-${i}`; const done = taskOverrides[key] ?? item.done; return <button className={`task-row ${done ? 'is-done' : ''}`} key={key} type="button" role="checkbox" aria-checked={done} onClick={() => onToggle(key, !done)}><span className="task-check">{done ? <Check size={13} /> : <Circle size={15} />}</span><span>{item.label}</span></button>; })}</div>}
    {widget.type === 'table' && <div className="table-scroll"><table><thead><tr>{widget.columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead><tbody>{widget.rows.map((row, i) => <tr key={i}>{widget.columns.map((col, j) => <td key={col.key}>{j === 0 ? <span className="table-primary">{String(row[col.key] ?? '—')}</span> : <span className={j === 1 ? 'stage-pill' : 'table-value'}>{String(row[col.key] ?? '—')}</span>}</td>)}</tr>)}</tbody></table></div>}
    {widget.type === 'progress' && <div className="progress-content"><div className="progress-number">{widget.current}<span> / {widget.target} {widget.unit}</span></div><div className="progress-track"><span style={{ width: `${Math.min(100, (widget.current / widget.target) * 100)}%` }} /></div><div className="progress-caption">{Math.round(Math.min(100, (widget.current / widget.target) * 100))}% of goal</div></div>}
    {widget.type === 'note' && <div className="note-content"><span className="note-quote">“</span><p>{widget.body}</p></div>}
    {widget.type === 'calendar' && <div className="calendar-list">{widget.events.map((event, i) => <div className="calendar-row" key={`${event.date}-${i}`}><span className="calendar-date">{event.date}</span><span className="calendar-event">{event.label}</span></div>)}</div>}
  </Surface>;
}

function CompositionCard() {
  return <div className="preview-stage" aria-label="FlowForge composition process">
    <div className="preview-halo" />
    <div className="preview-topline"><span className="preview-live"><i /> GENERATION PIPELINE</span><span className="preview-menu">···</span></div>
    <div className="preview-head"><div><span className="preview-eyebrow">FROM YOUR BRIEF</span><h3>Intent → structure</h3></div><span className="preview-icon"><Sparkles size={16} /></span></div>
    <div className="flow-step"><span className="flow-number">01</span><div><strong>Describe the work</strong><span>A goal, a workflow, or a CSV of your own data</span></div><span className="flow-status">INPUT</span></div>
    <div className="flow-connector"><span /></div>
    <div className="flow-step"><span className="flow-number">02</span><div><strong>Validate the structure</strong><span>Only allow-listed widgets. Checked before rendering.</span></div><span className="flow-status">SCHEMA</span></div>
    <div className="flow-connector"><span /></div>
    <div className="flow-step flow-step-final"><span className="flow-number">03</span><div><strong>Build your workspace</strong><span>Interactive charts, tasks and tables, shaped to fit.</span></div><span className="flow-status">LIVE UI</span></div>
    <div className="preview-footnote">The model creates a data spec, never interface code.</div>
  </div>;
}

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardSpec | null>(null);
  const [goal, setGoal] = useState('');
  const [refinement, setRefinement] = useState('');
  const [lastGoal, setLastGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [taskOverrides, setTaskOverrides] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [sourceData, setSourceData] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [lastSourceFile, setLastSourceFile] = useState('');

  async function buildWorkspace(prompt: string, current?: DashboardSpec, data = sourceData) {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 4) { setError('Add a little more detail so FlowForge can shape a useful workspace.'); return; }
    setError(''); setLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: cleanPrompt, ...(current ? { current } : {}), ...(data ? { sourceData: data } : {}) }),
      });
      const contentType = response.headers.get('content-type') ?? '';
      const responseText = await response.text();
      let result: unknown = null;
      if (contentType.toLowerCase().includes('application/json')) {
        try { result = JSON.parse(responseText); }
        catch { throw new Error(`The workspace service returned invalid JSON (HTTP ${response.status}). Please retry; if it continues, check the Vercel function configuration.`); }
      }
      if (!response.ok) {
        const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
          ? result.error
          : `The workspace service returned HTTP ${response.status} instead of a JSON error. Check Vercel's function logs and GEMINI_API_KEY configuration.`;
        throw new Error(message);
      }
      if (result === null) throw new Error(`The workspace service did not return JSON (HTTP ${response.status}). Check that /api/generate is deployed as a Vercel Function.`);
      const parsed = dashboardSpecSchema.safeParse(result);
      if (!parsed.success) throw new Error('The generated layout could not be validated. Try a simpler prompt.');
      setDashboard(parsed.data);
      if (!current) setLastGoal(cleanPrompt);
      if (data && sourceFileName) setLastSourceFile(sourceFileName);
      setTaskOverrides({}); setGoal(''); setRefinement('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to the workspace builder. Please try again.');
    } finally { setLoading(false); }
  }

  async function attachCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = '';
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') { setError('Choose a CSV file.'); return; }
    if (file.size > 12_000) { setError('This prototype accepts CSV files up to 12 KB. Remove extra rows or columns and try again.'); return; }
    try {
      const text = await file.text();
      if (text.length > 12_000 || text.split(/\r?\n/).filter((row) => row.trim()).length < 2) { setError('Add a header row and at least one data row. CSV files are limited to 12 KB.'); return; }
      setSourceData(text); setSourceFileName(file.name); setError('');
    } catch { setError('That CSV could not be read. Please try another file.'); }
  }

  function submitGoal(event: FormEvent) { event.preventDefault(); void buildWorkspace(goal); }
  function submitRefinement(event: FormEvent) { event.preventDefault(); if (dashboard) void buildWorkspace(refinement, dashboard, sourceData); }
  function newWorkspace() {
    setDashboard(null); setGoal(''); setRefinement(''); setError(''); setTaskOverrides({});
    setSourceData(''); setSourceFileName(''); setLastSourceFile(''); setLastGoal('');
  }
  async function copySpec() {
    if (!dashboard) return;
    try { await navigator.clipboard.writeText(JSON.stringify(dashboard, null, 2)); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Clipboard access is unavailable in this browser.'); }
  }

  return <div className={`app-shell ${dashboard ? 'has-dashboard' : 'is-landing'}`}>
    {dashboard && <aside className="sidebar">
      <button className="brand" type="button" onClick={newWorkspace} aria-label="FlowForge home"><span className="brand-mark"><span /><span /><span /></span><span>flowforge</span></button>
      <button className="new-workspace" type="button" onClick={newWorkspace}><Plus size={16} /> New workspace</button>
      <div className="side-label">WORKSPACE</div>
      <div className="side-active"><span className="side-active-icon"><Layers3 size={15} /></span><span>{dashboard.title}</span><span className="active-dot" /></div>
      <div className="sidebar-bottom"><div className="credit-orb"><Sparkles size={15} /></div><p><strong>Built around your brief.</strong><br />Every layout starts with a goal.</p><div className="local-badge"><span /> SESSION ONLY</div></div>
    </aside>}
    <main className="main-area">
      <header className="topbar">
        <button className="brand mobile-brand" type="button" onClick={newWorkspace}><span className="brand-mark"><span /><span /><span /></span><span>flowforge</span></button>
        <div className="breadcrumbs"><span>WORKSPACE</span><span className="crumb-slash">/</span><strong>{dashboard ? dashboard.title : 'BUILDER'}</strong></div>
        <div className="topbar-right"><span className="ai-chip"><span /> AI COMPOSITION</span><button className="top-help" type="button" onClick={() => setError('Describe a real task or attach a small CSV. FlowForge turns that context into a set of interactive, validated widgets.')}>How it works <span>?</span></button></div>
      </header>
      {!dashboard ? <section className="landing-content">
        <div className="landing-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> PROMPT-TO-WORKSPACE ENGINE <span className="eyebrow-version">01 / 03</span></div>
          <h1>Your goal.<br /><em>A workspace<br className="mobile-break" /> that fits.</em></h1>
          <p className="hero-copy">Skip the setup. Describe what you’re trying to do and get a clear, interactive workspace built around it.</p>
          <form className="prompt-panel" onSubmit={submitGoal}>
            <label className="prompt-label" htmlFor="main-prompt"><Sparkles size={14} /> WHAT ARE YOU WORKING ON?</label>
            <textarea id="main-prompt" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="e.g. Help me keep my freelance projects, income and next steps in one place…" maxLength={500} rows={3} disabled={loading} />
            <div className="csv-row">
              <label className="csv-button" htmlFor="csv-file"><FileSpreadsheet size={14} /> Attach your CSV<input id="csv-file" type="file" accept=".csv,text/csv" onChange={attachCsv} disabled={loading} /></label>
              {sourceFileName ? <><span className="csv-filename" title={sourceFileName}>{sourceFileName}</span><button className="csv-remove" type="button" aria-label="Remove uploaded CSV" onClick={() => { setSourceData(''); setSourceFileName(''); }}><X size={13} /></button></> : <span className="csv-hint">Optional · up to 12 KB · sent with your prompt for analysis</span>}
            </div>
            <div className="prompt-footer"><span className="prompt-note">{goal.length}/500 <span>·</span> Specific goals make better workspaces</span><button className="primary-button" type="submit" disabled={loading || goal.trim().length < 4}>{loading ? <><LoaderCircle size={16} className="spinner" /> Building</> : <>Generate workspace <ArrowRight size={15} /></>}</button></div>
          </form>
          {error && <div className="error-box" role="alert"><span>{error}</span><button className="error-close" type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
          <div className="examples"><span className="examples-heading">START WITH A DIRECTION</span><div className="example-chips">{examples.map((example, index) => <button type="button" key={example.label} className="example-chip" onClick={() => { setGoal(example.prompt); void buildWorkspace(example.prompt); }} disabled={loading}><span className="chip-index">0{index + 1}</span>{example.label}<ArrowRight size={13} /></button>)}</div></div>
          <div className="landing-foot"><span><span className="privacy-dot" /> CSV is sent to the configured AI service; FlowForge does not save it in a project database.</span><span>BUILT FOR THE WAY YOU WORK</span></div>
        </div>
        <div className="landing-visual"><div className="visual-side-label">INTENT → INTERFACE</div><CompositionCard /><div className="visual-caption"><span>YOUR BRIEF</span><ArrowRight size={15} /><span>A WORKING LAYOUT</span></div></div>
      </section> : <section className="dashboard-content">
        <div className="dashboard-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR WORKSPACE <span className="live-badge"><span /> ACTIVE</span></div><h1>{dashboard.title}</h1><p>{dashboard.subtitle || 'A workspace assembled around your goal.'}</p></div><div className="dashboard-actions"><button className="quiet-button" type="button" onClick={copySpec}><Copy size={14} /> {copied ? 'Copied' : 'Copy spec'}</button><button className="regen-button" type="button" onClick={() => void buildWorkspace(lastGoal || 'Create a practical dashboard for my goal.', dashboard, sourceData)} disabled={loading}><Sparkles size={14} /> Regenerate</button></div></div>
        <div className="context-strip"><span className="context-mark"><Zap size={13} /></span><span className="context-label">BUILT FROM</span><span className="context-prompt">{lastGoal || 'Your current workspace prompt'}</span>{lastSourceFile && <span className="source-badge"><FileSpreadsheet size={12} /> {lastSourceFile}</span>}<button type="button" aria-label="Start a new workspace" onClick={newWorkspace}><Plus size={14} /> New</button></div>
        {error && <div className="error-box dashboard-error" role="alert"><span>{error}</span><button className="error-close" type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={15} /></button></div>}
        <div className={`widget-grid ${loading ? 'is-refreshing' : ''}`} aria-live="polite">{dashboard.widgets.map((widget, index) => <WidgetCard key={`${widget.type}-${index}-${widget.title}`} widget={widget} index={index} taskOverrides={taskOverrides} onToggle={(key, value) => setTaskOverrides((previous) => ({ ...previous, [key]: value }))} />)}</div>
        <div className="data-note"><span className="data-note-dot" />{lastSourceFile ? `Generated from ${lastSourceFile}; review AI summaries and calculations against the source before relying on them.` : 'Without an uploaded CSV, figures are illustrative AI-generated examples rather than verified user data.'}</div>
        <form className="refine-bar" onSubmit={submitRefinement}><span className="refine-icon"><Sparkles size={16} /></span><label className="sr-only" htmlFor="refine-input">Refine this workspace</label><input id="refine-input" value={refinement} onChange={(event) => setRefinement(event.target.value)} placeholder="Ask for a change — add a weekly chart, simplify the layout…" maxLength={400} disabled={loading} /><button type="submit" disabled={loading || refinement.trim().length < 4}>{loading ? <LoaderCircle size={15} className="spinner" /> : <>Refine <ArrowRight size={14} /></>}</button></form>
        <div className="dashboard-bottom"><span>FLOWFORGE <span>·</span> GENERATIVE WORKSPACE</span><span>STRUCTURED OUTPUT <i /> VALIDATED WIDGETS <i /> SESSION-ONLY DATA</span></div>
      </section>}
    </main>
  </div>;
}
