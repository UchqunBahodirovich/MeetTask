import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import ReactDOM from 'react-dom/client';
import { Sidebar, Header } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LiveMeeting } from './pages/LiveMeeting';
import { MeetingSummary } from './pages/MeetingSummary';
import { TasksPage } from './pages/Tasks';
import { MeetingsPage } from './pages/Meetings';
import { CalendarPage } from './pages/Calendar';
import { AuthPage } from './pages/Auth';
import { Landing } from './pages/Landing';
import { useTheme } from './hooks/useTheme';
import { usePersistentState } from './hooks/usePersistentState';
import { TaskFormModal } from './components/TaskFormModal';
import { MeetingFormModal } from './components/MeetingFormModal';
import { SettingsModal } from './components/SettingsModal';
import { TeamModal } from './components/TeamModal';
import { UploadRecordingModal } from './components/UploadRecordingModal';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DEFAULT_SETTINGS } from './constants';
import { AppSettings, Language, Meeting, MeetingAnalysis, Task, TaskStatus, User } from './types';
import { TeamProvider } from './context/TeamContext';
import { I18nProvider, getCatalogue } from './i18n';
import { appRouteHash, isAppTab, parseAppRoute, type AppRoute } from './services/navigation';
import { analyzeMeeting } from './services/meetingApi';
import { analysisToTasks } from './services/analysis';
import './services/firebase';
import './index.css';
import './workspace-theme.css';

interface TaskModalState {
  open: boolean;
  task: Task | null;
  defaultStatus?: TaskStatus;
  defaultMeetingId?: string;
}

