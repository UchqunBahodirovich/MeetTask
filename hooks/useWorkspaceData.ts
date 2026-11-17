import { useCallback, useEffect, useState } from 'react';
import { AppSettings, Meeting, MeetingAnalysis, Task, TaskStatus, User } from '../types';
import * as api from '../services/api';
import { DEFAULT_SETTINGS } from '../constants';

/** Midpoint between neighbours keeps reordering to a single updated row. */
function orderIndexFor(tasks: Task[], status: TaskStatus, beforeTaskId?: string): number {
  const column = tasks
    .filter((task) => task.status === status)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  if (column.length === 0) return Date.now();

  const targetIndex = beforeTaskId ? column.findIndex((task) => task.id === beforeTaskId) : -1;
  if (targetIndex === -1) return (column[column.length - 1].orderIndex ?? 0) + 1000;

  const target = column[targetIndex].orderIndex ?? 0;
  const previous = targetIndex === 0 ? target - 2000 : (column[targetIndex - 1].orderIndex ?? target - 2000);
  return (previous + target) / 2;
}

const byOrder = (a: Task, b: Task) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0);

export interface WorkspaceData {
  meetings: Meeting[];
  tasks: Task[];
  team: User[];
  settings: AppSettings;
  isLoading: boolean;
  error: string;
  reload: () => Promise<void>;
  moveTask: (taskId: string, status: TaskStatus, beforeTaskId?: string) => Promise<void>;
  approveTask: (taskId: string) => Promise<void>;
  saveTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  createMeeting: (meeting: Meeting, tasks?: Task[]) => Promise<Meeting | null>;
  updateMeeting: (id: string, patch: Record<string, unknown>, tasks?: Task[]) => Promise<void>;
  deleteMeeting: (id: string) => Promise<boolean>;
  applyReanalysis: (meetingId: string, analysis: MeetingAnalysis, tasks: Task[]) => void;
  saveSettings: (settings: AppSettings) => Promise<void>;
  /** Write-through team edits: each resolves once the server has it and the list is refreshed. */
  addMember: (member: { name: string; email?: string; role?: string }) => Promise<void>;
  updateMember: (userId: string, patch: { name?: string; role?: string | null }) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
}

/**
 * Owns everything that used to live in localStorage. Mutations write through to
 * the API and then patch local state, so the board stays responsive without a
 * full refetch after every change.
 */
