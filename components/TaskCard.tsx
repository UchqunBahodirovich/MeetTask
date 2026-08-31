import React from 'react';
import { Calendar, User, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Task, User as UserType } from '../types';
import { MOCK_USERS } from '../constants';

interface TaskCardProps {
  task: Task;
  onApprove?: () => void;
  onEdit?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onApprove, onEdit }) => {
  const assignee = MOCK_USERS.find(u => u.id === task.assigneeId);
  
  const priorityColors = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-red-100 text-red-700'
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all group relative">
      {task.isAiGenerated && !task.isApproved && (
        <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-full shadow-lg z-10">
          <Sparkles className="w-3 h-3" />
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        <span className="text-[10px] font-medium text-slate-400">
          {task.status.replace('-', ' ')}
        </span>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-3 leading-tight">
        {task.title}
      </h4>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          Due {task.deadline}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden">
            <img src={assignee?.avatar} alt={assignee?.name} className="w-full h-full object-cover" />
          </div>
          {assignee?.name}
        </div>
      </div>

      {task.isAiGenerated && !task.isApproved && (
        <div className="pt-3 border-t border-slate-50 flex gap-2">
          <button 
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve
          </button>
          <button 
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
};
