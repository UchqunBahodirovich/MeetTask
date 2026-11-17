export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  /** Job role, used to route action items that nobody was explicitly assigned. */
  role?: string;
}

export type AccessRole = 'owner' | 'admin' | 'member' | 'guest';

export interface Session {
  user: User;
  workspaceId: string;
  accessRole: AccessRole;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  /** All owners. assigneeId remains the first owner for old saved data. */
  assigneeIds?: string[];
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  meetingId: string;
  isAiGenerated: boolean;
  isApproved: boolean;
  /** How the assignee was decided: named in the meeting, or matched by job role. */
  assigneeSource?: 'stated' | 'role';
  /** Exact team role used when the task was routed to a group. */
  assignmentRole?: string;
  /** Fractional index so a card dropped between two others needs no renumbering. */
  orderIndex?: number;
  workspaceId?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export interface MeetingAnalysis {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  /** How many transcript chunks the analyzer processed. */
  chunkCount?: number;
  /** True when at least one chunk failed and its content is missing. */
  partial?: boolean;
  failedChunks?: number;
  tasks: Array<{
    title: string;
    description: string;
    /** Exact participant IDs from the input list; supports several owners. */
    assigneeIds: string[];
    assignmentBasis: 'named' | 'role' | 'unassigned';
    /** Exact role title proposed when the transcript did not name an owner. */
    suggestedRole: string | null;
    deadline: string | null;
    priority: Priority;
  }>;
}

export interface Meeting {
  analysisMode?: 'tasks' | 'highlights';
  id: string;
  title: string;
  date: string;
  duration: string;
  participants: User[];
  status: 'upcoming' | 'live' | 'completed';
  summary?: string;
  keyPoints?: string[];
  decisions?: string[];
  transcript?: TranscriptLine[];
  tasks?: Task[];
}

export type Language = 'en' | 'uz' | 'ru';

export interface AppSettings {
  displayName: string;
  email: string;
  language: Language;
  notifyAiTasks: boolean;
  notifyUpcoming: boolean;
  defaultTaskView: 'kanban' | 'list';
}

export interface TaskFilters {
  query: string;
  statuses: TaskStatus[];
  priorities: Priority[];
  assigneeIds: string[];
  meetingIds: string[];
  aiOnly: boolean;
  pendingApprovalOnly: boolean;
}
