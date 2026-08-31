import React from 'react';
import { Calendar, User, Sparkles, CheckCircle2, GripVertical, Pencil, Trash2, Video } from 'lucide-react';
import { Task } from '../types';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';

interface TaskCardProps {
  task: Task;
  meetingTitle?: string;
  onApprove?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  isFocused?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  meetingTitle,
  onApprove,
  onEdit,
  onDelete,
  draggable,
  isDragging,
  isFocused,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => {
  const { memberById } = useTeam();
  const { t } = useI18n();
  const assignee = memberById(task.assigneeId);
  const needsApproval = task.isAiGenerated && !task.isApproved;

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`bg-white border rounded-xl p-4 hover:shadow-md transition-all group relative ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'opacity-40 ring-2 ring-blue-300 ring-offset-2' : ''} ${
        isFocused ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'
      }`}
    >
      {needsApproval && (
        <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-full shadow-lg z-10" title={t.taskCard.aiGenerated}>
          <Sparkles className="w-3 h-3" />
        </div>
      )}

      <div className="flex justify-between items-start mb-3 gap-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${priorityColors[task.priority]}`}>
          {t.priority[task.priority]}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="text-[10px] font-medium text-slate-400 capitalize mr-1 group-hover:hidden">
            {t.status[task.status]}
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={t.taskCard.editLabel(task.title)}
              className="hidden group-hover:flex p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t.taskCard.deleteLabel(task.title)}
              className="hidden group-hover:flex p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {draggable && <GripVertical className="w-3.5 h-3.5 text-slate-300 hidden group-hover:block" />}
        </div>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-3 leading-tight">{task.title}</h4>

      {task.description && (
        <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">{task.description}</p>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          {t.taskCard.due(task.deadline)}
        </div>
        {meetingTitle && (
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <Video className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{meetingTitle}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {assignee ? (
            <>
              <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                <img src={assignee.avatar} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="truncate">{assignee.name}</span>
              {task.assigneeSource === 'role' && (
                <span
                  title={t.taskCard.byRoleTitle(assignee.role ?? '—')}
                  className="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold uppercase tracking-wider"
                >
                  {t.taskCard.byRole}
                </span>
              )}
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-slate-400" />
              </div>
              <span className="italic text-slate-400">{t.common.unassigned}</span>
            </>
          )}
        </div>
      </div>

      {needsApproval && (
        <div className="pt-3 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={!onApprove}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t.common.approve}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={!onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.common.edit}
          </button>
        </div>
      )}
    </div>
  );
};
