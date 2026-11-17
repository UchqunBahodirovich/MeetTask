export type AppTab = 'dashboard' | 'meetings' | 'tasks' | 'calendar';
export type AppView = 'main' | 'live' | 'summary';

export interface AppRoute {
  tab: AppTab;
  view: AppView;
  meetingId: string | null;
}

export const DEFAULT_ROUTE: AppRoute = { tab: 'dashboard', view: 'main', meetingId: null };

export const isAppTab = (value: string): value is AppTab =>
  value === 'dashboard' || value === 'meetings' || value === 'tasks' || value === 'calendar';

/** Hash routes work in development and static hosting without server rewrites. */
export function parseAppRoute(hash = window.location.hash): AppRoute {
  const raw = hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);

  if (parts[0] === 'meeting' && parts[1]) {
    const view = parts[2] === 'live' ? 'live' : 'summary';
    return { tab: 'meetings', view, meetingId: decodeURIComponent(parts[1]) };
  }

  // Keep old shared URLs (#meeting-123) working as summary links.
  if (raw.startsWith('meeting-') && raw.length > 'meeting-'.length) {
    return { tab: 'meetings', view: 'summary', meetingId: decodeURIComponent(raw.slice('meeting-'.length)) };
  }

  return isAppTab(parts[0] ?? '')
    ? { tab: parts[0] as AppTab, view: 'main', meetingId: null }
    : DEFAULT_ROUTE;
}

export function appRouteHash(route: AppRoute): string {
  if (route.view !== 'main' && route.meetingId) {
    return `#/meeting/${encodeURIComponent(route.meetingId)}/${route.view}`;
  }
  return `#/${route.tab}`;
}
