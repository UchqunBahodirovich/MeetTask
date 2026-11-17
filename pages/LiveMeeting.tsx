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
import { ApiError } from '../services/api';
import { tokensToLines } from '../services/transcript';
import { analysisToTasks } from '../services/analysis';
import { taskAssigneeIds } from '../services/taskAssignees';
import { MixedAudioSource } from '../services/audioSource';
import { isDemoMeeting, playDemoMeeting, resolveDemoTeam } from '../services/demoMeeting';
import { useI18n } from '../i18n';
import { useTeam } from '../context/TeamContext';
import { useTheme } from '../hooks/useTheme';
import { AiDiscoveryField } from '../components/AiDiscoveryField';

interface LiveMeetingResult {
  analysisMode: 'tasks' | 'highlights';
  transcript: TranscriptLine[];
  analysis: MeetingAnalysis | null;
  tasks: Task[];
  /**
   * Set when the session ended before live detection had read the whole
   * transcript. The rest is analysed on the summary page, so ending the
   * meeting never waits for a fresh full analysis.
   */
  pending?: { meeting: Meeting; knownTasks: string[] };
}

interface LiveMeetingProps {
  meeting: Meeting;
  onEnd: (result: LiveMeetingResult) => void;
}

type ConnectionState = 'connecting' | 'listening' | 'paused' | 'error';

/** How often live detection looks for new speech to analyse. */
const LIVE_SCAN_INTERVAL_MS = 10_000;
/**
 * Minimum new speech before spending a model call. Lowered to roughly one
 * sentence so a 10s tick actually fires — with a larger threshold the interval
 * would be pointless, because the scan would still wait for enough text.
 */
const LIVE_SCAN_MIN_CHARS = 120;
/** How long to stop scanning after the server reports a rate limit. */
const LIVE_SCAN_BACKOFF_MS = 120_000;

