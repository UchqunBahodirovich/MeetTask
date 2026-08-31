import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Users,
  Video,
  VideoOff,
  MonitorSpeaker,
  Loader2,
} from 'lucide-react';
import { SonioxClient, type RealtimeToken, type Recording } from '@soniox/client';
import type { Meeting, MeetingAnalysis, Task, TranscriptLine } from '../types';
import { analyzeMeeting, getTranscriptionKey } from '../services/meetingApi';
import { tokensToLines } from '../services/transcript';
import { analysisToTasks } from '../services/analysis';
import { MixedAudioSource } from '../services/audioSource';
import { useI18n } from '../i18n';

interface LiveMeetingResult {
  transcript: TranscriptLine[];
  analysis: MeetingAnalysis | null;
  tasks: Task[];
}

interface LiveMeetingProps {
  meeting: Meeting;
  onEnd: (result: LiveMeetingResult) => void;
}

type ConnectionState = 'connecting' | 'listening' | 'paused' | 'error';

/** How often live detection looks for new speech to analyse. */
const LIVE_SCAN_INTERVAL_MS = 30_000;
/** Minimum amount of new speech before spending a model call on it. */
const LIVE_SCAN_MIN_CHARS = 400;

export const LiveMeeting: React.FC<LiveMeetingProps> = ({ meeting, onEnd }) => {
  const [isMuted, setIsMuted] = useState(false);
  const { t } = useI18n();
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [provisionalText, setProvisionalText] = useState('');
  const [detectedTasks, setDetectedTasks] = useState<Task[]>([]);
  const [time, setTime] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [analysisChunk, setAnalysisChunk] = useState<{ index: number; total: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [systemAudioOn, setSystemAudioOn] = useState(false);
  const [isTogglingSystemAudio, setIsTogglingSystemAudio] = useState(false);
  const recordingRef = useRef<Recording | null>(null);
  const audioSourceRef = useRef<MixedAudioSource | null>(null);
  const finalTokensRef = useRef<RealtimeToken[]>([]);
  const finalTokenKeysRef = useRef(new Set<string>());
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const detectedTasksRef = useRef<Task[]>([]);
  const scannedLineCountRef = useRef(0);
  const scannedCharCountRef = useRef(0);
  const isScanningRef = useRef(false);
  const scanAbortRef = useRef<AbortController | null>(null);
  const isEndingRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTime((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, provisionalText]);

  useEffect(() => {
    let disposed = false;
    const client = new SonioxClient({
      config: async () => ({ api_key: await getTranscriptionKey(meeting.id) }),
    });
    const audioSource = new MixedAudioSource();
    audioSource.onSystemAudioEnded = () => {
      if (!disposed) setSystemAudioOn(false);
    };
    audioSourceRef.current = audioSource;

    const recording = client.realtime.record({
      source: audioSource,
      model: 'stt-rt-v5',
      enable_speaker_diarization: true,
      enable_language_identification: true,
      auto_reconnect: true,
      max_reconnect_attempts: 4,
      context: {
        general: [
          { key: 'domain', value: 'Business meeting and action items' },
          { key: 'meeting', value: meeting.title },
        ],
        terms: meeting.participants.map((participant) => participant.name),
      },
    });
    recordingRef.current = recording;

    recording.on('connected', () => {
      if (!disposed) setConnectionState('listening');
    });
    recording.on('result', (result) => {
      if (disposed) return;
      for (const token of result.tokens.filter((item) => item.is_final)) {
        const key = [token.start_ms, token.end_ms, token.speaker, token.text].join(':');
        if (!finalTokenKeysRef.current.has(key)) {
          finalTokenKeysRef.current.add(key);
          finalTokensRef.current.push(token);
        }
      }
      finalTokensRef.current.sort((a, b) => (a.start_ms ?? 0) - (b.start_ms ?? 0));
      const nextTranscript = tokensToLines(finalTokensRef.current);
      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);
      setProvisionalText(result.tokens.filter((item) => !item.is_final).map((item) => item.text).join('').trim());
    });
    recording.on('reconnecting', () => {
      if (!disposed) setConnectionState('connecting');
    });
    recording.on('reconnected', () => {
      if (!disposed) setConnectionState('listening');
    });
    recording.on('error', (error) => {
      if (!disposed) {
        setConnectionState('error');
        setErrorMessage(error.message || t.live.stateError);
      }
    });

    return () => {
      disposed = true;
      if (recording.state !== 'stopped' && recording.state !== 'canceled') recording.cancel();
      recordingRef.current = null;
      audioSource.stop();
      audioSourceRef.current = null;
    };
  }, [meeting.id, meeting.participants, meeting.title]);

  /**
   * Live detection: every tick, analyse only the transcript lines added since the
   * last scan and append whatever is new. Sending the whole transcript each time
   * would re-run the full (chunked) analysis and repeat tasks already on screen.
   */
  useEffect(() => {
    const runScan = async () => {
      if (isScanningRef.current || isEndingRef.current) return;

      const lines = transcriptRef.current;
      const freshLines = lines.slice(scannedLineCountRef.current);
      const freshChars = freshLines.reduce((total, line) => total + line.text.length, 0);
      // Wait until there is enough new speech to be worth a model call.
      if (freshLines.length === 0 || freshChars < LIVE_SCAN_MIN_CHARS) return;

      isScanningRef.current = true;
      setIsScanning(true);
      const controller = new AbortController();
      scanAbortRef.current = controller;
      const lineCountAtStart = lines.length;

      try {
        const analysis = await analyzeMeeting(meeting, freshLines, {
          signal: controller.signal,
          knownTasks: detectedTasksRef.current.map((task) => task.title),
        });
        const newTasks = analysisToTasks(analysis, meeting, 'live');
        scannedLineCountRef.current = lineCountAtStart;
        scannedCharCountRef.current += freshChars;
        if (newTasks.length > 0) {
          detectedTasksRef.current = [...newTasks, ...detectedTasksRef.current];
          setDetectedTasks(detectedTasksRef.current);
        }
        setLastScanAt(Date.now());
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // A failed scan is not worth interrupting the meeting for; the final
          // analysis re-reads the whole transcript anyway.
          console.warn('Live task scan failed:', error);
          scannedLineCountRef.current = lineCountAtStart;
        }
      } finally {
        isScanningRef.current = false;
        scanAbortRef.current = null;
        setIsScanning(false);
      }
    };

    const timer = window.setInterval(runScan, LIVE_SCAN_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      scanAbortRef.current?.abort();
    };
  }, [meeting]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  /**
   * Mute only the microphone gain — the session (and any system audio) keeps
   * streaming, so the transcript stays aligned and reconnects are avoided.
   */
  const handleMute = () => {
    const source = audioSourceRef.current;
    if (!source || connectionState === 'error') return;
    const nextMuted = !isMuted;
    source.setMicEnabled(!nextMuted);
    setIsMuted(nextMuted);
    setConnectionState(nextMuted && !systemAudioOn ? 'paused' : 'listening');
  };

  const handleToggleSystemAudio = async () => {
    const source = audioSourceRef.current;
    if (!source || isTogglingSystemAudio) return;
    setErrorMessage('');
    if (systemAudioOn) {
      source.disableSystemAudio();
      setSystemAudioOn(false);
      if (isMuted) setConnectionState('paused');
      return;
    }
    setIsTogglingSystemAudio(true);
    try {
      await source.enableSystemAudio();
      setSystemAudioOn(true);
      setConnectionState('listening');
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError')) {
        // The person dismissed the picker; nothing to report.
      } else {
        setErrorMessage(error instanceof Error ? error.message : t.live.systemAudioFailed);
      }
    } finally {
      setIsTogglingSystemAudio(false);
    }
  };

  const handleEnd = async () => {
    if (isEnding) return;
    isEndingRef.current = true;
    scanAbortRef.current?.abort();
    setIsEnding(true);
    setErrorMessage('');
    try {
      const recording = recordingRef.current;
      if (recording && recording.state !== 'stopped' && recording.state !== 'canceled') {
        await recording.stop();
      }
      const finalTranscript = transcriptRef.current;
      let analysis: MeetingAnalysis | null = null;
      let tasks: Task[] = [];
      if (finalTranscript.length > 0) {
        analysis = await analyzeMeeting(meeting, finalTranscript, { onProgress: setAnalysisChunk });
        tasks = analysisToTasks(analysis, meeting);
        detectedTasksRef.current = tasks;
        setDetectedTasks(tasks);
      }
      onEnd({ transcript: finalTranscript, analysis, tasks });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t.live.endFailed);
      isEndingRef.current = false;
      setIsEnding(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (connectionState === 'connecting') return t.live.stateConnecting;
    if (connectionState === 'paused') return t.live.stateMuted;
    if (connectionState === 'error') return t.live.stateError;
    return systemAudioOn ? t.live.stateMixed : t.live.stateListening;
  }, [connectionState, systemAudioOn, t]);

  const scanStatusLabel = (() => {
    if (isScanning) return t.live.checkingShort;
    if (!lastScanAt) return t.live.waitingForSpeechShort;
    const secondsAgo = Math.max(0, Math.round((Date.now() - lastScanAt) / 1000));
    return t.live.lastCheck(secondsAgo);
  })();

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <div className={`w-3 h-3 rounded-full ${connectionState === 'error' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">{meeting.title}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(time)}</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t.live.participantsCount(meeting.participants.length)}</span>
              {systemAudioOn && (
                <span className="flex items-center gap-1 text-blue-600"><MonitorSpeaker className="w-3 h-3" />{t.live.systemAudio}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleMute} className={`p-3 rounded-xl transition-all ${isMuted ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} aria-label={isMuted ? t.live.resumeMic : t.live.pauseMic}>
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            onClick={handleToggleSystemAudio}
            disabled={isTogglingSystemAudio || connectionState === 'error'}
            title={systemAudioOn ? t.live.systemAudioOn : t.live.systemAudioOff}
            aria-pressed={systemAudioOn}
            className={`p-3 rounded-xl transition-all disabled:opacity-60 ${systemAudioOn ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            aria-label={systemAudioOn ? t.live.stopSystemAudio : t.live.captureSystemAudio}
          >
            {isTogglingSystemAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <MonitorSpeaker className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsVideoOff((value) => !value)} className={`p-3 rounded-xl transition-all ${isVideoOff ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} aria-label={t.live.toggleVideo}>
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
          <button onClick={handleEnd} disabled={isEnding} className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-200">
            <PhoneOff className="w-5 h-5" />
            {isEnding
              ? analysisChunk && analysisChunk.total > 1
                ? t.live.analyzingPart(analysisChunk.index + 1, analysisChunk.total)
                : t.live.analyzing
              : t.live.endMeeting}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />{errorMessage}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-600" /><span className="font-bold text-sm text-slate-900 uppercase tracking-wider">{t.live.liveTranscription}</span></div>
            <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${connectionState === 'listening' ? 'bg-green-500' : 'bg-amber-500'}`} /><span className="text-[10px] font-bold text-slate-400 uppercase">{statusLabel}</span></div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {transcript.map((line) => (
              <div key={line.id} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">{line.speaker[0]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1"><span className="text-sm font-bold text-slate-900">{line.speaker}</span><span className="text-[10px] font-medium text-slate-400">{line.timestamp}</span></div>
                  <p className="text-slate-600 leading-relaxed text-sm">{line.text}</p>
                </div>
              </div>
            ))}
            {provisionalText && <p className="pl-12 text-sm italic text-slate-400">{provisionalText}</p>}
            <div ref={transcriptEndRef} />
            {transcript.length === 0 && !provisionalText && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4"><Mic className="w-12 h-12 opacity-20 animate-pulse" /><p className="font-medium">{t.live.waitingForSpeech}</p></div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 min-h-0">
          <div className="flex-1 flex flex-col bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-800">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
              <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-400" /><span className="font-bold text-sm text-white uppercase tracking-wider">{t.live.aiDetectedTasks}</span></div>
              <div className="flex items-center gap-2">
                {isScanning && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-blue-300" role="status">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t.live.scanning}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">{t.live.foundCount(detectedTasks.length)}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detectedTasks.map((task) => (
                <div key={task.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-fade-up">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      task.priority === 'high' ? 'bg-red-500/20 text-red-300'
                        : task.priority === 'low' ? 'bg-slate-500/20 text-slate-300'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>{t.priority[task.priority]}</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-2">{task.title}</h4>
                  <p className="text-[11px] text-slate-400">{t.live.deadlineLabel(task.deadline)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {meeting.participants.find((participant) => participant.id === task.assigneeId)?.name ?? t.common.unassigned}
                    {task.assigneeSource === 'role' && <span className="text-amber-400/80"> · {t.taskCard.byRole}</span>}
                  </p>
                </div>
              ))}
              {detectedTasks.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 text-center px-6">
                  <Sparkles className={`w-8 h-8 opacity-20 ${isScanning ? 'animate-pulse' : ''}`} />
                  <p className="text-xs font-medium">
                    {isScanning ? t.live.checking : t.live.listening}
                  </p>
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/60 text-[10px] font-medium text-slate-500 flex items-center justify-between">
              <span>{t.live.scanEvery(LIVE_SCAN_INTERVAL_MS / 1000)}</span>
              <span>{scanStatusLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
