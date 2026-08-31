import React from 'react';
import { Meeting, Task } from '../types';
import { MeetingCard } from '../components/MeetingCard';
import { TaskCard } from '../components/TaskCard';
import { 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface DashboardProps {
  meetings: Meeting[];
  tasks: Task[];
  onMeetingClick: (meeting: Meeting) => void;
}

const data = [
  { name: 'Mon', tasks: 4 },
  { name: 'Tue', tasks: 7 },
  { name: 'Wed', tasks: 5 },
  { name: 'Thu', tasks: 12 },
  { name: 'Fri', tasks: 8 },
];

export const Dashboard: React.FC<DashboardProps> = ({ meetings, tasks, onMeetingClick }) => {
  const stats = [
    { label: 'Total Meetings', value: '24', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Tasks Completed', value: '142', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Meeting Hours', value: '12.5h', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'AI Efficiency', value: '+24%', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const upcomingMeetings = meetings.filter(m => m.status === 'upcoming');
  const pastMeetings = meetings.filter(m => m.status === 'completed');
  const pendingTasks = tasks.filter(t => !t.isApproved && t.isAiGenerated);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome back, Alex</h1>
          <p className="text-slate-500 mt-1">Here's what's happening with your meetings today.</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-400">Wednesday, March 20</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.bg} ${stat.color} p-2.5 rounded-xl`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                12%
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
              <h2 className="text-lg font-bold text-slate-900">Upcoming Meetings</h2>
              <button className="text-sm font-semibold text-blue-600 hover:text-blue-700">View all</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingMeetings.map(m => (
                <MeetingCard key={m.id} meeting={m} onClick={() => onMeetingClick(m)} />
              ))}
              {upcomingMeetings.length === 0 && (
                <div className="col-span-2 py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">No upcoming meetings scheduled</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Task Activity</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-slate-500 font-medium">Tasks</span>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="tasks" radius={[4, 4, 0, 0]} barSize={32}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 3 ? '#2563eb' : '#e2e8f0'} />
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
              <h2 className="text-lg font-bold text-slate-900">AI Task Review</h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">
                {pendingTasks.length} New
              </span>
            </div>
            <div className="space-y-4">
              {pendingTasks.map(t => (
                <TaskCard key={t.id} task={t} />
              ))}
              {pendingTasks.length === 0 && (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-slate-400 text-sm">All AI tasks reviewed</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Meetings</h2>
            <div className="space-y-3">
              {pastMeetings.slice(0, 3).map(m => (
                <div 
                  key={m.id} 
                  onClick={() => onMeetingClick(m)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.title}</p>
                    <p className="text-xs text-slate-500">Mar 19 • 45m</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-all" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
