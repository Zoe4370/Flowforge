import { parseCsvSummary } from './localEngine.js';

type ProvenanceInput = {
  sourceData: string;
  sourceFileName?: string;
  engineLabel?: string;
};

function cleanFileName(fileName: string): string {
  return fileName.trim().replace(/[\u0000-\u001f`]/g, ' ').slice(0, 120);
}

export function describeDataProvenance({ sourceData, sourceFileName = '', engineLabel = '' }: ProvenanceInput): string {
  if (!sourceData.trim()) {
    return 'No CSV was attached. Values are AI-generated suggestions or illustrative local examples, not measurements from your records.';
  }

  const file = cleanFileName(sourceFileName);
  const source = file ? `File “${file}”` : 'The attached CSV';
  const summary = parseCsvSummary(sourceData);
  if (!summary) {
    return `${source} could not be parsed as a supported CSV. Treat generated values as illustrative until the input is corrected.`;
  }

  const shape = `${summary.rows.length} data rows × ${summary.headers.length} columns`;
  if (engineLabel === 'CSV + Local Engine' || engineLabel === 'Browser CSV Engine') {
    return `Derived from ${source} (${shape}) by FlowForge’s local CSV engine. Numeric totals, averages, and charts use parsed numeric cells; blank and non-numeric cells are excluded. Input accuracy, units, and meaning are not independently verified.`;
  }

  const engine = engineLabel.trim() || 'the selected AI engine';
  return `${source} (${shape}) was supplied to ${engine} as context. AI-generated values may be estimates or transformations, not deterministic or independently verified calculations; inspect the source before relying on them.`;
}
