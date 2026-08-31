import React, { useState } from 'react';
import { 
  CheckSquare, 
  List, 
  LayoutGrid, 
  Calendar as CalendarIcon,
  Plus,
  Filter,
  MoreVertical,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { TaskCard } from '../components/TaskCard';
import { MOCK_MEETINGS } from '../constants';

interface TasksPageProps {
  tasks: Task[];
}

export const TasksPage: React.FC<TasksPageProps> = ({ tasks }) => {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  
  const columns: { id: TaskStatus; label: string; color: string }[] = [
    { id: 'todo', label: 'To Do', color: 'bg-slate-500' },
    { id: 'in-progress', label: 'In Progress', color: 'bg-blue-500' },
    { id: 'review', label: 'Review', color: 'bg-orange-500' },
    { id: 'completed', label: 'Completed', color: 'bg-green-500' },
  ];

  const getTasksByStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Tasks</h1>
          <p className="text-slate-500 mt-1">Manage and track your meeting action items.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-1 flex">
            <button 
              onClick={() => setView('kanban')}
              className={`p-2 rounded-lg transition-all ${view === 'kanban' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {columns.map(col => (
            <div key={col.id} className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.color}`}></div>
                  <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">{col.label}</h3>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {getTasksByStatus(col.id).length}
                  </span>
                </div>
                <button className="text-slate-400 hover:text-slate-600">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 bg-slate-50/50 rounded-2xl p-3 border border-slate-100 min-h-[600px] space-y-4">
                {getTasksByStatus(col.id).map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {getTasksByStatus(col.id).length === 0 && (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs font-medium text-slate-400">No tasks</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Task</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Meeting</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Deadline</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        task.status === 'completed' ? 'bg-green-500' : 
                        task.status === 'in-progress' ? 'bg-blue-500' : 'bg-slate-300'
                      }`}></div>
                      <span className="text-sm font-semibold text-slate-900">{task.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">
                      {MOCK_MEETINGS.find(m => m.id === task.meetingId)?.title}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' : 
                      task.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      {task.deadline}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-600 capitalize">
                      {task.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
