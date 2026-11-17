import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PanInfo } from 'framer-motion';
import {
  List,
  LayoutGrid,
  Plus,
  Filter,
  MoreVertical,
  Clock,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Meeting, Priority, Task, TaskFilters, TaskStatus } from '../types';
import { TaskCard } from '../components/TaskCard';
import { Popover } from '../components/ui/Popover';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EMPTY_TASK_FILTERS } from '../constants';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';
import { projectMomentum } from '../components/ui/motion';
import { taskAssigneeIds } from '../services/taskAssignees';
import { Select } from '../components/ui/Select';

interface TasksPageProps {
  tasks: Task[];
  meetings: Meeting[];
  defaultView?: 'kanban' | 'list';
  /** Move a task to a column; when `beforeTaskId` is given, insert it before that task. */
  onTaskMove: (taskId: string, status: TaskStatus, beforeTaskId?: string) => void;
  onTaskApprove: (taskId: string) => void;
  onCreateTask: (status?: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  /** Task highlighted after arriving from search or a notification. */
  focusedTaskId?: string;
}

const COLUMNS: { id: TaskStatus; dot: string; ring: string }[] = [
  { id: 'todo', dot: 'bg-slate-500', ring: 'border-slate-300 bg-slate-100/70' },
  { id: 'in-progress', dot: 'bg-blue-500', ring: 'border-blue-300 bg-blue-50/70' },
  { id: 'review', dot: 'bg-orange-500', ring: 'border-orange-300 bg-orange-50/70' },
  { id: 'completed', dot: 'bg-green-500', ring: 'border-green-300 bg-green-50/70' },
];

const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'bg-slate-300',
  'in-progress': 'bg-blue-500',
  review: 'bg-orange-500',
  completed: 'bg-green-500',
};

const CheckRow: React.FC<{
  label: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={onChange} className="w-3.5 h-3.5 accent-blue-600" />
    <span className="text-sm text-slate-600 flex-1 min-w-0 truncate">{label}</span>
  </label>
);

