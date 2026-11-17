import React, { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Upload, Video } from 'lucide-react';
import { Meeting, Task } from '../types';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';
import { taskAssigneeIds } from '../services/taskAssignees';

interface CalendarPageProps {
  meetings: Meeting[];
  tasks: Task[];
  onMeetingClick: (meeting: Meeting) => void;
  onTaskClick: (task: Task) => void;
  onNewMeeting: () => void;
  onUploadRecording: () => void;
}

const STATUS_CHIP: Record<Meeting['status'], string> = {
  live: 'bg-red-100 text-red-700 border-red-200',
  upcoming: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PRIORITY_DOT: Record<Task['priority'], string> = {
  high: 'bg-red-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
};

/** Deadlines may be free text ("No deadline"), so only ISO dates land on the grid. */
const parseDeadline = (deadline: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(deadline)) return null;
  const parsed = new Date(`${deadline.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const CalendarPage: React.FC<CalendarPageProps> = ({
  meetings,
  tasks,
  onMeetingClick,
  onTaskClick,
  onNewMeeting,
  onUploadRecording,
}) => {
  const { memberById } = useTeam();
  const { t, dateLocale } = useI18n();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    meetings.forEach((meeting) => {
      const date = new Date(meeting.date);
      if (Number.isNaN(date.getTime())) return;
      const key = format(date, 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), meeting]);
    });
    map.forEach((list) =>
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    );
    return map;
  }, [meetings]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const date = parseDeadline(task.deadline);
      if (!date) return;
      const key = format(date, 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return map;
  }, [tasks]);

  const undatedTasks = tasks.filter((task) => !parseDeadline(task.deadline));
  const selectedKey = format(selected, 'yyyy-MM-dd');
  const selectedMeetings = meetingsByDay.get(selectedKey) ?? [];
  const selectedTasks = tasksByDay.get(selectedKey) ?? [];

  const monthMeetings = meetings.filter((m) => {
    const date = new Date(m.date);
    return !Number.isNaN(date.getTime()) && isSameMonth(date, cursor);
  });

  const goToday = () => {
    const now = new Date();
    setCursor(now);
    setSelected(now);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t.calendar.title}</h1>
          <p className="text-slate-500 mt-1">
            {t.calendar.subtitle(monthMeetings.length, format(cursor, 'LLLL yyyy', { locale: dateLocale }))}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onUploadRecording}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Upload className="w-4 h-4" />
            {t.meetings.uploadRecording}
          </button>
          <button
            type="button"
            onClick={onNewMeeting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus className="w-4 h-4" />
            {t.meetings.newMeeting}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">{format(cursor, 'LLLL yyyy', { locale: dateLocale })}</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCursor((c) => subMonths(c, 1))}
                aria-label={t.calendar.previousMonth}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {t.common.today}
              </button>
              <button
                type="button"
                onClick={() => setCursor((c) => addMonths(c, 1))}
                aria-label={t.calendar.nextMonth}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 px-4 sm:px-6 py-2 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            <span>{t.calendar.taskDeadlines}</span>
            {(['high', 'medium', 'low'] as const).map((p) => (
              <span key={p} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[p]}`} />
                {t.priority[p]}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
            {days.slice(0, 7).map((day) => (
              <div
                key={`weekday-${format(day, 'i')}`}
                className="px-2 py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest"
              >
                {format(day, 'EEE', { locale: dateLocale })}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayMeetings = meetingsByDay.get(key) ?? [];
              const dayTasks = tasksByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const isSelected = isSameDay(day, selected);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelected(day)}
                  aria-label={t.calendar.dayLabel(format(day, 'PPPP', { locale: dateLocale }), dayMeetings.length, dayTasks.length)}
                  aria-pressed={isSelected}
                  className={`min-h-[104px] sm:min-h-[124px] p-1.5 sm:p-2 text-left border-b border-r border-slate-100 last-of-type:border-r-0 transition-colors ${
                    isSelected ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-300' : 'hover:bg-slate-50'
                  } ${inMonth ? '' : 'bg-slate-50/40'}`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-1 ${
                      isToday(day)
                        ? 'bg-blue-600 text-white'
                        : inMonth
                          ? 'text-slate-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  <span className="block space-y-1">
                    {dayMeetings.slice(0, 2).map((m) => (
                      <span
                        key={m.id}
                        className={`block truncate text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_CHIP[m.status]}`}
                      >
                        {m.title}
                      </span>
                    ))}
                    {dayMeetings.length > 2 && (
                      <span className="block text-[10px] font-bold text-slate-600 px-1.5">
                        {t.calendar.moreMeetings(dayMeetings.length - 2)}
                      </span>
                    )}
                    {dayTasks.slice(0, 2).map((task) => (
                      <span
                        key={task.id}
                        className="flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                        <span className={`truncate ${task.status === 'completed' ? 'line-through text-slate-500' : ''}`}>
                          {task.title}
                        </span>
                      </span>
                    ))}
                    {dayTasks.length > 2 && (
                      <span className="block text-[10px] font-bold text-slate-600 px-1.5">
                        {t.calendar.moreDue(dayTasks.length - 2)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
                {format(selected, 'EEEE, MMM d', { locale: dateLocale })}
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t.calendar.meetings}</p>
                {selectedMeetings.length === 0 && (
                  <p className="text-sm text-slate-500">{t.calendar.nothingScheduled}</p>
                )}
                <div className="space-y-2">
                  {selectedMeetings.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onMeetingClick(m)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left group"
                    >
                      <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                        <Video className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 truncate">{m.title}</span>
                        <span className="block text-xs text-slate-500">
                          {format(new Date(m.date), 'h:mm a', { locale: dateLocale })} • {m.duration}
                        </span>
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${STATUS_CHIP[m.status]}`}
                      >
                        {t.meetingStatus[m.status]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 mt-2">
                  {t.calendar.deadlines}
                </p>
                {selectedTasks.length === 0 && <p className="text-sm text-slate-500">{t.calendar.noDeadlines}</p>}
                <div className="space-y-2">
                  {selectedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onTaskClick(task)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all text-left"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 truncate">{task.title}</span>
                        <span className="block text-xs text-slate-500 capitalize">
                          {t.status[task.status]}
                          {taskAssigneeIds(task).length
                            ? ` • ${taskAssigneeIds(task).map((id) => memberById(id)?.name).filter(Boolean).join(', ')}`
                            : ` • ${t.common.unassigned}`}
                        </span>
                        {meetings.find((m) => m.id === task.meetingId) && (
                          <span className="block text-[10px] text-slate-500 truncate">
                            {t.calendar.fromMeeting(meetings.find((m) => m.id === task.meetingId)?.title ?? '')}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {undatedTasks.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{t.calendar.noDeadlineGroup}</h2>
                <span className="ml-auto text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {undatedTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {undatedTasks.slice(0, 5).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick(task)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                    <span className="text-sm text-slate-700 truncate">{task.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
