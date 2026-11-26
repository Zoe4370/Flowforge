import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export function CompositionCard({ onTryDemo }: { onTryDemo: () => void }) {
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
            id="preview-tab-pipeline"
            aria-controls="preview-panel-pipeline"
            aria-selected={tab === 'pipeline'}
            className={tab === 'pipeline' ? 'is-active' : ''}
            onClick={() => setTab('pipeline')}
          >
            Flow
          </button>
          <button
            type="button"
            role="tab"
            id="preview-tab-schema"
            aria-controls="preview-panel-schema"
            aria-selected={tab === 'schema'}
            className={tab === 'schema' ? 'is-active' : ''}
            onClick={() => setTab('schema')}
          >
            Schema
          </button>
          <button
            type="button"
            role="tab"
            id="preview-tab-preview"
            aria-controls="preview-panel-preview"
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
        <div id="preview-panel-pipeline" role="tabpanel" aria-labelledby="preview-tab-pipeline" tabIndex={0}>
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
        </div>
      )}

      {tab === 'schema' && (
        <pre id="preview-panel-schema" role="tabpanel" aria-labelledby="preview-tab-schema" tabIndex={0} className="preview-code" aria-label="Dashboard JSON schema preview">{`{
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
        <div id="preview-panel-preview" role="tabpanel" aria-labelledby="preview-tab-preview" tabIndex={0} className="preview-mini-dash">
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
