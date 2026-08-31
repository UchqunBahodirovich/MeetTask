import { AppSettings, Meeting, TaskFilters, User } from './types';

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Alex Rivera', email: 'alex@meettask.ai', role: 'Product Manager', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Alex&backgroundColor=2563eb' },
  { id: '2', name: 'Sarah Chen', email: 'sarah@meettask.ai', role: 'Product Designer', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Sarah&backgroundColor=10b981' },
  { id: '3', name: 'Michael Scott', email: 'michael@meettask.ai', role: 'Sales Lead', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Michael&backgroundColor=f59e0b' },
  { id: '4', name: 'Ali Hassan', email: 'ali@meettask.ai', role: 'Finance Analyst', avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=Ali&backgroundColor=8b5cf6' },
];

export const CURRENT_USER: User = MOCK_USERS[0];

export const DEFAULT_SETTINGS: AppSettings = {
  displayName: CURRENT_USER.name,
  email: CURRENT_USER.email,
  language: 'en',
  notifyAiTasks: true,
  notifyUpcoming: true,
  defaultTaskView: 'kanban',
};

export const EMPTY_TASK_FILTERS: TaskFilters = {
  query: '',
  statuses: [],
  priorities: [],
  assigneeIds: [],
  meetingIds: [],
  aiOnly: false,
  pendingApprovalOnly: false,
};

export const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'm1',
    title: 'Q1 Product Strategy Sync',
    date: '2024-03-20T10:00:00Z',
    duration: '45 min',
    participants: [MOCK_USERS[0], MOCK_USERS[1], MOCK_USERS[2]],
    status: 'completed',
    summary: 'Discussed the roadmap for Q1 focusing on AI integration and user retention features.',
    transcript: [
      { id: 't1', speaker: 'Alex Rivera', text: 'Hi everyone, let\'s start the Q1 strategy sync.', timestamp: '10:00' },
      { id: 't2', speaker: 'Sarah Chen', text: 'I think we should prioritize the AI task extraction feature.', timestamp: '10:02' },
      { id: 't3', speaker: 'Michael Scott', text: 'Ali, can you send the budget report by Monday?', timestamp: '10:05' },
      { id: 't4', speaker: 'Sarah Chen', text: 'I\'ll handle the UI mockups for the new dashboard.', timestamp: '10:08' },
    ],
    tasks: [
      {
        id: 'tk1',
        title: 'Send the budget report',
        assigneeId: '4',
        deadline: '2024-03-25',
        priority: 'high',
        status: 'todo',
        meetingId: 'm1',
        isAiGenerated: true,
        isApproved: false,
      },
      {
        id: 'tk2',
        title: 'UI mockups for new dashboard',
        assigneeId: '2',
        deadline: '2024-03-27',
        priority: 'medium',
        status: 'in-progress',
        meetingId: 'm1',
        isAiGenerated: true,
        isApproved: true,
      }
    ]
  },
  {
    id: 'm2',
    title: 'Daily Standup',
    date: '2024-03-21T09:00:00Z',
    duration: '15 min',
    participants: MOCK_USERS,
    status: 'upcoming',
  }
];
