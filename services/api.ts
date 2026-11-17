import type {
  AppSettings,
  Meeting,
  MeetingAnalysis,
  Session,
  Task,
  TaskStatus,
  User,
} from '../types';

/**
 * The API is a separate Go service (Cloud Run), so every call needs an absolute
 * origin in production and cookies must travel for the refresh token.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export const apiUrl = (path: string) => `${API_BASE}${path}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const SESSION_HINT = 'meettask.hasSession';

/** Access token lives in memory only; the refresh token is an httpOnly cookie. */
let accessToken: string | null = null;

const rememberSession = (exists: boolean) => {
  try {
    if (exists) window.localStorage.setItem(SESSION_HINT, '1');
    else window.localStorage.removeItem(SESSION_HINT);
  } catch {
    /* storage may be unavailable */
  }
};

/** Only a hint: the cookie is still the source of truth. */
export const hadSession = () => {
  try {
    return window.localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    return false;
  }
};
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const onUnauthenticated = (handler: (() => void) | null) => {
  onSessionLost = handler;
};

async function readError(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    return response.status === 404
      ? 'API server topilmadi. VITE_API_BASE_URL ni tekshiring.'
      : `So‘rov bajarilmadi (HTTP ${response.status}).`;
  }
  try {
    const body = await response.json();
    return typeof body?.error === 'string' ? body.error : 'So‘rov bajarilmadi.';
  } catch {
    return 'So‘rov bajarilmadi.';
  }
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(apiUrl(path), { ...init, headers, credentials: 'include' });
}

/** A failure worth retrying: the server was unreachable or erred, not "you are signed out". */
export const isTransientError = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 0 || error.status >= 500;

/** Refresh once on a 401, then replay the original call. */
async function request<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
  let response: Response;
  try {
    response = await rawRequest(path, init);
  } catch {
    // fetch only rejects when the server cannot be reached (e.g. it is restarting).
    throw new ApiError('Server bilan aloqa yo‘q. Birozdan so‘ng qayta urinib ko‘ring.', 0);
  }

  if (response.status === 401 && allowRetry && path !== '/api/auth/refresh') {
    try {
      await refresh();
    } catch (error) {
      // Only an explicit 401 from the refresh endpoint ends the session. A
      // server that is briefly unreachable must not log the user out.
      if (isTransientError(error)) throw error;
      setAccessToken(null);
      onSessionLost?.();
      throw new ApiError('Sessiya tugadi. Qaytadan kiring.', 401);
    }
    response = await rawRequest(path, init);
  }

  if (!response.ok) throw new ApiError(await readError(response), response.status);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------------------------------------------------------------- normalising

/**
 * The Go models use optional pointers where the UI expects plain strings, so
 * normalise at the boundary and leave the components untouched.
 */
const toTask = (raw: Task & { assigneeId?: string | null; meetingId?: string | null }): Task => ({
  ...raw,
  assigneeId: raw.assigneeId ?? '',
  meetingId: raw.meetingId ?? '',
  description: raw.description ?? undefined,
});

const toMeeting = (raw: Meeting & { tasks?: Task[] }): Meeting => ({
  ...raw,
  participants: raw.participants ?? [],
  keyPoints: raw.keyPoints ?? [],
  decisions: raw.decisions ?? [],
  tasks: raw.tasks?.map(toTask),
});

// --------------------------------------------------------------------- auth

interface SessionResponse extends Session {
  accessToken: string;
}

const adoptSession = (payload: SessionResponse): Session => {
  setAccessToken(payload.accessToken);
  rememberSession(true);
  return { user: payload.user, workspaceId: payload.workspaceId, accessRole: payload.accessRole };
};

export async function register(input: {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
}): Promise<Session> {
  return adoptSession(
    await request<SessionResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export async function login(email: string, password: string): Promise<Session> {
  return adoptSession(
    await request<SessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  );
}

/** Exchange a Google ID token for a session on this API. */
export async function loginWithGoogle(idToken: string, workspaceName?: string): Promise<Session> {
  return adoptSession(
    await request<SessionResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, workspaceName: workspaceName ?? '' }),
    }),
  );
}

let refreshing: Promise<Session> | null = null;