export function useWorkspaceData(workspaceId: string | null): WorkspaceData {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError('');
    try {
      const [loadedMeetings, loadedTasks, loadedTeam, loadedSettings] = await Promise.all([
        api.listMeetings(),
        api.listTasks(),
        api.listMembers(workspaceId),
        api.getSettings(),
      ]);
      setMeetings(loadedMeetings);
      setTasks([...loadedTasks].sort(byOrder));
      setTeam(loadedTeam ?? []);
      setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ma’lumotlarni yuklab bo‘lmadi.');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patchTask = (updated: Task) =>
    setTasks((current) => current.map((task) => (task.id === updated.id ? updated : task)).sort(byOrder));

  const moveTask = useCallback<WorkspaceData['moveTask']>(
    async (taskId, status, beforeTaskId) => {
      const moving = tasks.find((task) => task.id === taskId);
      if (!moving) return;
      const orderIndex = orderIndexFor(tasks, status, beforeTaskId);
      // Move on screen first; the request only confirms it.
      patchTask({ ...moving, status, orderIndex });
      try {
        patchTask(await api.moveTask(taskId, status, orderIndex));
      } catch (err) {
        patchTask(moving);
        setError(err instanceof Error ? err.message : 'Vazifani ko‘chirib bo‘lmadi.');
      }
    },
    [tasks],
  );

  const approveTask = useCallback<WorkspaceData['approveTask']>(async (taskId) => {
    try {
      patchTask(await api.approveTask(taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vazifani tasdiqlab bo‘lmadi.');
    }
  }, []);

  const saveTask = useCallback<WorkspaceData['saveTask']>(
    async (task) => {
      const exists = tasks.some((item) => item.id === task.id);
      try {
        if (exists) {
          patchTask(
            await api.updateTask(task.id, {
              title: task.title,
              description: task.description ?? null,
              assigneeId: task.assigneeId || null,
              assigneeSource: task.assigneeSource ?? null,
              deadline: task.deadline,
              priority: task.priority,
              status: task.status,
              meetingId: task.meetingId || null,
              isApproved: task.isApproved,
            }),
          );
        } else {
          const created = await api.createTask(task);
          setTasks((current) => [created, ...current].sort(byOrder));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Vazifani saqlab bo‘lmadi.');
      }
    },
    [tasks],
  );

  const deleteTask = useCallback<WorkspaceData['deleteTask']>(
    async (taskId) => {
      const previous = tasks;
      setTasks((current) => current.filter((task) => task.id !== taskId));
      try {
        await api.deleteTask(taskId);
      } catch (err) {
        setTasks(previous);
        setError(err instanceof Error ? err.message : 'Vazifani o‘chirib bo‘lmadi.');
      }
    },
    [tasks],
  );

  const createMeeting = useCallback<WorkspaceData['createMeeting']>(async (meeting, newTasks = []) => {
    try {
      const created = await api.createMeeting({
        title: meeting.title,
        date: meeting.date,
        duration: meeting.duration,
        status: meeting.status,
        participantIds: meeting.participants.map((participant) => participant.id),
        summary: meeting.summary,
        keyPoints: meeting.keyPoints,
        decisions: meeting.decisions,
        transcript: meeting.transcript,
      });
      setMeetings((current) => [created, ...current]);

      if (newTasks.length > 0) {
        const saved = await Promise.all(
          newTasks.map((task, index) =>
            api.createTask({ ...task, meetingId: created.id, orderIndex: Date.now() + index }),
          ),
        );
        setTasks((current) => [...saved, ...current].sort(byOrder));
      }
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yig‘ilishni saqlab bo‘lmadi.');
      return null;
    }
  }, []);

  const updateMeeting = useCallback<WorkspaceData['updateMeeting']>(async (id, patch, newTasks = []) => {
    try {
      const updated = await api.updateMeeting(id, patch);
      setMeetings((current) => current.map((meeting) => (meeting.id === id ? updated : meeting)));
      if (newTasks.length > 0) {
        const saved = await Promise.all(
          newTasks.map((task, index) =>
            api.createTask({ ...task, meetingId: id, orderIndex: Date.now() + index }),
          ),
        );
        setTasks((current) => [...saved, ...current].sort(byOrder));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yig‘ilishni yangilab bo‘lmadi.');
    }
  }, []);

  /**
   * Deleting a meeting also removes its transcript and every task that came
   * from it — the server does this in one batch, so mirror the same removal.
   */
  const deleteMeeting = useCallback<WorkspaceData['deleteMeeting']>(async (id) => {
    const previousMeetings = meetings;
    const previousTasks = tasks;
    setMeetings((current) => current.filter((meeting) => meeting.id !== id));
    setTasks((current) => current.filter((task) => task.meetingId !== id));
    try {
      await api.deleteMeeting(id);
      return true;
    } catch (err) {
      setMeetings(previousMeetings);
      setTasks(previousTasks);
      setError(err instanceof Error ? err.message : 'Yig‘ilishni o‘chirib bo‘lmadi.');
      return false;
    }
  }, [meetings, tasks]);

  /** The server already replaced the AI tasks; mirror that locally. */
  const applyReanalysis = useCallback<WorkspaceData['applyReanalysis']>((meetingId, analysis, replacement) => {
    setMeetings((current) =>
      current.map((meeting) =>
        meeting.id === meetingId
          ? {
              ...meeting,
              summary: analysis.summary || meeting.summary,
              keyPoints: analysis.keyPoints,
              decisions: analysis.decisions,
            }
          : meeting,
      ),
    );
    setTasks((current) =>
      [...replacement, ...current.filter((task) => !(task.meetingId === meetingId && task.isAiGenerated))].sort(
        byOrder,
      ),
    );
  }, []);

  const saveSettings = useCallback<WorkspaceData['saveSettings']>(async (next) => {
    setSettings(next);
    try {
      setSettings({ ...DEFAULT_SETTINGS, ...(await api.saveSettings(next)) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sozlamalarni saqlab bo‘lmadi.');
    }
  }, []);

  /**
   * The team dialog hands back the whole list, so turn it into the add / update
   * / remove calls the API actually exposes.
   */
  const syncTeam = useCallback(async () => {
    if (workspaceId) setTeam(await api.listMembers(workspaceId));
  }, [workspaceId]);

  const addMember = useCallback<WorkspaceData['addMember']>(async (member) => {
    if (!workspaceId) return;
    await api.addMember(workspaceId, {
      name: member.name.trim(),
      email: member.email?.trim() || undefined,
      role: member.role?.trim() || undefined,
    });
    await syncTeam();
  }, [workspaceId, syncTeam]);

  const updateMember = useCallback<WorkspaceData['updateMember']>(async (userId, patch) => {
    if (!workspaceId) return;
    await api.updateMember(workspaceId, userId, patch);
    await syncTeam();
  }, [workspaceId, syncTeam]);

  const removeMember = useCallback<WorkspaceData['removeMember']>(async (userId) => {
    if (!workspaceId) return;
    await api.removeMember(workspaceId, userId);
    await syncTeam();
  }, [workspaceId, syncTeam]);

  return {
    meetings,
    tasks,
    team,
    settings,
    isLoading,
    error,
    reload,
    moveTask,
    approveTask,
    saveTask,
    deleteTask,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    applyReanalysis,
    saveSettings,
    addMember,
    updateMember,
    removeMember,
  };
}
