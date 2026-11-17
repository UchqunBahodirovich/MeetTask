import type { Language, Meeting, MeetingAnalysis, TranscriptLine } from '../types';
import { tokensToLines, type TranscriptToken } from './transcript';
import { ApiError } from './api';

/**
 * The API server is separate from the static site. When the two are served
 * from one origin (local dev, `npm start`) relative paths work; on a static
 * host such as Firebase Hosting set VITE_API_BASE_URL to the API's origin.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE}${path}`;

const NO_API_SERVER =
  'API server topilmadi. Serverni ishga tushiring yoki VITE_API_BASE_URL ni sozlang.';

/**
 * A static host (e.g. Firebase Hosting) answers unknown /api paths with the SPA
 * shell, so a 200 with HTML means the API is simply not deployed there.
 */
function assertApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json') && !contentType.includes('x-ndjson')) {
    throw new Error(NO_API_SERVER);
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.error === 'string' ? body.error : 'So‘rov bajarilmadi.';
  } catch {
    return 'So‘rov bajarilmadi.';
  }
}

export async function getTranscriptionKey(meetingId: string): Promise<string> {
  const response = await fetch(apiUrl('/api/transcription/temporary-key'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId }),
  });
  if (!response.ok) throw new ApiError(await readError(response), response.status);
  assertApiResponse(response);
  const data = await response.json();
  if (typeof data.api_key !== 'string') throw new Error('Transkripsiya kaliti olinmadi.');
  return data.api_key;
}

export interface AnalysisProgress {
  /** Zero-based index of the chunk being analysed. */
  index: number;
  total: number;
}

/**
 * Ask the server to analyse a transcript. Long transcripts are split into
 * model-sized chunks server-side and processed one after another; progress for
 * each chunk arrives over an NDJSON stream.
 */
export async function analyzeMeeting(
  meeting: Meeting,
  transcript: TranscriptLine[],
  options: {
    onProgress?: (progress: AnalysisProgress) => void;
    signal?: AbortSignal;
    /** Titles already extracted; the server will not return them again. */
    knownTasks?: string[];
    /** UI language used for every generated human-readable field. */
    language?: Language;
    mode?: 'tasks' | 'highlights';
  } = {},
): Promise<MeetingAnalysis> {
  const transcriptText = transcript
    .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
    .join('\n');

  const response = await fetch(apiUrl('/api/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    signal: options.signal,
    body: JSON.stringify({
      title: meeting.title,
      meetingDate: meeting.date,
      participants: meeting.participants.map(({ id, name, role }) => ({ id, name, role: role ?? null })),
      transcript: transcriptText,
      outputLanguage: options.language ?? 'uz',
      mode: options.mode ?? meeting.analysisMode ?? 'tasks',
      ...(options.knownTasks?.length ? { knownTasks: options.knownTasks } : {}),
    }),
  });
  if (!response.ok) throw new ApiError(await readError(response), response.status);
  assertApiResponse(response);

  // A proxy or older server may answer with plain JSON instead of the stream.
  if (!response.body || !(response.headers.get('content-type') || '').includes('x-ndjson')) {
    return response.json();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let analysis: MeetingAnalysis | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return; // ignore a partial or malformed line
    }
    if (event.type === 'progress') {
      options.onProgress?.({ index: Number(event.index) || 0, total: Number(event.total) || 1 });
    } else if (event.type === 'result') {
      analysis = event.analysis as MeetingAnalysis;
    } else if (event.type === 'error') {
      throw new Error(typeof event.error === 'string' ? event.error : 'Tahlil bajarilmadi.');
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';
    lines.forEach(handleLine);
  }
  if (buffered) handleLine(buffered);

  if (!analysis) throw new Error('Tahlil natijasi kelmadi.');
  return analysis;
}

export type TranscribeStage = 'uploading' | 'transcribing' | 'analyzing';

export interface TranscribeProgress {
  stage: TranscribeStage;
  /** 0-100 while uploading; undefined once the file is on the server. */
  percent?: number;
}

export interface TranscribeResult {
  transcript: TranscriptLine[];
  text: string;
  audioDurationMs: number | null;
}

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 400; // ~20 minutes

function uploadRecording(
  file: File,
  languageHints: string[],
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', apiUrl('/api/meetings/transcribe'));
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    if (languageHints.length) request.setRequestHeader('X-Language-Hints', languageHints.join(','));

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let payload: { transcriptionId?: string; error?: string } = {};
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        /* fall through to the generic message below */
      }
      if (request.status >= 200 && request.status < 300 && payload.transcriptionId) {
        resolve(payload.transcriptionId);
      } else if (!(request.getResponseHeader('content-type') ?? '').includes('json')) {
        reject(new Error(NO_API_SERVER));
      } else {
        reject(new Error(payload.error || `Yuklab bo\u2018lmadi (HTTP ${request.status}).`));
      }
    };
    request.onerror = () => reject(new Error('Faylni yuklashda tarmoq xatosi.'));
    request.onabort = () => reject(new DOMException('Bekor qilindi', 'AbortError'));
    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(file);
  });
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Bekor qilindi', 'AbortError'));
      },
      { once: true },
    );
  });

/** Upload a recording, wait for the transcription to finish, and return grouped lines. */
export async function transcribeRecording(
  file: File,
  options: {
    languageHints?: string[];
    onProgress?: (progress: TranscribeProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<TranscribeResult> {
  const { languageHints = [], onProgress, signal } = options;

  onProgress?.({ stage: 'uploading', percent: 0 });
  const transcriptionId = await uploadRecording(
    file,
    languageHints,
    (percent) => onProgress?.({ stage: 'uploading', percent }),
    signal,
  );

  onProgress?.({ stage: 'transcribing' });
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await wait(POLL_INTERVAL_MS, signal);
    const response = await fetch(apiUrl(`/api/meetings/transcribe/${transcriptionId}`), { signal });
    if (!response.ok) throw new ApiError(await readError(response), response.status);
    assertApiResponse(response);
    const payload = await response.json();
    if (payload.status === 'completed') {
      return {
        transcript: tokensToLines((payload.tokens ?? []) as TranscriptToken[]),
        text: typeof payload.text === 'string' ? payload.text : '',
        audioDurationMs: payload.audioDurationMs ?? null,
      };
    }
  }
  throw new Error('Transkripsiya juda uzoq davom etdi. Keyinroq qayta urinib ko\u2018ring.');
}
