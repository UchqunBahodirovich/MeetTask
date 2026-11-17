import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Meeting, Task } from '../types';
import { MeetingCard } from '../components/MeetingCard';
import { TaskCard } from '../components/TaskCard';
import { useI18n } from '../i18n';
import { TrendingUp, Users, Clock, CheckCircle2, ArrowUpRight, Plus } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DashboardProps {
  meetings: Meeting[];
  tasks: Task[];
  displayName: string;
  onMeetingClick: (meeting: Meeting) => void;
  onTaskApprove: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onViewAllMeetings: () => void;
  onNewMeeting: () => void;
}

/** Durations are stored as free text ("45 min", "1h 30m"); pull whatever minutes we can find. */
const durationToMinutes = (duration: string): number => {
  const hours = /(\d+(?:\.\d+)?)\s*h/i.exec(duration);
  const minutes = /(\d+)\s*m/i.exec(duration);
  if (!hours && !minutes) {
    const bare = /(\d+)/.exec(duration);
    return bare ? Number(bare[1]) : 0;
  }
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
};

export const Dashboard: React.FC<DashboardProps> = ({
  meetings,
  tasks,
  displayName,
  onMeetingClick,
  onTaskApprove,
  onEditTask,
  onViewAllMeetings,
  onNewMeeting,
}) => {
  const { t, dateLocale } = useI18n();
  const { theme } = useTheme();
  const upcomingMeetings = meetings.filter((m) => m.status === 'upcoming');
  const pastMeetings = meetings.filter((m) => m.status === 'completed');
  const pendingTasks = tasks.filter((t) => !t.isApproved && t.isAiGenerated);
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const aiTasks = tasks.filter((t) => t.isAiGenerated);

  const totalMinutes = meetings
    .filter((m) => m.status === 'completed')
    .reduce((sum, m) => sum + durationToMinutes(m.duration), 0);

  const aiShare = tasks.length ? Math.round((aiTasks.length / tasks.length) * 100) : 0;

  const stats = [
    {
      label: t.dashboard.totalMeetings,
      value: String(meetings.length),
      hint: t.dashboard.upcomingCount(upcomingMeetings.length),
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: t.dashboard.tasksCompleted,
      value: String(completedTasks.length),
      hint: t.dashboard.totalCount(tasks.length),
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: t.dashboard.meetingHours,
      value: `${(totalMinutes / 60).toFixed(1)}h`,
      hint: t.dashboard.recordedCount(pastMeetings.length),
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: t.dashboard.aiExtracted,
      value: `${aiShare}%`,
      hint: t.dashboard.awaitingReview(pendingTasks.length),
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  const chartData = useMemo(
    () => [
      { name: t.status.todo, tasks: tasks.filter((task) => task.status === 'todo').length, fill: '#94a3b8' },
      { name: t.status['in-progress'], tasks: tasks.filter((task) => task.status === 'in-progress').length, fill: '#3b82f6' },
      { name: t.status.review, tasks: tasks.filter((task) => task.status === 'review').length, fill: '#f97316' },
      { name: t.status.completed, tasks: completedTasks.length, fill: '#22c55e' },
    ],
    [tasks, completedTasks.length, t],
  );

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t.dashboard.welcome(displayName.split(' ')[0])}</h1>
          <p className="text-slate-500 mt-1">{t.dashboard.subtitle}</p>
        </div>
        <p className="text-sm font-medium text-slate-500">{format(new Date(), 'EEEE, MMMM d', { locale: dateLocale })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.bg} ${stat.color} p-2.5 rounded-xl`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-full">
                {stat.hint}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">{t.dashboard.upcomingMeetings}</h2>
              <button
                type="button"
                onClick={onViewAllMeetings}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {t.dashboard.viewAll}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} onClick={() => onMeetingClick(m)} />
              ))}
              {upcomingMeetings.length === 0 && (
                <div className="md:col-span-2 py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-500 font-medium">{t.dashboard.noUpcoming}</p>
                  <button
                    type="button"
                    onClick={onNewMeeting}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                    {t.dashboard.scheduleOne}
                  </button>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">{t.dashboard.tasksByStatus}</h2>
              <span className="text-xs font-medium text-slate-500">{t.dashboard.totalCount(tasks.length)}</span>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 640, height: 248 }}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#292c33' : '#f1f5f9'} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === 'dark' ? '#a0abba' : '#94a3b8', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: theme === 'dark' ? '#a0abba' : '#94a3b8', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: theme === 'dark' ? '#1b1d22' : '#f8fafc' }}
                    wrapperClassName="dashboard-chart-tooltip"
                    contentStyle={{
                      background: theme === 'dark' ? '#15171b' : '#ffffff',
                      color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
                      borderRadius: 12,
                      border: `1px solid ${theme === 'dark' ? '#343842' : '#e2e8f0'}`,
                      fontSize: 12,
                      boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                    }}
                  />
                  <Bar dataKey="tasks" radius={[8, 8, 0, 0]} maxBarSize={56}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">{t.dashboard.aiTaskReview}</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">
                {t.dashboard.newBadge(pendingTasks.length)}
              </span>
            </div>
            <div className="space-y-4">
              {pendingTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  meetingTitle={meetings.find((m) => m.id === t.meetingId)?.title}
                  onApprove={() => onTaskApprove(t.id)}
                  onEdit={() => onEditTask(t)}
                />
              ))}
              {pendingTasks.length === 0 && (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-slate-500 text-sm">{t.dashboard.allReviewed}</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4">{t.dashboard.recentMeetings}</h2>
            <div className="space-y-3">
              {pastMeetings.slice(0, 3).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onMeetingClick(m)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all cursor-pointer group text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.title}</p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(m.date), 'MMM d', { locale: dateLocale })} • {m.duration}
                    </p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-all shrink-0" />
                </button>
              ))}
              {pastMeetings.length === 0 && (
                <p className="text-sm text-slate-500 px-3">{t.dashboard.noCompleted}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
