import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  Sparkles, 
  MessageSquare, 
  Users,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Meeting, TranscriptLine, Task } from '../types';
import { MOCK_USERS } from '../constants';
import { TaskCard } from '../components/TaskCard';

interface LiveMeetingProps {
  meeting: Meeting;
  onEnd: () => void;
}

export const LiveMeeting: React.FC<LiveMeetingProps> = ({ meeting, onEnd }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [detectedTasks, setDetectedTasks] = useState<Task[]>([]);
  const [time, setTime] = useState(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Simulate live transcription and task detection
  useEffect(() => {
    const lines = [
      { speaker: 'Alex Rivera', text: 'Okay, let\'s discuss the budget for next month.' },
      { speaker: 'Sarah Chen', text: 'We need to allocate more for marketing.' },
      { speaker: 'Michael Scott', text: 'Ali, can you send the budget report by Monday?' },
      { speaker: 'Ali Hassan', text: 'Sure, I will have it ready.' },
      { speaker: 'Sarah Chen', text: 'I\'ll handle the UI mockups for the new dashboard.' },
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        const newLine = {
          id: `l-${i}`,
          speaker: lines[i].speaker,
          text: lines[i].text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setTranscript(prev => [...prev, newLine]);

        // Simulate AI Task Detection
        if (lines[i].text.toLowerCase().includes('send the budget report')) {
          const newTask: Task = {
            id: 'dt-1',
            title: 'Send the budget report',
            assigneeId: '4',
            deadline: 'Monday',
            priority: 'high',
            status: 'todo',
            meetingId: meeting.id,
            isAiGenerated: true,
            isApproved: false,
          };
          setDetectedTasks(prev => [newTask, ...prev]);
        }

        if (lines[i].text.toLowerCase().includes('ui mockups')) {
          const newTask: Task = {
            id: 'dt-2',
            title: 'UI mockups for new dashboard',
            assigneeId: '2',
            deadline: 'Next Friday',
            priority: 'medium',
            status: 'todo',
            meetingId: meeting.id,
            isAiGenerated: true,
            isApproved: false,
          };
          setDetectedTasks(prev => [newTask, ...prev]);
        }

        i++;
      } else {
        clearInterval(interval);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [meeting.id]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          </div>
          <div>
            <h2 className="font-bold text-slate-900">{meeting.title}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(time)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {meeting.participants.length} Participants
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3 rounded-xl transition-all ${isMuted ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`p-3 rounded-xl transition-all ${isVideoOff ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
          <button 
            onClick={onEnd}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-200"
          >
            <PhoneOff className="w-5 h-5" />
            End Meeting
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-sm text-slate-900 uppercase tracking-wider">Live Transcription</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">AI Processing</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {transcript.map((line) => (
              <div key={line.id} className="flex gap-4 group">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">
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
            <div ref={transcriptEndRef} />
            {transcript.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                <Mic className="w-12 h-12 opacity-20 animate-pulse" />
                <p className="font-medium">Waiting for speech...</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 min-h-0">
          <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-sm text-white uppercase tracking-wider">AI Detected Tasks</span>
              </div>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">
                {detectedTasks.length} Found
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detectedTasks.map((task) => (
                <div key={task.id} className="animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-blue-500/50 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        task.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {task.priority}
                      </span>
                      <Sparkles className="w-3 h-3 text-blue-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-3 leading-tight">
                      {task.title}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        Deadline: {task.deadline}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <div className="w-4 h-4 rounded-full bg-slate-700 overflow-hidden">
                          <img src={MOCK_USERS.find(u => u.id === task.assigneeId)?.avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        Assigned to: {MOCK_USERS.find(u => u.id === task.assigneeId)?.name}
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors">
                        Approve
                      </button>
                      <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[11px] font-bold transition-colors">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {detectedTasks.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 text-center px-6">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 opacity-20" />
                  </div>
                  <p className="text-xs font-medium">AI is listening for action items and tasks...</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Participants</h3>
            <div className="flex flex-wrap gap-2">
              {meeting.participants.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                  <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden">
                    <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-700">{p.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
