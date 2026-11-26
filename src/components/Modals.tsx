import { useEffect, useRef } from 'react';
import { CheckCircle2, Cpu, FileSpreadsheet, KeyRound, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import type { ProviderChoice } from '../lib/schema';
import { parseCsvSummary } from '../lib/localEngine';

export type HealthInfo = {
  ok: boolean;
  providers: {
    huggingface: boolean;
    gemini: boolean;
    groq: boolean;
    openai: boolean;
    local: boolean;
  };
  models: {
    huggingface: string;
    gemini: string;
    groq: string;
    openai: string;
    local: string;
  };
  defaultProvider: string;
};

function ModalShell({
  open,
  onClose,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={cardRef}
        tabIndex={-1}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">{eyebrow}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close modal" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalShell open={open} onClose={onClose} eyebrow="FLOWFORGE ARCHITECTURE" title="How FlowForge works">
      <div className="guide-grid">
        <div className="guide-step">
          <span className="guide-num">01</span>
          <div>
            <h3>Describe a goal or attach a CSV</h3>
            <p>
              Enter any goal in plain language or attach a CSV up to 12 KB. FlowForge detects domains (SaaS KPIs,
              traffic &amp; SEO, finance, study, wellness) and parses real CSV numbers automatically.
            </p>
          </div>
        </div>
        <div className="guide-step">
          <span className="guide-num">02</span>
          <div>
            <h3>Strict Zod schema guard</h3>
            <p>
              AI models (Hugging Face Qwen 2.5 / Llama 3.3, Gemini 2.5 Flash) never author HTML or scripts. They return
              structured JSON validated on both server and browser across 8 safe interactive widget types.
            </p>
          </div>
        </div>
        <div className="guide-step">
          <span className="guide-num">03</span>
          <div>
            <h3>Interactive 3D workspace</h3>
            <p>
              Sort tables, switch chart types (Area / Line / Bar), add checklist items, adjust progress goals, edit
              notes, refine in place, or export your validated spec to JSON or Markdown.
            </p>
          </div>
        </div>
      </div>
      <div className="guide-shortcuts">
        <span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> Generate workspace</span>
        <span><kbd>Esc</kbd> Close dialogs</span>
        <span><ShieldCheck size={14} /> Session-only data · Zero database</span>
      </div>
    </ModalShell>
  );
}

const HF_MODELS = [
  'Qwen/Qwen2.5-72B-Instruct',
  'meta-llama/Llama-3.3-70B-Instruct',
  'mistralai/Mistral-Small-24B-Instruct-2501',
];

export function EngineModal({
  open,
  onClose,
  health,
  provider,
  setProvider,
  model,
  setModel,
  hfToken,
  setHfToken,
  geminiKey,
  setGeminiKey,
}: {
  open: boolean;
  onClose: () => void;
  health: HealthInfo | null;
  provider: ProviderChoice;
  setProvider: (p: ProviderChoice) => void;
  model: string;
  setModel: (m: string) => void;
  hfToken: string;
  setHfToken: (t: string) => void;
  geminiKey: string;
  setGeminiKey: (k: string) => void;
}) {
  return (
    <ModalShell open={open} onClose={onClose} eyebrow="AI & ANALYTICS ENGINE" title="Configure model & inference">
      <p className="modal-lead">
        FlowForge works out of the box with its real CSV + NLP engine, and upgrades to live open-weights Hugging Face
        or Gemini models whenever a server key or session token is active.
      </p>

      <div className="engine-status-grid">
        <div className={`engine-pill ${health?.providers.huggingface || hfToken ? 'is-ready' : ''}`}>
          <Cpu size={14} />
          <span>Hugging Face Router</span>
          <strong>{health?.providers.huggingface ? 'Server Ready' : hfToken ? 'Session Key' : 'Optional Token'}</strong>
        </div>
        <div className={`engine-pill ${health?.providers.gemini || geminiKey ? 'is-ready' : ''}`}>
          <Sparkles size={14} />
          <span>Google Gemini 2.5</span>
          <strong>{health?.providers.gemini ? 'Server Ready' : geminiKey ? 'Session Key' : 'Optional Key'}</strong>
        </div>
        <div className="engine-pill is-ready">
          <Zap size={14} />
          <span>Instant Local + CSV</span>
          <strong>Always Active</strong>
        </div>
      </div>

      <div className="engine-field">
        <label htmlFor="provider-select">Active Inference Mode</label>
        <select
          id="provider-select"
          value={provider}
          onChange={(e) => {
            const next = e.target.value as ProviderChoice;
            setProvider(next);
            if (next === 'huggingface' && !model) setModel(HF_MODELS[0]);
            if (next === 'gemini' && !model) setModel('gemini-2.5-flash');
          }}
        >
          <option value="auto">Auto (Cloud AI when available → Instant Local + CSV)</option>
          <option value="huggingface">Hugging Face Inference Router (Open Models)</option>
          <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
          <option value="local">Instant Local + Real CSV Engine (Zero latency)</option>
        </select>
      </div>

      {provider === 'huggingface' && (
        <div className="engine-field">
          <label htmlFor="hf-model-select">Hugging Face Model</label>
          <select id="hf-model-select" value={model || HF_MODELS[0]} onChange={(e) => setModel(e.target.value)}>
            {HF_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="engine-keys">
        <div className="engine-field">
          <label htmlFor="hf-token-input">
            <KeyRound size={12} /> Session Hugging Face Token (optional)
          </label>
          <input
            id="hf-token-input"
            type="password"
            value={hfToken}
            onChange={(e) => setHfToken(e.target.value)}
            placeholder="hf_... (kept in browser memory only)"
            autoComplete="off"
          />
        </div>
        <div className="engine-field">
          <label htmlFor="gemini-key-input">
            <KeyRound size={12} /> Session Gemini API Key (optional)
          </label>
          <input
            id="gemini-key-input"
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza... (kept in browser memory only)"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="modal-actions-end">
        <button type="button" className="primary-button" onClick={onClose}>
          <CheckCircle2 size={14} /> Apply engine settings
        </button>
      </div>
    </ModalShell>
  );
}

export function CsvPreviewModal({
  open,
  onClose,
  fileName,
  csvText,
}: {
  open: boolean;
  onClose: () => void;
  fileName: string;
  csvText: string;
}) {
  const summary = csvText ? parseCsvSummary(csvText) : null;
  return (
    <ModalShell open={open} onClose={onClose} eyebrow="UPLOADED DATASET" title={fileName || 'CSV Preview'}>
      {!summary ? (
        <p className="modal-lead">No valid CSV rows detected yet.</p>
      ) : (
        <>
          <div className="csv-meta-bar">
            <span><FileSpreadsheet size={14} /> {summary.rows.length} rows</span>
            <span>{summary.headers.length} columns</span>
            <span>{summary.numericColumns.length} numeric metrics</span>
          </div>
          <div className="table-scroll modal-table-wrap">
            <table>
              <thead>
                <tr>
                  {summary.headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.rows.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    {summary.headers.map((h) => (
                      <td key={h}>{row[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ModalShell>
  );
}
