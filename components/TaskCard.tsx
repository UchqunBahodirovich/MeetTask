import React from 'react';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import {
  Calendar,
  User,
  Sparkles,
  CheckCircle2,
  GripVertical,
  Pencil,
  Trash2,
  Video,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Task } from '../types';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';
import { SPRING_MOMENTUM, SPRING_UI } from './ui/motion';
import { Avatar } from './ui/Avatar';
import { needsOwnerClarification } from '../services/taskAssignees';

interface TaskCardProps {
  task: Task;
  meetingTitle?: string;
  onApprove?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Pointer/keyboard alternatives to dragging; omitted at the ends of the board. */
  onMovePrevious?: { label: string; move: () => void };
  onMoveNext?: { label: string; move: () => void };
  draggable?: boolean;
  isDragging?: boolean;
  isFocused?: boolean;
  onDragStart?: () => void;
  onDrag?: (info: PanInfo) => void;
  onDragEnd?: (info: PanInfo) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  meetingTitle,
  onApprove,
  onEdit,
  onDelete,
  onMovePrevious,
  onMoveNext,
  draggable,
  isDragging,
  isFocused,
  onDragStart,
  onDrag,
  onDragEnd,
}) => {
  const { memberById } = useTeam();
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  // A task can have several owners; assigneeId stays the first one for the
  // places that only need a single name.
  const assigneeIds = task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [];
  const assignees = assigneeIds.map(memberById).filter((member): member is NonNullable<typeof member> => Boolean(member));
  const assignee = assignees[0];
  const needsApproval = task.isAiGenerated && !task.isApproved;

  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-red-100 text-red-700',
  };

  const dragProps = draggable
    ? {
        drag: true as const,
        // Movement stays glued to the pointer; past the board edge it resists
        // progressively instead of stopping dead.
        dragElastic: 0.35,
        dragSnapToOrigin: true,
        dragMomentum: false,
        dragTransition: SPRING_MOMENTUM,
        onDragStart: () => onDragStart?.(),
        onDrag: (_event: PointerEvent, info: PanInfo) => onDrag?.(info),
        onDragEnd: (_event: PointerEvent, info: PanInfo) => onDragEnd?.(info),
        whileDrag: reduceMotion ? undefined : { scale: 1.03, rotate: -0.4 },
        style: { touchAction: 'none' as const },
      }
    : {};

  return (
    <motion.div
      data-task-id={task.id}
      layout={!reduceMotion}
      transition={SPRING_UI}
      {...dragProps}
      className={`bg-white border rounded-xl p-4 transition-shadow group relative ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragging ? 'shadow-2xl shadow-slate-400/30 z-50 cursor-grabbing' : 'hover:shadow-md'} ${
        isFocused ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'
      }`}
    >
      {needsOwnerClarification(task) && (
        <p className="mb-3 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
          {t.taskCard.ownerUnclear}
        </p>
      )}
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
          <span className="text-[10px] font-medium text-slate-500 capitalize mr-1 sm:group-hover:hidden">
            {t.status[task.status]}
          </span>
          {/* Actions stay visible on touch, where there is no hover to reveal them. */}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label={t.taskCard.editLabel(task.title)}
              className="flex sm:hidden sm:group-hover:flex p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={t.taskCard.deleteLabel(task.title)}
              className="flex sm:hidden sm:group-hover:flex p-1 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Dragging cannot be the only way to move a card: these buttons give
              the same result to keyboard and single-pointer users. */}
          {onMovePrevious && (
            <button
              type="button"
              onClick={onMovePrevious.move}
              aria-label={onMovePrevious.label}
              title={onMovePrevious.label}
              className="flex sm:hidden sm:group-hover:flex sm:group-focus-within:flex p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {onMoveNext && (
            <button
              type="button"
              onClick={onMoveNext.move}
              aria-label={onMoveNext.label}
              title={onMoveNext.label}
              className="flex sm:hidden sm:group-hover:flex sm:group-focus-within:flex p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          {draggable && <GripVertical className="w-3.5 h-3.5 text-slate-300 hidden sm:group-hover:block" />}
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
              <span className="flex -space-x-1.5 shrink-0">
                {assignees.slice(0, 3).map((member) => (
                  <Avatar
                    key={member.id}
                    name={member.name}
                    src={member.avatar}
                    className="w-5 h-5 ring-2 ring-white"
                    textClassName="text-[8px]"
                  />
                ))}
              </span>
              <span className="truncate">
                {assignees.length > 1
                  ? assignees.map((member) => member.name.split(' ')[0]).join(', ')
                  : assignee.name}
              </span>
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
                <User className="w-3 h-3 text-slate-500" />
              </div>
              <span className="italic text-slate-500">{t.common.unassigned}</span>
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
    </motion.div>
  );
};
