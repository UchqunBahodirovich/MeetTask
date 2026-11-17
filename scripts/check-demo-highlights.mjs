import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Replay the real demo text without waiting for its presentation timers.
const source = await readFile(new URL('../services/demoMeeting.ts', import.meta.url), 'utf8');
const script = source.slice(source.indexOf('const SCRIPT:'));
const transcript = [...script.matchAll(/text: '([^']*)'/g)]
  .map((match, index) => `[0:${String(index).padStart(2, '0')}] Speaker: ${match[1]}`).join('\n');
assert.ok(transcript.includes('Byudjet'), 'Demo transcript was not loaded');
const response = await fetch(`${process.env.MEETTASK_API_URL ?? 'http://localhost:3001'}/api/analyze`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(process.env.MEETTASK_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.MEETTASK_ACCESS_TOKEN}` } : {}),
  },
  body: JSON.stringify({
    title: 'Demo highlights verification', mode: 'highlights', outputLanguage: 'uz',
    meetingDate: '2026-09-11', participants: [], transcript,
  }),
  signal: AbortSignal.timeout(180_000),
});
const result = await response.json();
assert.ok(response.ok, `HTTP ${response.status}: ${result.error}`);
assert.equal(result.tasks.length, 0, 'Highlights must not create tasks');
assert.ok(result.keyPoints.length > 0, 'No important moments extracted');
assert.ok(result.decisions.length > 0, 'Release decision missing');
assert.ok(!result.partial, 'Analysis must finish fully');
console.log(JSON.stringify({ keyPoints: result.keyPoints, decisions: result.decisions, tasks: result.tasks.length }, null, 2));
