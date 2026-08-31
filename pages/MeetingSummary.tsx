import React from 'react';
import { 
  FileText, 
  CheckSquare, 
  Users, 
  Clock, 
  Calendar,
  Download,
  Share2,
  Sparkles,
  ArrowLeft,
  MessageSquare
} from 'lucide-react';
import { Meeting, Task } from '../types';
import { TaskCard } from '../components/TaskCard';

interface MeetingSummaryProps {
  meeting: Meeting;
  onBack: () => void;
}

export const MeetingSummary: React.FC<MeetingSummaryProps> = ({ meeting, onBack }) => {
  const aiTasks = meeting.tasks?.filter(t => t.isAiGenerated) || [];
  const manualTasks = meeting.tasks?.filter(t => !t.isAiGenerated) || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase tracking-wider">Completed</span>
                <span className="text-xs text-slate-400 font-medium">Recorded on Mar 20, 2024</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{meeting.title}</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Duration</p>
                <p className="text-lg font-bold text-slate-900">{meeting.duration}</p>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Participants</p>
                <p className="text-lg font-bold text-slate-900">{meeting.participants.length}</p>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tasks</p>
                <p className="text-lg font-bold text-slate-900">{meeting.tasks?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 p-8 space-y-10 border-r border-slate-100">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">AI Summary</h2>
              </div>
              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                <p className="text-slate-700 leading-relaxed">
                  {meeting.summary} The team agreed on the core priorities for the upcoming quarter, with a heavy emphasis on AI-driven features. Key stakeholders were assigned specific roles to ensure the roadmap stays on track.
                </p>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                    Prioritize AI task extraction for the next sprint.
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                    Review budget allocations for marketing by Monday.
                  </li>
                  <li className="flex items-start gap-3 text-sm text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                    Finalize UI mockups for the dashboard redesign.
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-400" />
                  <h2 className="text-xl font-bold text-slate-900">Full Transcript</h2>
                </div>
                <button className="text-sm font-semibold text-blue-600 hover:text-blue-700">Search transcript</button>
              </div>
              <div className="space-y-6">
                {meeting.transcript?.map((line) => (
                  <div key={line.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">
                      {line.speaker[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">{line.speaker}</span>
                        <span className="text-[10px] font-medium text-slate-400">{line.timestamp}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        {line.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="p-8 bg-slate-50/30 space-y-10">
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-slate-900" />
                  <h2 className="text-xl font-bold text-slate-900">Action Items</h2>
                </div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">
                  {meeting.tasks?.length || 0}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">AI Generated</div>
                {aiTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
                
                {manualTasks.length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8 mb-2">Manual Tasks</div>
                    {manualTasks.map(task => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-widest">Participants</h2>
              <div className="space-y-3">
                {meeting.participants.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                        <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">{p.name}</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
