import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Sidebar, Header } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LiveMeeting } from './pages/LiveMeeting';
import { MeetingSummary } from './pages/MeetingSummary';
import { TasksPage } from './pages/Tasks';
import { MeetingsPage } from './pages/Meetings';
import { CalendarPage } from './pages/Calendar';
import { AuthPage } from './pages/Auth';
import { TaskFormModal } from './components/TaskFormModal';
import { MeetingFormModal } from './components/MeetingFormModal';
import { SettingsModal } from './components/SettingsModal';
import { TeamModal } from './components/TeamModal';
import { UploadRecordingModal } from './components/UploadRecordingModal';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { usePersistentState } from './hooks/usePersistentState';
import { CURRENT_USER, DEFAULT_SETTINGS, MOCK_MEETINGS, MOCK_USERS } from './constants';
import { AppSettings, Meeting, MeetingAnalysis, Task, TaskStatus, User } from './types';
import { TeamProvider } from './context/TeamContext';
import { I18nProvider, getCatalogue } from './i18n';
import './index.css';

const STORAGE_KEYS = {
  meetings: 'meettask.meetings',
  tasks: 'meettask.tasks',
  settings: 'meettask.settings',
  team: 'meettask.team',
  auth: 'meettask.auth',
  notifications: 'meettask.readNotifications',
};

const initialTasks = () => MOCK_MEETINGS.flatMap((m) => m.tasks || []);

interface TaskModalState {
  open: boolean;
  task: Task | null;
  defaultStatus?: TaskStatus;
  defaultMeetingId?: string;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = usePersistentState<boolean>(STORAGE_KEYS.auth, false);
  const [meetings, setMeetings] = usePersistentState<Meeting[]>(STORAGE_KEYS.meetings, MOCK_MEETINGS);
  const [allTasks, setAllTasks] = usePersistentState<Task[]>(STORAGE_KEYS.tasks, initialTasks);
  const [settings, setSettings] = usePersistentState<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const [team, setTeam] = usePersistentState<User[]>(STORAGE_KEYS.team, MOCK_USERS);
  // This component sits above I18nProvider, so it reads the catalogue directly.
  const t = getCatalogue(settings.language);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [view, setView] = useState<'main' | 'live' | 'summary'>('main');
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string>('');

  const [taskModal, setTaskModal] = useState<TaskModalState>({ open: false, task: null });
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Derived from `meetings` so edits to a meeting flow into the open view.
  const currentMeeting = useMemo(
    () => meetings.find((m) => m.id === currentMeetingId) ?? null,
    [meetings, currentMeetingId],
  );

  const goToTab = (tab: string) => {
    setActiveTab(tab);
    setView('main');
  };

  const handleMeetingClick = (meeting: Meeting) => {
    setCurrentMeetingId(meeting.id);
    setView(meeting.status === 'completed' ? 'summary' : 'live');
  };

  const handleEndMeeting: React.ComponentProps<typeof LiveMeeting>['onEnd'] = ({
    transcript,
    analysis,
    tasks,
  }) => {
    if (!currentMeeting) return;
    const updated: Meeting = {
      ...currentMeeting,
      status: 'completed',
      transcript,
      tasks,
      summary: analysis?.summary || 'Meeting completed. No analyzable speech was recorded.',
      keyPoints: analysis?.keyPoints || [],
      decisions: analysis?.decisions || [],
    };
    setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setAllTasks((existing) => [...tasks, ...existing]);
    setView('summary');
  };

