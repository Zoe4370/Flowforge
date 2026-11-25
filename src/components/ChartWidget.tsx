import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Widget } from '../lib/schema';

type ChartWidgetProps = { widget: Extract<Widget, { type: 'line_chart' | 'bar_chart' }>; index: number };
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const tooltipStyle = { background: '#171b18', border: '1px solid #343b34', borderRadius: 10, color: '#fff', fontSize: 12 };

export default function ChartWidget({ widget, index }: ChartWidgetProps) {
  if (widget.type === 'line_chart') {
    const color = widget.color === 'cyan' ? '#78d6dd' : widget.color === 'violet' ? '#b3a3ff' : '#d3ff55';
    return <div className="chart-wrap"><div className="chart-total">{money.format(widget.data.at(-1)?.value ?? 0)}<span> latest</span></div><ResponsiveContainer width="100%" height={174}><AreaChart data={widget.data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}><defs><linearGradient id={`fill-${index}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.24} /><stop offset="95%" stopColor={color} stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#777f79', fontSize: 10 }} dy={7} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#777f79', fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [money.format(Number(value)), 'Value']} /><Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.2} fill={`url(#fill-${index})`} activeDot={{ r: 4, fill: '#d3ff55', stroke: '#182011', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div>;
  }
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height={205}><BarChart data={widget.data} margin={{ top: 16, right: 4, bottom: 0, left: -19 }}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#777f79', fontSize: 10 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#777f79', fontSize: 10 }} /><Tooltip cursor={{ fill: 'rgba(255,255,255,.035)' }} contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#d3ff55" radius={[5, 5, 1, 1]} maxBarSize={34} /></BarChart></ResponsiveContainer></div>;
}