export const TasksPage: React.FC<TasksPageProps> = ({
  tasks,
  meetings,
  defaultView,
  onTaskMove,
  onTaskApprove,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  focusedTaskId,
}) => {
  const { team } = useTeam();
  const { t } = useI18n();
  const columnLabel = (id: TaskStatus) => t.status[id];
  const [view, setView] = useState<'kanban' | 'list'>(defaultView ?? 'kanban');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  useEffect(() => {
    if (defaultView) setView(defaultView);
  }, [defaultView]);

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const activeFilterCount =
    filters.statuses.length +
    filters.priorities.length +
    filters.assigneeIds.length +
    filters.meetingIds.length +
    (filters.query.trim() ? 1 : 0) +
    (filters.aiOnly ? 1 : 0) +
    (filters.pendingApprovalOnly ? 1 : 0);

  const filteredTasks = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (q && !`${task.title} ${task.description ?? ''}`.toLowerCase().includes(q)) return false;
      if (filters.statuses.length && !filters.statuses.includes(task.status)) return false;
      if (filters.priorities.length && !filters.priorities.includes(task.priority)) return false;
      const owners = taskAssigneeIds(task);
      if (filters.assigneeIds.length && !filters.assigneeIds.some((id) =>
        id === 'unassigned' ? owners.length === 0 : owners.includes(id),
      )) return false;
      if (filters.meetingIds.length && !filters.meetingIds.includes(task.meetingId || 'none')) return false;
      if (filters.aiOnly && !task.isAiGenerated) return false;
      if (filters.pendingApprovalOnly && !(task.isAiGenerated && !task.isApproved)) return false;
      return true;
    });
  }, [tasks, filters]);

  const getTasksByStatus = (status: TaskStatus) => filteredTasks.filter((t) => t.status === status);

  const columnRectsRef = useRef<{ id: TaskStatus; left: number; right: number }[]>([]);
  const cardMidsRef = useRef<Record<string, { id: string; midY: number }[]>>({});

  /** Cache column and card geometry once per drag so each frame stays cheap. */
  const handleDragStart = (task: Task) => () => {
    const mids: Record<string, { id: string; midY: number }[]> = {};
    columnRectsRef.current = COLUMNS.map((col) => {
      const element = document.querySelector(`[data-column="${col.id}"]`);
      const rect = element?.getBoundingClientRect();
      mids[col.id] = Array.from(element?.querySelectorAll('[data-task-id]') ?? []).map((card) => {
        const cardRect = card.getBoundingClientRect();
        return { id: (card as HTMLElement).dataset.taskId ?? '', midY: cardRect.top + cardRect.height / 2 };
      });
      return { id: col.id, left: rect?.left ?? 0, right: rect?.right ?? 0 };
    });
    cardMidsRef.current = mids;
    setDraggingId(task.id);
  };

  /** Which column sits under an x position, or the nearest one past the edges. */
  const columnAt = (x: number): TaskStatus | null => {
    const rects = columnRectsRef.current;
    if (rects.length === 0) return null;
    const hit = rects.find((rect) => x >= rect.left && x <= rect.right);
    if (hit) return hit.id;
    return x < rects[0].left ? rects[0].id : rects[rects.length - 1].id;
  };

  // Feedback follows the pointer the whole way through, not only on release.
  const handleDrag = () => (info: PanInfo) => {
    const next = columnAt(info.point.x);
    if (next !== overColumn) setOverColumn(next);
  };

  const handleDragEnd = (task: Task) => (info: PanInfo) => {
    // Land where the flick was going, not where the finger happened to stop.
    // Snap targets here are dense columns, so the throw is capped at half a
    // column: momentum decides the outcome when the card is released near a
    // boundary, but a card let go over a column stays in that column however
    // fast the pointer was still moving.
    const rects = columnRectsRef.current;
    const columnWidth = rects.length ? rects[0].right - rects[0].left : 240;
    const carry = (velocity: number) => {
      const limit = columnWidth / 2;
      return Math.max(-limit, Math.min(limit, projectMomentum(velocity, 0.99)));
    };

    const projectedX = info.point.x + carry(info.velocity.x);
    const projectedY = info.point.y + carry(info.velocity.y);
    const target = columnAt(projectedX) ?? columnAt(info.point.x);

    if (target) {
      // Insert above the first card the projected landing point sits before.
      const before = (cardMidsRef.current[target] ?? []).find(
        (card) => card.id !== task.id && projectedY < card.midY,
      );
      const movedColumn = target !== task.status;
      if (movedColumn || before) onTaskMove(task.id, target, before?.id);
    }

    setDraggingId(null);
    setOverColumn(null);
  };

  const meetingTitle = (meetingId: string) => meetings.find((m) => m.id === meetingId)?.title ?? '—';

  const rowMenu = (task: Task) => (
    <Popover
      open={menuTaskId === task.id}
      onClose={() => setMenuTaskId(null)}
      panelClassName="w-44"
      trigger={
        <button
          type="button"
          onClick={() => setMenuTaskId((id) => (id === task.id ? null : task.id))}
          aria-label={t.tasks.actionsFor(task.title)}
          aria-expanded={menuTaskId === task.id}
          className={`p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all ${
            menuTaskId === task.id ? 'opacity-100 text-slate-600' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      }
    >
      <div className="p-1.5">
        <button
          type="button"
          onClick={() => {
            setMenuTaskId(null);
            onEditTask(task);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Pencil className="w-4 h-4" />
          {t.common.edit}
        </button>
        {task.isAiGenerated && !task.isApproved && (
          <button
            type="button"
            onClick={() => {
              setMenuTaskId(null);
              onTaskApprove(task.id);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t.common.approve}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setMenuTaskId(null);
            setPendingDelete(task);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          {t.common.delete}
        </button>
      </div>
    </Popover>
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t.tasks.title}</h1>
          <p className="text-slate-500 mt-1">
            {t.tasks.subtitle}
            {view === 'kanban' && (
              <span className="hidden md:inline text-slate-500">{t.tasks.dragHint}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-white border border-slate-200 rounded-xl p-1 flex">
            <button
              type="button"
              onClick={() => setView('kanban')}
              aria-label={t.tasks.kanbanView}
              aria-pressed={view === 'kanban'}
              className={`p-2 rounded-lg transition-all ${view === 'kanban' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label={t.tasks.listView}
              aria-pressed={view === 'list'}
              className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <Popover
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            panelClassName="w-80"
            trigger={
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                aria-expanded={filterOpen}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  activeFilterCount > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                {t.tasks.filter}
                {activeFilterCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            }
          >
            <div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white">
                <p className="text-sm font-bold text-slate-900">{t.tasks.filters}</p>
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_TASK_FILTERS)}
                  disabled={activeFilterCount === 0}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  {t.tasks.clearAll}
                </button>
              </div>

              <div className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="relative">
                  <input
                    value={filters.query}
                    onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                    placeholder={t.tasks.searchTitle}
                    aria-label={t.tasks.searchLabel}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <p className="px-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.tasks.filterStatus}</p>
                  {COLUMNS.map((c) => (
                    <CheckRow
                      key={c.id}
                      label={columnLabel(c.id)}
                      checked={filters.statuses.includes(c.id)}
                      onChange={() => setFilters((f) => ({ ...f, statuses: toggleIn(f.statuses, c.id) }))}
                    />
                  ))}
                </div>

                <div>
                  <p className="px-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.tasks.filterPriority}</p>
                  {PRIORITIES.map((p) => (
                    <CheckRow
                      key={p}
                      label={<span className="capitalize">{t.priority[p]}</span>}
                      checked={filters.priorities.includes(p)}
                      onChange={() => setFilters((f) => ({ ...f, priorities: toggleIn(f.priorities, p) }))}
                    />
                  ))}
                </div>

                <div>
                  <p className="px-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.tasks.filterAssignee}</p>
                  {team.map((u) => (
                    <CheckRow
                      key={u.id}
                      label={u.role ? `${u.name} — ${u.role}` : u.name}
                      checked={filters.assigneeIds.includes(u.id)}
                      onChange={() => setFilters((f) => ({ ...f, assigneeIds: toggleIn(f.assigneeIds, u.id) }))}
                    />
                  ))}
                  <CheckRow
                    label={t.common.unassigned}
                    checked={filters.assigneeIds.includes('unassigned')}
                    onChange={() => setFilters((f) => ({ ...f, assigneeIds: toggleIn(f.assigneeIds, 'unassigned') }))}
                  />
                </div>

                <div>
                  <p className="px-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.tasks.filterMeeting}</p>
                  {meetings.map((m) => (
                    <CheckRow
                      key={m.id}
                      label={m.title}
                      checked={filters.meetingIds.includes(m.id)}
                      onChange={() => setFilters((f) => ({ ...f, meetingIds: toggleIn(f.meetingIds, m.id) }))}
                    />
                  ))}
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <CheckRow
                    label={t.tasks.aiOnly}
                    checked={filters.aiOnly}
                    onChange={() => setFilters((f) => ({ ...f, aiOnly: !f.aiOnly }))}
                  />
                  <CheckRow
                    label={t.tasks.awaitingApproval}
                    checked={filters.pendingApprovalOnly}
                    onChange={() => setFilters((f) => ({ ...f, pendingApprovalOnly: !f.pendingApprovalOnly }))}
                  />
                </div>
              </div>
            </div>
          </Popover>

          <button
            type="button"
            onClick={() => onCreateTask()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            {t.tasks.addTask}
          </button>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50/70 border border-blue-100 rounded-xl">
          <p className="text-sm text-blue-800 font-medium">
            {t.tasks.showing(filteredTasks.length, tasks.length)}
          </p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_TASK_FILTERS)}
            className="ml-auto flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"
          >
            <X className="w-3.5 h-3.5" />
            {t.tasks.clearFilters}
          </button>
        </div>
      )}

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {COLUMNS.map((col, columnIndex) => {
            const colTasks = getTasksByStatus(col.id);
            const isOver = overColumn === col.id && draggingId !== null;
            return (
              <div key={col.id} className="flex flex-col gap-4 min-w-0">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`}></div>
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">{columnLabel(col.id)}</h3>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateTask(col.id)}
                    aria-label={t.tasks.addToColumn(columnLabel(col.id))}
                    className="text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div
                  data-column={col.id}
                  data-over={isOver ? 'true' : 'false'}
                  className={`task-kanban-column flex-1 rounded-2xl p-3 border min-h-[160px] lg:min-h-[600px] space-y-4 transition-colors ${
                    isOver ? `border-dashed ${col.ring}` : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      meetingTitle={task.meetingId ? meetingTitle(task.meetingId) : undefined}
                      draggable
                      isDragging={draggingId === task.id}
                      isFocused={focusedTaskId === task.id}
                      onDragStart={handleDragStart(task)}
                      onDrag={handleDrag()}
                      onDragEnd={handleDragEnd(task)}
                      onApprove={() => onTaskApprove(task.id)}
                      onEdit={() => onEditTask(task)}
                      onDelete={() => setPendingDelete(task)}
                      onMovePrevious={
                        columnIndex > 0
                          ? {
                              label: t.taskCard.moveLeft(columnLabel(COLUMNS[columnIndex - 1].id)),
                              move: () => onTaskMove(task.id, COLUMNS[columnIndex - 1].id),
                            }
                          : undefined
                      }
                      onMoveNext={
                        columnIndex < COLUMNS.length - 1
                          ? {
                              label: t.taskCard.moveRight(columnLabel(COLUMNS[columnIndex + 1].id)),
                              move: () => onTaskMove(task.id, COLUMNS[columnIndex + 1].id),
                            }
                          : undefined
                      }
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div
                      className={`task-kanban-empty h-32 flex items-center justify-center border-2 border-dashed rounded-xl transition-colors ${
                        isOver ? 'border-blue-300 bg-white/60' : 'border-slate-200'
                      }`}
                    >
                      {isOver || activeFilterCount > 0 ? (
                        <p className="text-xs font-medium text-slate-500">
                          {isOver ? t.tasks.dropHere : t.tasks.noMatches}
                        </p>
                      ) : (
                        // An empty column should offer the next step, not just report emptiness.
                        <button
                          type="button"
                          onClick={() => onCreateTask(col.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {t.tasks.addTask}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.tasks.colTask}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.tasks.colMeeting}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.tasks.colPriority}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.tasks.colDeadline}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.tasks.colStatus}</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`hover:bg-slate-50/50 transition-colors group ${
                      focusedTaskId === task.id ? 'bg-blue-50/60' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[task.status]}`}></div>
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors text-left"
                        >
                          {task.title}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">{meetingTitle(task.meetingId)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          task.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : task.priority === 'medium'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.priority[task.priority]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-500 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5" />
                        {task.deadline}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Select
                        value={task.status}
                        onChange={(status) => onTaskMove(task.id, status)}
                        options={COLUMNS.map((c) => ({ value: c.id, label: columnLabel(c.id) }))}
                        ariaLabel={t.tasks.statusFor(task.title)}
                        className="min-w-[124px] text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">{rowMenu(task)}</div>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                      {tasks.length === 0 ? t.tasks.noTasksYet : t.tasks.noFilterMatches}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t.tasks.deleteTitle}
        message={t.tasks.deleteMessage(pendingDelete?.title ?? '')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) onDeleteTask(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </div>
  );
};
