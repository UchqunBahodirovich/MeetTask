import React, { useEffect, useMemo, useState } from 'react';
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

const DND_MIME = 'application/x-meettask-task';

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
      if (filters.assigneeIds.length && !filters.assigneeIds.includes(task.assigneeId || 'unassigned')) return false;
      if (filters.meetingIds.length && !filters.meetingIds.includes(task.meetingId || 'none')) return false;
      if (filters.aiOnly && !task.isAiGenerated) return false;
      if (filters.pendingApprovalOnly && !(task.isAiGenerated && !task.isApproved)) return false;
      return true;
    });
  }, [tasks, filters]);

  const getTasksByStatus = (status: TaskStatus) => filteredTasks.filter((t) => t.status === status);

  const handleDragStart = (task: Task) => (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(DND_MIME, task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(task.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverColumn(null);
  };

  const handleColumnDragOver = (status: TaskStatus) => (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overColumn !== status) setOverColumn(status);
  };

  const readDraggedId = (e: React.DragEvent) => e.dataTransfer.getData(DND_MIME) || draggingId;

  const handleColumnDrop = (status: TaskStatus) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = readDraggedId(e);
    if (id) onTaskMove(id, status);
    handleDragEnd();
  };

  const handleCardDrop = (target: Task) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const id = readDraggedId(e);
    if (id && id !== target.id) onTaskMove(id, target.status, target.id);
    handleDragEnd();
  };

  const handleCardDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
              <span className="hidden md:inline text-slate-400">{t.tasks.dragHint}</span>
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
              className={`p-2 rounded-lg transition-all ${view === 'kanban' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label={t.tasks.listView}
              aria-pressed={view === 'list'}
              className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                  <p className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.tasks.filterStatus}</p>
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
                  <p className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.tasks.filterPriority}</p>
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
                  <p className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.tasks.filterAssignee}</p>
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
                  <p className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.tasks.filterMeeting}</p>
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
          {COLUMNS.map((col) => {
            const colTasks = getTasksByStatus(col.id);
            const isOver = overColumn === col.id && draggingId !== null;
            return (
              <div key={col.id} className="flex flex-col gap-4 min-w-0">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`}></div>
                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">{columnLabel(col.id)}</h3>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateTask(col.id)}
                    aria-label={t.tasks.addToColumn(columnLabel(col.id))}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div
                  data-column={col.id}
                  onDragOver={handleColumnDragOver(col.id)}
                  onDragLeave={(e) => {
                    // Only clear when leaving the column itself, not when moving between its children.
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverColumn(null);
                  }}
                  onDrop={handleColumnDrop(col.id)}
                  className={`flex-1 rounded-2xl p-3 border min-h-[160px] lg:min-h-[600px] space-y-4 transition-colors ${
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
                      onDragEnd={handleDragEnd}
                      onDragOver={handleCardDragOver}
                      onDrop={handleCardDrop(task)}
                      onApprove={() => onTaskApprove(task.id)}
                      onEdit={() => onEditTask(task)}
                      onDelete={() => setPendingDelete(task)}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div
                      className={`h-32 flex items-center justify-center border-2 border-dashed rounded-xl transition-colors ${
                        isOver ? 'border-blue-300 bg-white/60' : 'border-slate-200'
                      }`}
                    >
                      <p className="text-xs font-medium text-slate-400">
                        {isOver ? t.tasks.dropHere : activeFilterCount > 0 ? t.tasks.noMatches : t.tasks.noTasks}
                      </p>
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.tasks.colTask}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.tasks.colMeeting}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.tasks.colPriority}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.tasks.colDeadline}</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t.tasks.colStatus}</th>
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
                      <select
                        value={task.status}
                        onChange={(e) => onTaskMove(task.id, e.target.value as TaskStatus)}
                        aria-label={t.tasks.statusFor(task.title)}
                        className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-500"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {columnLabel(c.id)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">{rowMenu(task)}</div>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
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
