import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, LineChart as LineIcon, TrendingUp } from 'lucide-react';
import type { Widget } from '../lib/schema';

type ChartWidgetProps = {
  widget: Extract<Widget, { type: 'line_chart' | 'bar_chart' }>;
  index: number;
};

type ViewMode = 'area' | 'line' | 'bar';

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const summarize = (widget: ChartWidgetProps['widget']) =>
  `${widget.title}: ${widget.data.map((p) => `${p.label} ${numberFormat.format(p.value)}`).join(', ')}`;

const tooltipStyle = {
  background: 'rgba(17, 21, 19, 0.94)',
  border: '1px solid rgba(211, 255, 85, 0.25)',
  borderRadius: 10,
  color: '#f4f7f1',
  fontSize: 12,
  boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
};

export default function ChartWidget({ widget, index }: ChartWidgetProps) {
  const defaultMode: ViewMode = widget.type === 'bar_chart' ? 'bar' : 'area';
  const [mode, setMode] = useState<ViewMode>(defaultMode);

  const color =
    widget.type === 'line_chart'
      ? widget.color === 'cyan'
        ? '#78d6dd'
        : widget.color === 'violet'
          ? '#b3a3ff'
          : '#d3ff55'
      : '#d3ff55';

  const values = widget.data.map((d) => d.value);
  const latest = values.at(-1) ?? 0;
  const peak = values.length ? Math.max(...values) : 0;
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return (
    <div className="chart-wrap" role="img" aria-label={summarize(widget)}>
      <div className="chart-bar-top">
        <div className="chart-stats">
          <div className="chart-total">
            {numberFormat.format(latest)}
            <span> latest</span>
          </div>
          <span className="chart-mini-stat">Peak {numberFormat.format(peak)}</span>
          <span className="chart-mini-stat">Avg {numberFormat.format(avg)}</span>
        </div>
        <div className="chart-switcher" role="group" aria-label="Chart visualization mode">
          <button
            type="button"
            className={mode === 'area' ? 'is-active' : ''}
            onClick={() => setMode('area')}
            title="Area view"
            aria-pressed={mode === 'area'}
          >
            <TrendingUp size={12} />
          </button>
          <button
            type="button"
            className={mode === 'line' ? 'is-active' : ''}
            onClick={() => setMode('line')}
            title="Line view"
            aria-pressed={mode === 'line'}
          >
            <LineIcon size={12} />
          </button>
          <button
            type="button"
            className={mode === 'bar' ? 'is-active' : ''}
            onClick={() => setMode('bar')}
            title="Bar view"
            aria-pressed={mode === 'bar'}
          >
            <BarChart3 size={12} />
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={184}>
        {mode === 'bar' ? (
          <BarChart data={widget.data} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={`bar-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9aa49c', fontSize: 11 }} dy={7} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9aa49c', fontSize: 11 }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip
              cursor={{ fill: 'rgba(211,255,85,.04)' }}
              contentStyle={tooltipStyle}
              formatter={(value) => [numberFormat.format(Number(value)), 'Value']}
            />
            <Bar dataKey="value" fill={`url(#bar-${index})`} radius={[6, 6, 2, 2]} maxBarSize={36} />
          </BarChart>
        ) : mode === 'line' ? (
          <LineChart data={widget.data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9aa49c', fontSize: 11 }} dy={7} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9aa49c', fontSize: 11 }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [numberFormat.format(Number(value)), 'Value']} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0c0f0e', stroke: color, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: color, stroke: '#111612', strokeWidth: 2 }}
            />
          </LineChart>
        ) : (
          <AreaChart data={widget.data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={`fill-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9aa49c', fontSize: 11 }} dy={7} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9aa49c', fontSize: 11 }}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [numberFormat.format(Number(value)), 'Value']} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.3}
              fill={`url(#fill-${index})`}
              activeDot={{ r: 4.5, fill: color, stroke: '#182011', strokeWidth: 2 }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
