import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  ArrowRight,
  Box,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Layers3,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Plus,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import AmbientStage from './components/AmbientStage';
import { CompositionCard } from './components/CompositionCard';
import { WidgetCard } from './components/WorkspaceWidget';
import { CsvPreviewModal, EngineModal, GuideModal, type HealthInfo } from './components/Modals';
import { examples, sampleCsvData, sampleCsvName } from './lib/examples';
import { parseCsvSummary, synthesizeDashboard } from './lib/localEngine';
import { specToMarkdown } from './lib/markdownExport';
import { describeDataProvenance } from './lib/dataProvenance';
import { dashboardSpecSchema, type DashboardSpec, type ProviderChoice } from './lib/schema';

type WorkspaceSession = {
  id: string;
  spec: DashboardSpec;
  prompt: string;
  sourceData: string;
  sourceFileName: string;
  engineLabel: string;
  createdAt: number;
};

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
  const activeCsvText = activeSession ? activeSession.sourceData : sourceData;
  const dataProvenance = useMemo(
    () => describeDataProvenance({
      sourceData: activeCsvText,
      sourceFileName: lastSourceFile,
      engineLabel: activeSession?.engineLabel ?? '',
    }),
    [activeCsvText, lastSourceFile, activeSession?.engineLabel],
  );

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
      if (text.length > 12_000) {
        setError('CSV files are limited to 12 KB. Trim extra rows or columns and try again.');
        return;
      }
      if (!parseCsvSummary(text)) {
        setError('This CSV could not be parsed. Add a header row and data row, and check its quoting and columns.');
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
    const content = kind === 'json'
      ? JSON.stringify(dashboard, null, 2)
      : specToMarkdown(dashboard, lastGoal, dataProvenance);
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
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {loading ? loadingStage : error ? error : dashboard ? 'Workspace ready.' : ''}
        </div>
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

              <div className={`widget-grid ${loading ? 'is-refreshing' : ''}`}>
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
                <span>{dataProvenance}</span>
                <span>Charts, tables, tasks, notes, and progress controls are interactive.</span>
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
