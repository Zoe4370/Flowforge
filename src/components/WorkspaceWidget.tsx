import { lazy, Suspense, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import {
  Activity,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Edit3,
  Layers3,
  Minus,
  Plus,
  Search,
  Sparkles,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import type { Widget } from '../lib/schema.js';

const ChartWidget = lazy(() => import('./ChartWidget'));

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

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  tiltEnabled?: boolean;
};

function Surface({ children, className = '', delay = 0, tiltEnabled = true }: SurfaceProps) {
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = tiltEnabled && !prefersReducedMotion;
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
    if (!motionEnabled) return;
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
      style={motionEnabled ? { rotateX, rotateY, transformPerspective: 1100 } : undefined}
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

export function WidgetCard({
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
        <Suspense fallback={<div className="chart-skeleton" role="status" aria-label="Loading chart" />}>
          <ChartWidget widget={widget} />
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
                  aria-pressed={done}
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
