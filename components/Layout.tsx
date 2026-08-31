import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Video,
  CheckSquare,
  Settings,
  LogOut,
  Calendar,
  Bell,
  Search,
  Plus,
  Menu,
  X,
  Sparkles,
  CalendarClock,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AppSettings, Meeting, Task } from '../types';
import { Popover } from './ui/Popover';
import { useI18n } from '../i18n';
import { usePersistentState } from '../hooks/usePersistentState';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  /** Mobile drawer state; ignored on large screens where the sidebar is always visible. */
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettings,
  onLogout,
  isOpen = false,
  onClose,
}) => {
  const { t } = useI18n();
  const menuItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'meetings', label: t.nav.meetings, icon: Video },
    { id: 'tasks', label: t.nav.tasks, icon: CheckSquare },
    { id: 'calendar', label: t.nav.calendar, icon: Calendar },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white flex flex-col h-screen transition-transform duration-300',
          'lg:sticky lg:top-0 lg:translate-x-0 lg:shrink-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Video className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight">MeetTask AI</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.nav.closeMenu}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  onClose?.();
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === item.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onClose?.();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {t.nav.settings}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mt-1"
          >
            <LogOut className="w-4 h-4" />
            {t.nav.logout}
          </button>
        </div>
      </aside>
    </>
  );
};

interface Notification {
  id: string;
  kind: 'ai-task' | 'meeting';
  title: string;
  detail: string;
}

interface HeaderProps {
  onMenuClick?: () => void;
  meetings: Meeting[];
  tasks: Task[];
  settings: AppSettings;
  avatar?: string;
  onNewMeeting: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onSelectMeeting: (meeting: Meeting) => void;
  onSelectTask: (task: Task) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  meetings,
  tasks,
  settings,
  avatar,
  onNewMeeting,
  onOpenSettings,
  onLogout,
  onSelectMeeting,
  onSelectTask,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readIds, setReadIds] = usePersistentState<string[]>('meettask.readNotifications', []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { meetings: [], tasks: [] };
    return {
      meetings: meetings.filter((m) => m.title.toLowerCase().includes(q)).slice(0, 4),
      tasks: tasks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.description ?? '').toLowerCase().includes(q),
        )
        .slice(0, 5),
    };
  }, [query, meetings, tasks]);

  const hasResults = results.meetings.length > 0 || results.tasks.length > 0;

  const notifications = useMemo<Notification[]>(() => {
    const items: Notification[] = [];
    if (settings.notifyAiTasks) {
      tasks
        .filter((task) => task.isAiGenerated && !task.isApproved)
        .forEach((task) =>
          items.push({
            id: `task-${task.id}`,
            kind: 'ai-task',
            title: task.title,
            detail: t.header.aiTaskWaiting,
          }),
        );
    }
    if (settings.notifyUpcoming) {
      meetings
        .filter((m) => m.status === 'upcoming')
        .forEach((m) =>
          items.push({
            id: `meeting-${m.id}`,
            kind: 'meeting',
            title: m.title,
            detail: t.header.scheduledFor(new Date(m.date).toLocaleString()),
          }),
        );
    }
    return items;
  }, [tasks, meetings, settings.notifyAiTasks, settings.notifyUpcoming, t]);

  const unread = notifications.filter((n) => !readIds.includes(n.id));

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closeSearch();
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Enter') {
      const first = results.meetings[0] ?? results.tasks[0];
      if (!first) return;
      if ('participants' in first) onSelectMeeting(first as Meeting);
      else onSelectTask(first as Task);
      closeSearch();
    }
  };

  const initials = settings.displayName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={t.nav.openMenu}
        className="p-2 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden shrink-0"
      >
        <Menu className="w-5 h-5" />
      </button>

      <Popover
        open={searchOpen && query.trim().length > 0}
        onClose={closeSearch}
        align="left"
        className="flex-1 max-w-96 min-w-0"
        panelClassName="w-full"
        trigger={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t.header.searchPlaceholder}
              aria-label={t.header.searchLabel}
              className="w-full pl-10 pr-9 py-2 bg-slate-100 border border-transparent focus:bg-white focus:border-blue-500 rounded-full text-sm outline-none transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={closeSearch}
                aria-label={t.header.clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        }
      >
        <div className="max-h-80 overflow-y-auto py-2">
          {!hasResults && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              {t.header.noMatches(query.trim())}
            </p>
          )}

          {results.meetings.length > 0 && (
            <div className="px-2">
              <p className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.header.meetings}</p>
              {results.meetings.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelectMeeting(m);
                    closeSearch();
                  }}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{m.title}</span>
                    <span className="block text-xs text-slate-400 capitalize">{m.status}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.tasks.length > 0 && (
            <div className="px-2 mt-1">
              <p className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.header.tasks}</p>
              {results.tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSelectTask(t);
                    closeSearch();
                  }}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{t.title}</span>
                    <span className="block text-xs text-slate-400 capitalize">{t.status.replace('-', ' ')}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Popover>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <Popover
          open={bellOpen}
          onClose={() => setBellOpen(false)}
          panelClassName="w-80"
          trigger={
            <button
              type="button"
              onClick={() => setBellOpen((v) => !v)}
              aria-label={t.header.notificationsLabel(unread.length)}
              aria-expanded={bellOpen}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-full relative"
            >
              <Bell className="w-5 h-5" />
              {unread.length > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
                  {unread.length > 9 ? '9+' : unread.length}
                </span>
              )}
            </button>
          }
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">{t.header.notifications}</p>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => setReadIds(notifications.map((n) => n.id))}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                {t.header.markAllRead}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">{t.header.allCaughtUp}</p>
            )}
            {notifications.map((n) => {
              const isRead = readIds.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setReadIds((prev) => (prev.includes(n.id) ? prev : [...prev, n.id]));
                    if (n.kind === 'meeting') {
                      const meeting = meetings.find((m) => `meeting-${m.id}` === n.id);
                      if (meeting) onSelectMeeting(meeting);
                    } else {
                      const task = tasks.find((t) => `task-${t.id}` === n.id);
                      if (task) onSelectTask(task);
                    }
                    setBellOpen(false);
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${
                    isRead ? 'opacity-60' : ''
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      n.kind === 'ai-task' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                    }`}
                  >
                    {n.kind === 'ai-task' ? <Sparkles className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{n.title}</span>
                    <span className="block text-xs text-slate-500">{n.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Popover>

        <button
          type="button"
          onClick={onNewMeeting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 md:px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm shadow-blue-200 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t.header.newMeeting}</span>
        </button>

        <Popover
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          panelClassName="w-56"
          trigger={
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              aria-label={t.header.accountMenu}
              aria-expanded={profileOpen}
              className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-200 transition-all flex items-center justify-center text-[11px] font-bold text-slate-600"
            >
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : initials}
            </button>
          }
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900 truncate">{settings.displayName}</p>
            <p className="text-xs text-slate-500 truncate">{settings.email}</p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                onOpenSettings();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              {t.nav.settings}
            </button>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t.header.logOut}
            </button>
          </div>
        </Popover>
      </div>
    </header>
  );
};
