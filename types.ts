export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
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
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  participants: User[];
  status: 'upcoming' | 'live' | 'completed';
  summary?: string;
  transcript?: TranscriptLine[];
  tasks?: Task[];
}
