import React, { useMemo, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { useTheme } from '../hooks/useTheme';
import { Moon, Sun } from 'lucide-react';
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
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AppSettings, Meeting, Task } from '../types';
import { Popover } from './ui/Popover';
import { Avatar } from './ui/Avatar';
import { useI18n } from '../i18n';
import { usePersistentState } from '../hooks/usePersistentState';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { projectMomentum, SPRING_SHEET, SPRING_UI } from './ui/motion';
import { getPublicCopy } from '../i18n/public';

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
  const reduceMotion = useReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const DRAWER_WIDTH = 256;

  // On release, decide from where the flick was heading rather than where it
  // stopped, so a short fast swipe closes the drawer like a real panel.
  const handleDrawerDragEnd = (_event: PointerEvent, info: PanInfo) => {
    const projected = info.offset.x + projectMomentum(info.velocity.x);
    if (projected < -DRAWER_WIDTH / 3) onClose?.();
  };

  const menuItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'meetings', label: t.nav.meetings, icon: Video },
    { id: 'tasks', label: t.nav.tasks, icon: CheckSquare },
    { id: 'calendar', label: t.nav.calendar, icon: Calendar },
  ];

  // Below lg the sidebar is a draggable drawer; at lg it is static chrome, so
  // the drag behaviour is attached only where it makes sense.
  const drawerMotion = isDesktop
    ? {}
    : {
        initial: false as const,
        animate: { x: isOpen ? 0 : -DRAWER_WIDTH },
        transition: reduceMotion ? { duration: 0.12 } : SPRING_SHEET,
        drag: (isOpen ? 'x' : false) as 'x' | false,
        dragConstraints: { left: -DRAWER_WIDTH, right: 0 },
        dragElastic: { left: 0, right: 0.12 },
        dragMomentum: false,
        onDragEnd: handleDrawerDragEnd,
        style: { touchAction: 'pan-y' as const },
      };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0.12 } : SPRING_UI}
            className="app-scrim fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>
      <motion.aside
        {...drawerMotion}
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white flex flex-col h-screen',
          'lg:sticky lg:top-0 lg:translate-x-0 lg:shrink-0',
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <a href="#/landing" className="flex items-center gap-2" aria-label="MeetTask bosh sahifasi">
              <BrandLogo size={34} />
              <span className="font-bold text-xl tracking-tight">MeetTask AI</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.nav.closeMenu}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
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
      </motion.aside>
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
  /** True once content has scrolled under the bar, which is when an edge is needed. */
  isScrolled?: boolean;
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
  isScrolled = false,
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
  const { t, language } = useI18n();
  const publicCopy = getPublicCopy(language);
  const [query, setQuery] = useState('');
  const { theme, toggleTheme } = useTheme();
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


  return (
    <header
      className={cn(
        'app-material h-16 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between gap-3',
        'border-b transition-colors duration-200',
        isScrolled ? 'border-slate-200' : 'border-transparent',
      )}
    >
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        }
      >
        <div className="max-h-80 overflow-y-auto py-2">
          {!hasResults && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              {t.header.noMatches(query.trim())}
            </p>
          )}

          {results.meetings.length > 0 && (
            <div className="px-2">
              <p className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.header.meetings}</p>
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
                    <span className="block text-xs text-slate-500 capitalize">{m.status}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.tasks.length > 0 && (
            <div className="px-2 mt-1">
              <p className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.header.tasks}</p>
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
                    <span className="block text-xs text-slate-500 capitalize">{t.status.replace('-', ' ')}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Popover>

      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <button type="button" onClick={toggleTheme} className="rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label={theme === 'dark' ? publicCopy.themeLight : publicCopy.themeDark}>
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
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
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-red-600 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
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
              <p className="px-4 py-8 text-center text-sm text-slate-500">{t.header.allCaughtUp}</p>
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
                    isRead ? 'bg-slate-50/30' : ''
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
              <Avatar name={settings.displayName} src={avatar} className="w-8 h-8" textClassName="text-[11px]" />
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