  const handleTaskMove = (taskId: string, status: TaskStatus, beforeTaskId?: string) => {
    setAllTasks((existing) => {
      const moving = existing.find((t) => t.id === taskId);
      if (!moving) return existing;
      const moved: Task = { ...moving, status };
      const rest = existing.filter((t) => t.id !== taskId);
      const insertAt = beforeTaskId ? rest.findIndex((t) => t.id === beforeTaskId) : -1;
      if (insertAt === -1) return [...rest, moved];
      return [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
    });
  };

  const handleTaskApprove = (taskId: string) =>
    setAllTasks((existing) => existing.map((t) => (t.id === taskId ? { ...t, isApproved: true } : t)));

  const handleTaskSave = (task: Task) =>
    setAllTasks((existing) =>
      existing.some((t) => t.id === task.id)
        ? existing.map((t) => (t.id === task.id ? task : t))
        : [task, ...existing],
    );

  const handleTaskDelete = (taskId: string) =>
    setAllTasks((existing) => existing.filter((t) => t.id !== taskId));

  const openTaskModal = (state: Omit<TaskModalState, 'open'>) => setTaskModal({ ...state, open: true });

  const handleMeetingSave = (meeting: Meeting, startNow: boolean) => {
    setMeetings((prev) => [meeting, ...prev]);
    setCurrentMeetingId(meeting.id);
    if (startNow) {
      setView('live');
    } else {
      setView('main');
      setActiveTab('meetings');
    }
  };

  /** A transcribed upload becomes a completed meeting plus its extracted tasks. */
  const handleUploadComplete = (meeting: Meeting, tasks: Task[]) => {
    setMeetings((prev) => [meeting, ...prev]);
    setAllTasks((prev) => [...tasks, ...prev]);
    setCurrentMeetingId(meeting.id);
    setView('summary');
  };

  /**
   * Re-analysis replaces everything the assistant produced for a meeting.
   * Tasks a person typed by hand are kept — the analysis never created them.
   */
  const handleMeetingReanalyzed = (analysis: MeetingAnalysis, tasks: Task[]) => {
    if (!currentMeeting) return;
    const meetingId = currentMeeting.id;
    setMeetings((prev) =>
      prev.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              summary: analysis.summary || meeting.summary,
              keyPoints: analysis.keyPoints,
              decisions: analysis.decisions,
              tasks,
            }
          : meeting,
      ),
    );
    setAllTasks((prev) => [
      ...tasks,
      ...prev.filter((task) => !(task.meetingId === meetingId && task.isAiGenerated)),
    ]);
  };

  const handleSelectTaskFromSearch = (task: Task) => {
    goToTab('tasks');
    setFocusedTaskId(task.id);
    window.setTimeout(() => setFocusedTaskId((id) => (id === task.id ? '' : id)), 2500);
  };

  const handleResetData = () => {
    setMeetings(MOCK_MEETINGS);
    setAllTasks(initialTasks());
    setSettings(DEFAULT_SETTINGS);
    setTeam(MOCK_USERS);
    try {
      window.localStorage.removeItem(STORAGE_KEYS.notifications);
    } catch {
      /* storage may be unavailable */
    }
    setResetOpen(false);
    setSettingsOpen(false);
    setView('main');
    setCurrentMeetingId(null);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setView('main');
    setActiveTab('dashboard');
    setCurrentMeetingId(null);
    setIsSidebarOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <I18nProvider language={settings.language}>
        <AuthPage onLogin={() => setIsAuthenticated(true)} />
      </I18nProvider>
    );
  }

  return (
    <I18nProvider language={settings.language}>
    <TeamProvider team={team}>
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        activeTab={activeTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onTabChange={goToTab}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          meetings={meetings}
          tasks={allTasks}
          settings={settings}
          avatar={CURRENT_USER.avatar}
          onNewMeeting={() => setMeetingModalOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          onSelectMeeting={handleMeetingClick}
          onSelectTask={handleSelectTaskFromSearch}
        />

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {view === 'live' && currentMeeting ? (
            <LiveMeeting meeting={currentMeeting} onEnd={handleEndMeeting} />
          ) : view === 'summary' && currentMeeting ? (
            <MeetingSummary
              meeting={currentMeeting}
              tasks={allTasks.filter((t) => t.meetingId === currentMeeting.id)}
              onBack={() => setView('main')}
              onApproveTask={handleTaskApprove}
              onEditTask={(task) => openTaskModal({ task })}
              onAddTask={() => openTaskModal({ task: null, defaultMeetingId: currentMeeting.id })}
              onReanalyzed={handleMeetingReanalyzed}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  meetings={meetings}
                  tasks={allTasks}
                  displayName={settings.displayName}
                  onMeetingClick={handleMeetingClick}
                  onTaskApprove={handleTaskApprove}
                  onEditTask={(task) => openTaskModal({ task })}
                  onViewAllMeetings={() => goToTab('meetings')}
                  onNewMeeting={() => setMeetingModalOpen(true)}
                />
              )}
              {activeTab === 'meetings' && (
                <MeetingsPage
                  meetings={meetings}
                  onMeetingClick={handleMeetingClick}
                  onNewMeeting={() => setMeetingModalOpen(true)}
                  onUploadRecording={() => setUploadOpen(true)}
                />
              )}
              {activeTab === 'tasks' && (
                <TasksPage
                  tasks={allTasks}
                  meetings={meetings}
                  defaultView={settings.defaultTaskView}
                  focusedTaskId={focusedTaskId}
                  onTaskMove={handleTaskMove}
                  onTaskApprove={handleTaskApprove}
                  onCreateTask={(status) => openTaskModal({ task: null, defaultStatus: status })}
                  onEditTask={(task) => openTaskModal({ task })}
                  onDeleteTask={handleTaskDelete}
                />
              )}
              {activeTab === 'calendar' && (
                <CalendarPage
                  meetings={meetings}
                  tasks={allTasks}
                  onMeetingClick={handleMeetingClick}
                  onTaskClick={(task) => openTaskModal({ task })}
                  onNewMeeting={() => setMeetingModalOpen(true)}
                  onUploadRecording={() => setUploadOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      <TaskFormModal
        open={taskModal.open}
        task={taskModal.task}
        defaultStatus={taskModal.defaultStatus}
        defaultMeetingId={taskModal.defaultMeetingId}
        meetings={meetings}
        onClose={() => setTaskModal({ open: false, task: null })}
        onSave={handleTaskSave}
      />

      <MeetingFormModal
        open={meetingModalOpen}
        onClose={() => setMeetingModalOpen(false)}
        onSave={handleMeetingSave}
      />

      <UploadRecordingModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={handleUploadComplete}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={setSettings}
        onResetData={() => setResetOpen(true)}
        onManageTeam={() => setTeamOpen(true)}
      />

      <TeamModal open={teamOpen} team={team} onClose={() => setTeamOpen(false)} onSave={setTeam} />

      <ConfirmDialog
        open={resetOpen}
        title={t.settings.resetTitle}
        message={t.settings.resetMessage}
        confirmLabel={t.settings.reset}
        onCancel={() => setResetOpen(false)}
        onConfirm={handleResetData}
      />
    </div>
    </TeamProvider>
    </I18nProvider>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
