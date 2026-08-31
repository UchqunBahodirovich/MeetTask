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

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  meetingId: string;
  isAiGenerated: boolean;
  isApproved: boolean;
  /** How the assignee was decided: named in the meeting, or matched by job role. */
  assigneeSource?: 'stated' | 'role';
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
    assignee: string | null;
    /** Participant proposed from job role when nobody was named. */
    suggestedAssignee: string | null;
    deadline: string | null;
    priority: Priority;
  }>;
}

export interface Meeting {
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
