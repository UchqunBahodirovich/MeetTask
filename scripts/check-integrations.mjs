const baseUrl = process.env.MEETTASK_API_URL || 'http://localhost:3001';

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${data.error || `HTTP ${response.status}`}`);
  return data;
}

const health = await request('/api/health');
console.log('Environment:', health.services);

const stt = await request('/api/transcription/temporary-key', { meetingId: 'integration-check' });
console.log('Transcription:', {
  temporaryKeyCreated: typeof stt.api_key === 'string' && stt.api_key.length > 0,
  expiresAt: stt.expires_at,
});

const analysis = await request('/api/analyze', {
  title: 'Integration check',
  participants: [{ id: '1', name: 'Ali' }],
  transcript: '[00:00] Ali: Dilshod hisobotni juma kunigacha tayyorlaydi. Shu qarorga keldik.',
});
console.log('Analysis:', {
  summaryCreated: typeof analysis.summary === 'string' && analysis.summary.length > 0,
  keyPoints: Array.isArray(analysis.keyPoints),
  decisions: Array.isArray(analysis.decisions),
  tasks: Array.isArray(analysis.tasks),
});