const App: React.FC<{ publicLanguage: Language; onPublicLanguageChange: (language: Language) => void }> = ({ publicLanguage, onPublicLanguageChange }) => {
  useTheme();
  const { session, isRestoring, logout, can } = useAuth();
  const workspace = useWorkspaceData(session?.workspaceId ?? null);
  const { meetings, tasks: allTasks, team, settings } = workspace;
  // This component sits above I18nProvider, so it reads the catalogue directly.
  const t = getCatalogue(settings.language);

  const initialRoute = useMemo(() => parseAppRoute(), []);
  const [activeTab, setActiveTab] = useState(initialRoute.tab);
  const [view, setView] = useState(initialRoute.view);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(initialRoute.meetingId);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);
  /** Meetings whose analysis is still being finished after the live session closed. */
  const [finishingAnalysis, setFinishingAnalysis] = useState<Record<string, 'running' | 'failed'>>({});

  const [taskModal, setTaskModal] = useState<TaskModalState>({ open: false, task: null });
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  // Derived from `meetings` so edits to a meeting flow into the open view.
  const currentMeeting = useMemo(
    () => meetings.find((m) => m.id === currentMeetingId) ?? null,
    [meetings, currentMeetingId],
  );

  const applyRoute = (route: AppRoute) => {
    setActiveTab(route.tab);
    setView(route.view);
    setCurrentMeetingId(route.meetingId);
    setIsSidebarOpen(false);
  };

  const navigate = (route: AppRoute, replace = false) => {
    const currentDepth = typeof window.history.state?.meettaskDepth === 'number'
      ? window.history.state.meettaskDepth
      : 0;
    const state = { meettask: true, meettaskDepth: replace ? currentDepth : currentDepth + 1 };
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method](state, '', appRouteHash(route));
    applyRoute(route);
  };

  useEffect(() => {
    if (!session) return;
    const existingDepth = typeof window.history.state?.meettaskDepth === 'number'
      ? window.history.state.meettaskDepth
      : 0;
    window.history.replaceState(
      { ...(window.history.state ?? {}), meettask: true, meettaskDepth: existingDepth },
      '',
      appRouteHash(initialRoute),
    );

    const handlePopState = () => {
      applyRoute(parseAppRoute());
      setTaskModal({ open: false, task: null });
      setMeetingModalOpen(false);
      setUploadOpen(false);
      setSettingsOpen(false);
      setTeamOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session?.user.id]);

  // The sticky header only needs an edge once content actually passes under it.
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY > 4;
      setIsScrolled((current) => (current === scrolled ? current : scrolled));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToTab = (tab: string) => {
    const nextTab = isAppTab(tab) ? tab : 'dashboard';
    navigate({ tab: nextTab, view: 'main', meetingId: null });
  };

  const handleMeetingClick = (meeting: Meeting) => {
    navigate({
      tab: 'meetings',
      view: meeting.status === 'completed' ? 'summary' : 'live',
      meetingId: meeting.id,
    });
  };

  /**
   * Analyses the speech live detection had not reached when the session
   * ended. Tasks already found are sent as known, so only new ones come back
   * and are appended; the summary is refreshed from the full transcript.
   */
  const finishMeetingAnalysis = async (
    meetingId: string,
    saved: Promise<void>,
    analysisMode: 'tasks' | 'highlights',
    transcript: Meeting['transcript'] & {},
    pending: { meeting: Meeting; knownTasks: string[] },
  ) => {
    setFinishingAnalysis((current) => ({ ...current, [meetingId]: 'running' }));
    try {
      const analysis = await analyzeMeeting(pending.meeting, transcript, {
        mode: analysisMode,
        language: settings.language,
        knownTasks: pending.knownTasks,
      });
      const newTasks = analysisMode === 'tasks' ? analysisToTasks(analysis, pending.meeting) : [];
      await saved;
      await workspace.updateMeeting(
        meetingId,
        {
          summary: analysis.summary || 'Meeting completed. No analyzable speech was recorded.',
          keyPoints: analysis.keyPoints,
          decisions: analysis.decisions,
        },
        newTasks,
      );
      setFinishingAnalysis(({ [meetingId]: _done, ...rest }) => rest);
    } catch (error) {
      console.warn('Finishing meeting analysis failed:', error);
      setFinishingAnalysis((current) => ({ ...current, [meetingId]: 'failed' }));
    }
  };

  const handleEndMeeting: React.ComponentProps<typeof LiveMeeting>['onEnd'] = ({
    analysisMode,
    transcript,
    analysis,
    tasks,
    pending,
  }) => {
    if (!currentMeeting) return;
    const updated: Meeting = {
      ...currentMeeting,
      status: 'completed',
      transcript,
      tasks,
      summary: analysis?.summary || (pending ? '' : 'Meeting completed. No analyzable speech was recorded.'),
      keyPoints: analysis?.keyPoints || [],
      decisions: analysis?.decisions || [],
    };
    const saved = workspace.updateMeeting(
      updated.id,
      {
        status: 'completed',
        analysisMode,
        summary: updated.summary,
        keyPoints: updated.keyPoints,
        decisions: updated.decisions,
        transcript,
      },
      tasks,
    );
    if (pending) void finishMeetingAnalysis(updated.id, saved, analysisMode, transcript, pending);
    navigate({ tab: 'meetings', view: 'summary', meetingId: updated.id }, true);
  };

  const handleTaskMove = (taskId: string, status: TaskStatus, beforeTaskId?: string) =>
    void workspace.moveTask(taskId, status, beforeTaskId);

  const handleTaskApprove = (taskId: string) => void workspace.approveTask(taskId);

  const handleTaskSave = (task: Task) => void workspace.saveTask(task);

  const handleTaskDelete = (taskId: string) => void workspace.deleteTask(taskId);

  const openTaskModal = (state: Omit<TaskModalState, 'open'>) => setTaskModal({ ...state, open: true });

  const handleMeetingSave = async (meeting: Meeting, startNow: boolean) => {
    // The server assigns the id, so navigation waits for the created meeting.
    const created = await workspace.createMeeting(meeting);
    if (!created) return;
    navigate(
      startNow
        ? { tab: 'meetings', view: 'live', meetingId: created.id }
        : { tab: 'meetings', view: 'main', meetingId: null },
    );
  };

  /** A transcribed upload becomes a completed meeting plus its extracted tasks. */
  const handleUploadComplete = async (meeting: Meeting, tasks: Task[]) => {
    const created = await workspace.createMeeting(meeting, tasks);
    if (created) navigate({ tab: 'meetings', view: 'summary', meetingId: created.id });
  };

  /**
   * Re-analysis replaces everything the assistant produced for a meeting.
   * Tasks a person typed by hand are kept — the analysis never created them.
   */
  const handleMeetingReanalyzed = (analysis: MeetingAnalysis, tasks: Task[]) => {
    if (currentMeeting) workspace.applyReanalysis(currentMeeting.id, analysis, tasks);
  };

  const handleSelectTaskFromSearch = (task: Task) => {
    goToTab('tasks');
    setFocusedTaskId(task.id);
    window.setTimeout(() => setFocusedTaskId((id) => (id === task.id ? '' : id)), 2500);
  };

  const handleLogout = async () => {
    await logout();
    navigate({ tab: 'dashboard', view: 'main', meetingId: null }, true);
    setIsSidebarOpen(false);
  };

  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!session) {
    return (
      <I18nProvider language={publicLanguage}>
        <div className="workspace-shell min-h-screen">
          <a href="#/landing" aria-label="MeetTask" className="fixed left-5 top-5 z-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">← MeetTask</a>
          <AuthPage language={publicLanguage} onLanguageChange={onPublicLanguageChange} />
        </div>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider language={settings.language}>
    <TeamProvider team={team}>
    <div className="workspace-shell flex min-h-screen bg-slate-50">
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
          isScrolled={isScrolled}
          meetings={meetings}
          tasks={allTasks}
          settings={settings}
          avatar={session.user.avatar}
          onNewMeeting={() => setMeetingModalOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
          onSelectMeeting={handleMeetingClick}
          onSelectTask={handleSelectTaskFromSearch}
        />

        {/* Writes go over the network now, so a failure has to be visible
            instead of leaving the screen silently out of step with the server. */}
        {workspace.error && (
          <div
            role="alert"
            className="mx-4 md:mx-8 mt-4 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-red-700 flex-1">{workspace.error}</p>
            <button
              type="button"
              onClick={() => void workspace.reload()}
              className="text-xs font-bold text-red-700 hover:text-red-900 shrink-0"
            >
              {t.common.clear}
            </button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {/* Without this the first paint looks like an empty workspace rather
              than one that is still loading. */}
          {workspace.isLoading && meetings.length === 0 && allTasks.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              className="h-full min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-500"
            >
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-sm font-medium">{t.common.loading}</p>
            </div>
          ) : (
          <>
          {view === 'live' && currentMeeting ? (
            <LiveMeeting meeting={currentMeeting} onEnd={handleEndMeeting} />
          ) : view === 'summary' && currentMeeting ? (
            <MeetingSummary
              meeting={currentMeeting}
              tasks={allTasks.filter((t) => t.meetingId === currentMeeting.id)}
              onBack={() => {
                const depth = Number(window.history.state?.meettaskDepth ?? 0);
                if (depth > 0) window.history.back();
                else navigate({ tab: 'meetings', view: 'main', meetingId: null }, true);
              }}
              onApproveTask={handleTaskApprove}
              onEditTask={(task) => openTaskModal({ task })}
              onAddTask={() => openTaskModal({ task: null, defaultMeetingId: currentMeeting.id })}
              onReanalyzed={handleMeetingReanalyzed}
              finishingAnalysis={finishingAnalysis[currentMeeting.id]}
              taskCount={allTasks.filter((task) => task.meetingId === currentMeeting.id).length}
              onDelete={
                can('deleteMeeting')
                  ? async () => {
                      if (await workspace.deleteMeeting(currentMeeting.id)) {
                        navigate({ tab: 'meetings', view: 'main', meetingId: null }, true);
                      }
                    }
                  : undefined
              }
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
                  taskCountFor={(meetingId) =>
                    allTasks.filter((task) => task.meetingId === meetingId).length
                  }
                  onDeleteMeeting={
                    can('deleteMeeting') ? (meeting) => workspace.deleteMeeting(meeting.id) : undefined
                  }
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
        onSave={(next) => void workspace.saveSettings(next)}
        onManageTeam={() => setTeamOpen(true)}
      />

      <TeamModal
        open={teamOpen}
        team={team}
        currentUserId={session?.user.id}
        onClose={() => setTeamOpen(false)}
        onAdd={workspace.addMember}
        onUpdate={workspace.updateMember}
        onRemove={workspace.removeMember}
      />
    </div>
    </TeamProvider>
    </I18nProvider>
  );
};

/** Keep public navigation outside the workspace router and its history state. */
const SiteRoot = () => {
  const { session, isRestoring } = useAuth();
  const [savedLanguage, setSavedLanguage] = usePersistentState<Language>('meettask.publicLanguage', 'uz');
  const publicLanguage: Language = ['uz', 'ru', 'en'].includes(savedLanguage) ? savedLanguage : 'uz';
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    document.documentElement.lang = publicLanguage;
  }, [publicLanguage]);
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  if (isRestoring) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-slate-400" aria-label="Yuklanmoqda" /></div>;
  if (hash === '#/landing' || (!session && (!hash || hash === '#/'))) {
    return <Landing language={publicLanguage} onLanguageChange={setSavedLanguage} signedIn={Boolean(session)} onStart={() => { window.location.hash = session ? '/dashboard' : '/login'; }} />;
  }
  return <App publicLanguage={publicLanguage} onPublicLanguageChange={setSavedLanguage} />;
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <AuthProvider>
      <SiteRoot />
    </AuthProvider>,
  );
}
