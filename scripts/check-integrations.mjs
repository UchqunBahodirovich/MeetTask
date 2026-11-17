const baseUrl = process.env.MEETTASK_API_URL || 'http://localhost:3001';

const accessToken = process.env.MEETTASK_ACCESS_TOKEN;

async function request(path, body, authenticated = true) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(authenticated && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${data.error || `HTTP ${response.status}`}`);
  return data;
}

const health = await request('/api/health', undefined, false);
console.log('Environment:', health.services);

if (!accessToken) {
  console.log('Protected integration checks skipped: set MEETTASK_ACCESS_TOKEN from /api/auth/login.');
  process.exit(0);
}

const stt = await request('/api/transcription/temporary-key', { meetingId: 'integration-check' });
console.log('Transcription:', {
  temporaryKeyCreated: typeof stt.api_key === 'string' && stt.api_key.length > 0,
  expiresAt: stt.expires_at,
});

const analysis = await request('/api/analyze', {
  title: 'Integration check',
  meetingDate: '2026-09-01T09:00:00Z',
  outputLanguage: 'uz',
  participants: [
    { id: 'engineer-1', name: 'Dilshod Karimov', role: 'Backend Engineer' },
    { id: 'designer-1', name: 'Malika Ergasheva', role: 'Product Designer' },
    { id: 'designer-2', name: 'Nodira Aliyeva', role: 'Product Designer' },
  ],
  transcript: [
    '[00:00] Speaker 1: Dilshod, API hisobotini juma kunigacha tayyorlang.',
    '[00:08] Speaker 1: Product Designer jamoasi onboarding maketlarini tayyorlasin.',
  ].join('\n'),
});
const namedAssignment = analysis.tasks.some((task) => task.assigneeIds?.includes('engineer-1'));
const roleAssignment = analysis.tasks.some((task) =>
  task.assignmentBasis === 'role'
  && task.assigneeIds?.includes('designer-1')
  && task.assigneeIds?.includes('designer-2'),
);
console.log('Analysis:', {
  summaryCreated: typeof analysis.summary === 'string' && analysis.summary.length > 0,
  keyPoints: Array.isArray(analysis.keyPoints),
  decisions: Array.isArray(analysis.decisions),
  tasks: Array.isArray(analysis.tasks),
  namedAssignment,
  multiRoleAssignment: roleAssignment,
  assignments: analysis.tasks.map((task) => ({
    title: task.title,
    basis: task.assignmentBasis,
    assigneeIds: task.assigneeIds,
    suggestedRole: task.suggestedRole,
  })),
});
if (!namedAssignment || !roleAssignment) {
  throw new Error('Name or multi-person role assignment check failed.');
}