export const LiveMeeting: React.FC<LiveMeetingProps> = ({ meeting, onEnd }) => {
  const { theme } = useTheme();
  const [isMuted, setIsMuted] = useState(false);
  const { t, language } = useI18n();
  const { team, memberById } = useTeam();
  const isDemo = isDemoMeeting(meeting.title);
  const assignmentMeeting = useMemo(() => {
    const freshTeamById = new Map(team.map((member) => [member.id, member]));
    const meetingParticipants = meeting.participants.map((participant) => freshTeamById.get(participant.id) ?? participant);
    const demoParticipants = isDemo ? resolveDemoTeam(team) : [];
    return {
      ...meeting,
      // Real meetings send the selected participants with their latest roles.
      // Demo meetings use every scripted member found in the workspace.
      participants: demoParticipants.length ? demoParticipants : meetingParticipants,
    };
  }, [isDemo, meeting, team]);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [provisionalText, setProvisionalText] = useState('');
  const [detectedTasks, setDetectedTasks] = useState<Task[]>([]);
  const [analysisMode, setAnalysisMode] = useState<'tasks' | 'highlights'>(meeting.analysisMode ?? 'tasks');
  const [highlights, setHighlights] = useState<MeetingAnalysis | null>(null);
  const [time, setTime] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [scanError, setScanError] = useState('');
  const [systemAudioOn, setSystemAudioOn] = useState(false);
  const [isTogglingSystemAudio, setIsTogglingSystemAudio] = useState(false);
  const recordingRef = useRef<Recording | null>(null);
  const audioSourceRef = useRef<MixedAudioSource | null>(null);
  const finalTokensRef = useRef<RealtimeToken[]>([]);
  const finalTokenKeysRef = useRef(new Set<string>());
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const detectedTasksRef = useRef<Task[]>([]);
  /** Latest live analysis: its summary, key points and decisions are kept on end. */
  const lastAnalysisRef = useRef<MeetingAnalysis | null>(null);
  const scannedLineCountRef = useRef(0);
  const scannedCharCountRef = useRef(0);
  const isScanningRef = useRef(false);
  const scanAbortRef = useRef<AbortController | null>(null);
  const isEndingRef = useRef(false);
  /** Set after a 429 so scanning waits instead of retrying every tick. */
  const scanPausedUntilRef = useRef(0);
  const resultCount = analysisMode === 'tasks'
    ? detectedTasks.length
    : (highlights?.keyPoints.length ?? 0) + (highlights?.decisions.length ?? 0);
  const hasAnalysisContent = resultCount > 0 || (analysisMode === 'highlights' && Boolean(highlights?.summary?.trim()));

  useEffect(() => {
    const timer = window.setInterval(() => setTime((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, provisionalText]);

  // Demo meetings replay a script instead of opening a microphone. Everything
  // downstream — live scanning, assignment, the final analysis — is unchanged.
  useEffect(() => {
    if (!isDemo) return;
    setConnectionState('listening');
    const player = playDemoMeeting((lines) => {
      transcriptRef.current = lines;
      setTranscript(lines);
    });
    return () => player.stop();
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) return;
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
        terms: team.map((participant) => participant.name),
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
  }, [meeting.id, meeting.title, team, t]);

  /**
   * Live detection: every tick, analyse only the transcript lines added since the
   * last scan and append whatever is new. Sending the whole transcript each time
   * would re-run the full (chunked) analysis and repeat tasks already on screen.
   */
  useEffect(() => {
    const runScan = async () => {
      if (isScanningRef.current || isEndingRef.current) return;
      if (Date.now() < scanPausedUntilRef.current) return;

      const lines = transcriptRef.current;
      const totalChars = lines.reduce((total, line) => total + line.text.length, 0);
      // A single speaker can keep extending one line. Track text growth, not
      // just new lines, and retain context for decisions and commitments.
      const freshLines = lines;
      const freshChars = totalChars - scannedCharCountRef.current;
      // Wait until there is enough new speech to be worth a model call.
      if (freshLines.length === 0 || freshChars < LIVE_SCAN_MIN_CHARS) return;

      isScanningRef.current = true;
      setIsScanning(true);
      const controller = new AbortController();
      scanAbortRef.current = controller;
      const lineCountAtStart = lines.length;

      try {
        const analysis = await analyzeMeeting(assignmentMeeting, freshLines, {
          mode: analysisMode,
          language,
          signal: controller.signal,
          knownTasks: detectedTasksRef.current.map((task) => task.title),
        });
        if (controller.signal.aborted) return;
        setScanError('');
        lastAnalysisRef.current = analysis;
        if (analysisMode === 'highlights') setHighlights(analysis);
        const newTasks = analysisMode === 'tasks' ? analysisToTasks(analysis, assignmentMeeting, 'live') : [];
        scannedLineCountRef.current = lineCountAtStart;
        scannedCharCountRef.current = totalChars;
        if (newTasks.length > 0) {
          detectedTasksRef.current = [...newTasks, ...detectedTasksRef.current];
          setDetectedTasks(detectedTasksRef.current);
        }
        setLastScanAt(Date.now());
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // Back off hard when the server says we are over the limit, so the
          // budget is left for the final analysis instead of being burned on
          // retries every tick.
          const rateLimited = error instanceof ApiError && error.status === 429;
          if (rateLimited) scanPausedUntilRef.current = Date.now() + LIVE_SCAN_BACKOFF_MS;
          // A failed scan is not worth interrupting the meeting for; the final
          // analysis re-reads the whole transcript anyway.
          else console.warn('Live task scan failed:', error);
          setScanError(error instanceof Error ? error.message : t.live.endFailed);
          if (!rateLimited) scanPausedUntilRef.current = Date.now() + 30_000;
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
  }, [assignmentMeeting, language, analysisMode]);

  const changeAnalysisMode = (mode: 'tasks' | 'highlights') => {
    if (mode === analysisMode) return;
    scanAbortRef.current?.abort();
    scannedCharCountRef.current = 0;
    scannedLineCountRef.current = 0;
    lastAnalysisRef.current = null;
    setAnalysisMode(mode);
    setScanError('');
    scanPausedUntilRef.current = 0;
  };

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
    if (isDemo || !source || connectionState === 'error') return;
    const nextMuted = !isMuted;
    source.setMicEnabled(!nextMuted);
    setIsMuted(nextMuted);
    setConnectionState(nextMuted && !systemAudioOn ? 'paused' : 'listening');
  };

  const handleToggleSystemAudio = async () => {
    const source = audioSourceRef.current;
    if (isDemo || !source || isTogglingSystemAudio) return;
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
      // Keep what live detection already found instead of re-analysing the
      // whole meeting. Any speech it has not read yet is finished afterwards
      // on the summary page.
      const finalTranscript = transcriptRef.current;
      const totalChars = finalTranscript.reduce((total, line) => total + line.text.length, 0);
      const tasks = analysisMode === 'tasks' ? detectedTasksRef.current : [];
      const unfinished = finalTranscript.length > 0 && totalChars > scannedCharCountRef.current;
      onEnd({
        analysisMode,
        transcript: finalTranscript,
        analysis: lastAnalysisRef.current,
        tasks,
        ...(unfinished
          ? { pending: { meeting: assignmentMeeting, knownTasks: tasks.map((task) => task.title) } }
          : {}),
      });
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
              ? t.live.analyzing
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
            <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${connectionState === 'listening' ? 'bg-green-500' : 'bg-amber-500'}`} /><span className="text-[10px] font-bold text-slate-500 uppercase">{statusLabel}</span></div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {transcript.map((line) => (
              <div key={line.id} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">{line.speaker[0]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1"><span className="text-sm font-bold text-slate-900">{line.speaker}</span><span className="text-[10px] font-medium text-slate-500">{line.timestamp}</span></div>
                  <p className="text-slate-600 leading-relaxed text-sm">{line.text}</p>
                </div>
              </div>
            ))}
            {provisionalText && <p className="pl-12 text-sm italic text-slate-500">{provisionalText}</p>}
            <div ref={transcriptEndRef} />
            {transcript.length === 0 && !provisionalText && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4"><Mic className="w-12 h-12 opacity-20 animate-pulse" /><p className="font-medium">{t.live.waitingForSpeech}</p></div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 min-h-0">
          <div className="meeting-insights flex-1 min-h-0 flex flex-col rounded-3xl overflow-hidden" data-panel-theme={theme}>
            <div className="insights-switch flex gap-1 m-4 p-1 shrink-0" role="group" aria-label={t.live.analysisMode}>
              {(['tasks', 'highlights'] as const).map((mode) => (
                <button key={mode} type="button" disabled={isEnding} aria-pressed={analysisMode === mode}
                  onClick={() => changeAnalysisMode(mode)}
                  className="insights-mode flex flex-1 min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold disabled:opacity-50">
                  <span className="truncate">{mode === 'tasks' ? t.live.aiDetectedTasks : t.live.highlightsMode}</span>
                  {analysisMode === mode && resultCount > 0 && <span className="shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">{resultCount}</span>}
                </button>
              ))}
            </div>
            {analysisMode === 'highlights' && <p className="px-5 pb-4 text-[11px] leading-relaxed text-slate-400">{t.live.highlightsHint}</p>}
            {scanError && <p role="alert" className="mx-4 mb-3 rounded-lg bg-amber-950 p-3 text-sm text-amber-200">{scanError}</p>}
            <div className="insights-scroll relative flex-1 min-h-0 overflow-y-auto p-5 space-y-4" data-empty={!hasAnalysisContent} tabIndex={0} role="region" aria-label={analysisMode === 'tasks' ? t.live.aiDetectedTasks : t.live.highlightsMode}>
              <AiDiscoveryField mode={analysisMode} background={hasAnalysisContent}
                visible={!hasAnalysisContent || isScanning}
                running={!scanError && (isScanning || connectionState === 'listening')} />
              {isScanning && <span className="sr-only" role="status">{t.live.scanning}</span>}
              {analysisMode === 'highlights' && highlights && (
                <div className="space-y-5 text-sm text-slate-200">
                  {highlights.summary && <details className="insights-summary rounded-2xl p-4">
                    <summary className="cursor-pointer text-xs font-semibold text-blue-200">{t.summary.aiSummary}</summary>
                    <p className="mt-3 text-[13px] leading-6 text-slate-300">{highlights.summary}</p>
                  </details>}
                  <div className="space-y-3">
                    {highlights.keyPoints.map((point, index) => <article key={index} className="insights-note flex gap-3 rounded-2xl p-4">
                      <span aria-hidden="true" className="pt-0.5 text-[10px] font-semibold tabular-nums text-blue-400">{String(index + 1).padStart(2, '0')}</span>
                      <p className="min-w-0 text-[13px] leading-6 text-slate-200">{point}</p>
                    </article>)}
                  </div>
                  {highlights.decisions.length > 0 && <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />{t.live.highlightDecisions}</h4>
                    {highlights.decisions.map((point, index) => <p key={index} className="insights-decision rounded-2xl p-4 text-[13px] leading-6">{point}</p>)}
                  </div>}
                </div>
              )}
              {analysisMode === 'tasks' && detectedTasks.map((task) => (
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
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {taskAssigneeIds(task)
                      .map((id) => memberById(id)?.name)
                      .filter(Boolean)
                      .join(', ') || t.common.unassigned}
                    {task.assigneeSource === 'role' && <span className="text-amber-400/80"> · {t.taskCard.byRole}</span>}
                  </p>
                </div>
              ))}
              {!hasAnalysisContent && !isScanning && (
                <p className="sr-only" aria-live="polite">{t.live.listening}</p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-white/5 text-[10px] font-medium text-slate-400 flex flex-wrap gap-2 items-center justify-between shrink-0">
              <span className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${scanError ? 'bg-amber-400' : 'bg-emerald-400'}`} />{t.live.scanEvery(LIVE_SCAN_INTERVAL_MS / 1000)}</span>
              {!isScanning && <span>{scanStatusLabel}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
