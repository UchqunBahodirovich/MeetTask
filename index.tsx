import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Sidebar, Header } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LiveMeeting } from './pages/LiveMeeting';
import { MeetingSummary } from './pages/MeetingSummary';
import { TasksPage } from './pages/Tasks';
import { AuthPage } from './pages/Auth';
import { MOCK_MEETINGS, MOCK_USERS } from './constants';
import { Meeting, Task } from './types';
import './index.css';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [view, setView] = useState<'main' | 'live' | 'summary'>('main');
  
  // Flatten all tasks from meetings for the tasks page
  const [allTasks, setAllTasks] = useState<Task[]>(
    MOCK_MEETINGS.flatMap(m => m.tasks || [])
  );

  const handleMeetingClick = (meeting: Meeting) => {
    setCurrentMeeting(meeting);
    if (meeting.status === 'live') {
      setView('live');
    } else if (meeting.status === 'completed') {
      setView('summary');
    } else {
      // For upcoming, maybe just show details or start it
      setView('live');
    }
  };

  const handleEndMeeting = () => {
    if (currentMeeting) {
      const updatedMeeting: Meeting = {
        ...currentMeeting,
        status: 'completed',
        summary: 'The meeting concluded with several key action items identified for the team.',
      };
      setCurrentMeeting(updatedMeeting);
      setView('summary');
    }
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab);
        setView('main');
      }} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        
        <main className="flex-1 p-8 overflow-y-auto">
          {view === 'live' && currentMeeting ? (
            <LiveMeeting 
              meeting={currentMeeting} 
              onEnd={handleEndMeeting} 
            />
          ) : view === 'summary' && currentMeeting ? (
            <MeetingSummary 
              meeting={currentMeeting} 
              onBack={() => setView('main')} 
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard 
                  meetings={MOCK_MEETINGS} 
                  tasks={allTasks}
                  onMeetingClick={handleMeetingClick}
                />
              )}
              {activeTab === 'meetings' && (
                <div className="space-y-6">
                  <h1 className="text-3xl font-bold text-slate-900">Meetings</h1>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {MOCK_MEETINGS.map(m => (
                      <div key={m.id} onClick={() => handleMeetingClick(m)} className="cursor-pointer">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                              m.status === 'completed' ? 'bg-slate-100 text-slate-600' : 
                              m.status === 'live' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                              {m.status}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{m.duration}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 mb-2">{m.title}</h3>
                          <p className="text-sm text-slate-500 mb-4">{new Date(m.date).toLocaleDateString()}</p>
                          <div className="flex -space-x-2">
                            {m.participants.map((p, i) => (
                              <img key={i} src={p.avatar} className="w-8 h-8 rounded-full border-2 border-white" alt="" />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'tasks' && (
                <TasksPage tasks={allTasks} />
              )}
              {activeTab === 'calendar' && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-4xl">📅</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Calendar View</h2>
                  <p className="max-w-xs text-center">Your meeting schedule integrated with your tasks. Coming soon.</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
