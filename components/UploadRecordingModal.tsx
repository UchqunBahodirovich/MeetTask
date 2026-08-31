import React, { useEffect, useRef, useState } from 'react';
import { Check, FileAudio, Loader2, Upload, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Field, inputClass } from './ui/Field';
import { Meeting, MeetingAnalysis, Task } from '../types';
import { useTeam } from '../context/TeamContext';
import { useI18n } from '../i18n';
import { analyzeMeeting, transcribeRecording, type TranscribeStage } from '../services/meetingApi';
import { analysisToTasks } from '../services/analysis';

interface UploadRecordingModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (meeting: Meeting, tasks: Task[]) => void;
}

const STAGE_IDS: (TranscribeStage | 'done')[] = ['uploading', 'transcribing', 'analyzing'];

const ACCEPTED = 'audio/*,video/*,.mp3,.m4a,.wav,.ogg,.opus,.flac,.mp4,.mov,.webm,.mkv';
const MAX_BYTES = 200 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Fall back to a readable title when the person does not type one. */
const titleFromFile = (name: string) =>
  name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Uploaded recording';

const toLocalInputValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const UploadRecordingModal: React.FC<UploadRecordingModalProps> = ({ open, onClose, onComplete }) => {
  const { team } = useTeam();
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [languageHints, setLanguageHints] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [stage, setStage] = useState<TranscribeStage | 'done' | null>(null);
  const [percent, setPercent] = useState(0);
  const [analysisChunk, setAnalysisChunk] = useState<{ index: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = stage !== null && stage !== 'done';

  useEffect(() => {
    if (open) {
      setFile(null);
      setTitle('');
      setDate(toLocalInputValue(new Date()));
      setLanguageHints('');
      setParticipantIds(team.map((u) => u.id));
      setStage(null);
      setPercent(0);
      setAnalysisChunk(null);
      setError('');
    }
    return () => abortRef.current?.abort();
  }, [open]);

  const pickFile = (selected: File | undefined) => {
    if (!selected) return;
    if (selected.size > MAX_BYTES) {
      setError(t.upload.tooLarge(formatBytes(selected.size)));
      return;
    }
    setError('');
    setFile(selected);
    if (!title) setTitle(titleFromFile(selected.name));
    if (selected.lastModified) setDate(toLocalInputValue(new Date(selected.lastModified)));
  };

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(t.upload.chooseFirst);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setError('');
    setPercent(0);
    setAnalysisChunk(null);

    const participants = team.filter((u) => participantIds.includes(u.id));
    const meetingId = `upload-${Date.now()}`;
    const parsedDate = date ? new Date(date) : new Date();
    const hints = languageHints
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);

    try {
      const result = await transcribeRecording(file, {
        languageHints: hints,
        signal: controller.signal,
        onProgress: (progress) => {
          setStage(progress.stage);
          if (typeof progress.percent === 'number') setPercent(progress.percent);
        },
      });

      if (result.transcript.length === 0) {
        throw new Error(t.upload.noSpeech);
      }

      setStage('analyzing');
      const meetingShell: Meeting = {
        id: meetingId,
        title: title.trim() || titleFromFile(file.name),
        date: (Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate).toISOString(),
        duration: result.audioDurationMs
          ? `${Math.max(1, Math.round(result.audioDurationMs / 60_000))} min`
          : 'Unknown',
        participants,
        status: 'completed',
      };

      let analysis: MeetingAnalysis | null = null;
      try {
        analysis = await analyzeMeeting(meetingShell, result.transcript, {
          signal: controller.signal,
          onProgress: setAnalysisChunk,
        });
      } catch (analysisError) {
        // The transcript is still valuable even when the summariser fails.
        setError(
          t.upload.analysisFailed(
            analysisError instanceof Error ? analysisError.message : t.upload.failed,
          ),
        );
      }

      if (analysis?.partial) {
        setError(t.upload.partial(analysis.failedChunks ?? 0));
      }

      const tasks = analysis ? analysisToTasks(analysis, meetingShell, 'upload') : [];
      const meeting: Meeting = {
        ...meetingShell,
        transcript: result.transcript,
        summary: analysis?.summary || 'Transcript imported. No summary was generated.',
        keyPoints: analysis?.keyPoints || [],
        decisions: analysis?.decisions || [],
        tasks,
      };

      setStage('done');
      onComplete(meeting, tasks);
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStage(null);
        return;
      }
      setStage(null);
      setError(err instanceof Error ? err.message : t.upload.failed);
    } finally {
      abortRef.current = null;
    }
  };

  const currentStageIndex = STAGE_IDS.indexOf(stage as TranscribeStage);
  const stageLabel = (id: TranscribeStage | 'done') =>
    id === 'uploading' ? t.upload.stageUploading : id === 'transcribing' ? t.upload.stageTranscribing : t.upload.stageAnalyzing;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t.upload.title}
      description={t.upload.subtitle}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {busy ? t.common.cancel : t.common.close}
          </button>
          <button
            type="submit"
            form="upload-form"
            disabled={busy || !file}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? t.common.processing : t.upload.submit}
          </button>
        </>
      }
    >
      <form id="upload-form" onSubmit={handleSubmit} className="space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            pickFile(e.dataTransfer.files[0]);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
            isDragging ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-slate-50/60'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            aria-label={t.upload.fileLabel}
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileAudio className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              {!busy && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label={t.upload.removeFile}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">{t.upload.dropHere}</p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {t.upload.chooseFile}
              </button>
              <p className="text-xs text-slate-400 mt-2">{t.upload.fileHint}</p>
            </>
          )}
        </div>

        {busy && (
          <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            {STAGE_IDS.map((id, index) => {
              const done = currentStageIndex > index;
              const active = currentStageIndex === index;
              return (
                <div key={id} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      done ? 'bg-green-100 text-green-600' : active ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {done ? (
                      <Check className="w-3 h-3" />
                    ) : active ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-bold">{index + 1}</span>
                    )}
                  </span>
                  <span className={active ? 'text-slate-900 font-medium' : 'text-slate-500'}>{stageLabel(id)}</span>
                  {active && id === 'uploading' && (
                    <span className="ml-auto text-xs font-semibold text-blue-600">{percent}%</span>
                  )}
                  {active && id === 'analyzing' && analysisChunk && analysisChunk.total > 1 && (
                    <span className="ml-auto text-xs font-semibold text-blue-600">
                      {t.upload.partLabel(analysisChunk.index + 1, analysisChunk.total)}
                    </span>
                  )}
                </div>
              );
            })}
            {stage === 'uploading' && (
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-blue-600 transition-all duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
            {stage === 'transcribing' && (
              <p className="text-xs text-slate-400 pt-1">
                {t.upload.longHint}
              </p>
            )}
            {stage === 'analyzing' && analysisChunk && analysisChunk.total > 1 && (
              <>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-blue-600 transition-all duration-200"
                    style={{ width: `${Math.round((analysisChunk.index / analysisChunk.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 pt-1">
                  {t.upload.partsHint(analysisChunk.total)}
                </p>
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t.upload.meetingTitle} htmlFor="upload-title">
            <input
              id="upload-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.upload.meetingTitlePlaceholder}
              disabled={busy}
              className={inputClass}
            />
          </Field>
          <Field label={t.upload.recordedOn} htmlFor="upload-date">
            <input
              id="upload-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label={t.upload.languageHints}
          htmlFor="upload-languages"
          hint={t.upload.languageHintsHint}
        >
          <input
            id="upload-languages"
            value={languageHints}
            onChange={(e) => setLanguageHints(e.target.value)}
            placeholder={t.upload.languageHintsPlaceholder}
            disabled={busy}
            className={inputClass}
          />
        </Field>

        <Field label={t.upload.participants} hint={t.upload.participantsHint}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {team.map((user) => {
              const selected = participantIds.includes(user.id);
              return (
                <button
                  type="button"
                  key={user.id}
                  disabled={busy}
                  onClick={() =>
                    setParticipantIds((prev) =>
                      prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id],
                    )
                  }
                  aria-pressed={selected}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all disabled:opacity-60 ${
                    selected ? 'border-blue-500 bg-blue-50/70 text-slate-900' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <img src={user.avatar} alt="" className="w-6 h-6 rounded-full bg-slate-200 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">{user.name}</span>
                    {user.role && <span className="block text-[10px] text-slate-400 truncate">{user.role}</span>}
                  </span>
                  {selected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </Field>
      </form>
    </Modal>
  );
};