/**
 * Used on startup and whenever an access token expires. Refresh tokens are
 * single-use (the server rotates them), so concurrent callers must share one
 * request: parallel refreshes would send the same cookie twice, the second
 * would be rejected as revoked, and the user would be logged out.
 */
export function refresh(): Promise<Session> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        return adoptSession(await request<SessionResponse>('/api/auth/refresh', { method: 'POST' }, false));
      } catch (error) {
        // An explicit 401 means the cookie is absent or expired. Network/server
        // failures are temporary and must not erase the remembered-session hint.
        if (error instanceof ApiError && error.status === 401) rememberSession(false);
        throw error;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/api/auth/logout', { method: 'POST' }, false);
  } finally {
    setAccessToken(null);
    rememberSession(false);
  }
}

// ---------------------------------------------------------------- workspace

export const listMembers = (workspaceId: string) =>
  request<User[]>(`/api/workspaces/${workspaceId}/members`);

export const addMember = (
  workspaceId: string,
  member: { name: string; email?: string; role?: string; accessRole?: string },
) =>
  request<User>(`/api/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: JSON.stringify({ accessRole: 'member', ...member }),
  });

export const updateMember = (
  workspaceId: string,
  userId: string,
  patch: { role?: string | null; name?: string; accessRole?: string },
) =>
  request<void>(`/api/workspaces/${workspaceId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const removeMember = (workspaceId: string, userId: string) =>
  request<void>(`/api/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });

// ----------------------------------------------------------------- meetings

export async function listMeetings(): Promise<Meeting[]> {
  const meetings = await request<Meeting[]>('/api/meetings');
  return (meetings ?? []).map(toMeeting);
}

export async function getMeeting(id: string): Promise<Meeting> {
  return toMeeting(await request<Meeting>(`/api/meetings/${id}`));
}

export async function createMeeting(input: {
  title: string;
  date: string;
  duration: string;
  status: Meeting['status'];
  participantIds: string[];
  summary?: string;
  keyPoints?: string[];
  decisions?: string[];
  transcript?: Meeting['transcript'];
}): Promise<Meeting> {
  return toMeeting(await request<Meeting>('/api/meetings', { method: 'POST', body: JSON.stringify(input) }));
}

export const updateMeeting = (id: string, patch: Record<string, unknown>) =>
  request<Meeting>(`/api/meetings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(toMeeting);

export const deleteMeeting = (id: string) => request<void>(`/api/meetings/${id}`, { method: 'DELETE' });

export async function reanalyzeMeeting(id: string): Promise<{ analysis: MeetingAnalysis; tasks: Task[] }> {
  const result = await request<{ analysis: MeetingAnalysis; tasks: Task[] }>(
    `/api/meetings/${id}/reanalyze`,
    { method: 'POST' },
  );
  return { analysis: result.analysis, tasks: (result.tasks ?? []).map(toTask) };
}

// -------------------------------------------------------------------- tasks

export async function listTasks(): Promise<Task[]> {
  const tasks = await request<Task[]>('/api/tasks');
  return (tasks ?? []).map(toTask);
}

export async function createTask(input: Partial<Task> & { title: string }): Promise<Task> {
  return toTask(
    await request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        meetingId: input.meetingId || null,
        title: input.title,
        description: input.description ?? null,
        assigneeId: input.assigneeId || null,
        assigneeIds: input.assigneeIds ?? [],
        assigneeSource: input.assigneeSource ?? null,
        assignmentRole: input.assignmentRole ?? null,
        deadline: input.deadline ?? 'Belgilanmagan',
        priority: input.priority ?? 'medium',
        status: input.status ?? 'todo',
        orderIndex: input.orderIndex ?? Date.now(),
        isAiGenerated: input.isAiGenerated ?? false,
        isApproved: input.isApproved ?? true,
      }),
    }),
  );
}

export const updateTask = (id: string, patch: Record<string, unknown>) =>
  request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(toTask);

export const deleteTask = (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' });

export const approveTask = (id: string) =>
  request<Task>(`/api/tasks/${id}/approve`, { method: 'POST' }).then(toTask);

export const moveTask = (id: string, status: TaskStatus, orderIndex: number) =>
  updateTask(id, { status, orderIndex });

// ----------------------------------------------------------------- settings

export const getSettings = () => request<AppSettings>('/api/settings');
export const saveSettings = (settings: AppSettings) =>
  request<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
