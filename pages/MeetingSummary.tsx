import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Download,
  Share2,
  Sparkles,
  ArrowLeft,
  MessageSquare,
  Search,
  X,
  Check,
  Plus,
  RefreshCw,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Meeting, MeetingAnalysis, Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { reanalyzeMeeting } from '../services/api';
import { useI18n } from '../i18n';
import { Avatar } from '../components/ui/Avatar';
import { useTeam } from '../context/TeamContext';
import { needsOwnerClarification } from '../services/taskAssignees';

interface MeetingSummaryProps {
  meeting: Meeting;
  /** Live tasks from the app store, so approvals and edits here match the board. */
  tasks: Task[];
  onBack: () => void;
  onApproveTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onAddTask: () => void;
  /** Replaces the meeting's AI results and its AI-generated tasks. */
  onReanalyzed: (analysis: MeetingAnalysis, tasks: Task[]) => void;
  /** The rest of a just-ended live session is still being analysed (or failed to be). */
  finishingAnalysis?: 'running' | 'failed';
  /** Tasks that would be removed with the meeting, for the warning. */
  taskCount: number;
  /** Omitted when the signed-in role may not delete meetings. */
  onDelete?: () => Promise<void> | void;
}

const buildMarkdown = (meeting: Meeting, tasks: Task[]): string => {
  const lines: string[] = [
    `# ${meeting.title}`,
    '',
    `- Date: ${new Date(meeting.date).toLocaleString()}`,
    `- Duration: ${meeting.duration}`,
    `- Participants: ${meeting.participants.map((p) => p.name).join(', ') || '—'}`,
    '',
    '## Summary',
    meeting.summary || 'No summary is available.',
  ];

  if (meeting.keyPoints?.length) {
    lines.push('', '## Key points', ...meeting.keyPoints.map((p) => `- ${p}`));
  }
  if (meeting.decisions?.length) {
    lines.push('', '## Decisions', ...meeting.decisions.map((d) => `- ${d}`));
  }
  if (tasks.length) {
    lines.push(
      '',
      '## Action items',
      ...tasks.map(
        (t) => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title} (${t.priority}, due ${t.deadline})`,
      ),
    );
  }
  if (meeting.transcript?.length) {
    lines.push(
      '',
      '## Transcript',
      ...meeting.transcript.map((l) => `**${l.speaker}** [${l.timestamp}]: ${l.text}`),
    );
  }
  return lines.join('\n');
};

export const MeetingSummary: React.FC<MeetingSummaryProps> = ({
  meeting,
  tasks,
  onBack,
  onApproveTask,
  onEditTask,
  onAddTask,
  onReanalyzed,
  finishingAnalysis,
  taskCount,
  onDelete,
}) => {
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const { t, language } = useI18n();
  const { team } = useTeam();
  const [searchOpen, setSearchOpen] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [confirmReanalyze, setConfirmReanalyze] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalyzeChunk, setReanalyzeChunk] = useState<{ index: number; total: number } | null>(null);
  const [reanalyzeError, setReanalyzeError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const aiTasks = tasks.filter((task) => task.isAiGenerated);
  const unresolvedTasks = aiTasks.filter(needsOwnerClarification);
  const manualTasks = tasks.filter((task) => !task.isAiGenerated);

  const transcript = meeting.transcript ?? [];
  const filteredTranscript = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return transcript;
    return transcript.filter(
      (line) => line.text.toLowerCase().includes(q) || line.speaker.toLowerCase().includes(q),
    );
  }, [transcript, transcriptQuery]);

  const aiTaskCount = aiTasks.length;
  const manualTaskCount = tasks.length - aiTaskCount;

  /**
   * The server re-runs the analysis and swaps this meeting's AI tasks in one
   * call, so the database and the screen cannot drift apart.
   */
  const handleReanalyze = async () => {
    setConfirmReanalyze(false);
    setReanalyzeError('');
    setIsReanalyzing(true);
    setReanalyzeChunk(null);
    try {
      const result = await reanalyzeMeeting(meeting.id);
      onReanalyzed(result.analysis, result.tasks);
    } catch (error) {
      setReanalyzeError(error instanceof Error ? error.message : t.summary.reanalyzeFailed);
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([buildMarkdown(meeting, tasks)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${meeting.title.replace(/[^\w\d]+/g, '-').toLowerCase()}-summary.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#meeting-${meeting.id}`;
    const text = `${meeting.title} — ${meeting.summary || 'Meeting summary'}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: meeting.title, text, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      setShareState('copied');
    } catch {
      setShareState('failed');
    } finally {
      window.setTimeout(() => setShareState('idle'), 2500);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-up pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.summary.back}
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          {shareState !== 'idle' && (
            <span
              className={`text-xs font-semibold ${shareState === 'copied' ? 'text-green-600' : 'text-red-600'}`}
              role="status"
            >
              {shareState === 'copied' ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {t.summary.linkCopied}
                </span>
              ) : (
                t.summary.shareFailed
              )}
            </span>
          )}
          <button
            type="button"
            onClick={() => setConfirmReanalyze(true)}
            disabled={isReanalyzing || finishingAnalysis === 'running' || transcript.length === 0}
            title={transcript.length === 0 ? t.summary.noTranscriptTitle : t.summary.reanalyzeTitle}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isReanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isReanalyzing
              ? reanalyzeChunk && reanalyzeChunk.total > 1
                ? t.summary.reanalyzingPart(reanalyzeChunk.index + 1, reanalyzeChunk.total)
                : t.summary.reanalyzing
              : t.summary.reanalyze}
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting || isReanalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t.summary.deleteMeeting}
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Download className="w-4 h-4" />
            {t.summary.export}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Share2 className="w-4 h-4" />
            {t.summary.share}
          </button>
        </div>
      </div>

      {finishingAnalysis === 'running' && (
        <p className="flex items-center gap-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3" role="status">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {t.summary.finishingAnalysis}
        </p>
      )}
      {finishingAnalysis === 'failed' && (
        <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3" role="status">
          {t.summary.finishingAnalysisFailed}
        </p>
      )}

      {reanalyzeError && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {reanalyzeError}
        </p>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase tracking-wider">
                  {t.summary.completed}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {t.summary.recordedOn(new Date(meeting.date).toLocaleDateString())}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{meeting.title}</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t.summary.duration}</p>
                <p className="text-lg font-bold text-slate-900">{meeting.duration}</p>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t.summary.participants}</p>
                <p className="text-lg font-bold text-slate-900">{meeting.participants.length}</p>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t.summary.tasks}</p>
                <p className="text-lg font-bold text-slate-900">{tasks.length}</p>
              </div>
            </div>
          </div>
        </div>

        {unresolvedTasks.length > 0 && (
          <section aria-labelledby="owner-clarification-title" className="m-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 id="owner-clarification-title" className="font-bold text-amber-950">
              {t.summary.ownerClarificationTitle} ({unresolvedTasks.length})
            </h2>
            <p className="mt-2 text-sm text-amber-900" role="status">{t.summary.ownerClarificationQuestion}</p>
            <ul className="mt-4 space-y-3">
              {unresolvedTasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{task.title}</p>
                    {task.description && <p className="mt-1 text-sm text-slate-600">{task.description}</p>}
                  </div>
                  <button type="button" onClick={() => onEditTask(task)} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
                    {t.summary.chooseOwner}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 p-8 space-y-10 lg:border-r border-slate-100">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">{meeting.analysisMode === 'highlights' ? t.live.highlightsMode : t.summary.aiSummary}</h2>
              </div>
              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                <p className="text-slate-700 leading-relaxed">{meeting.summary || t.summary.noSummary}</p>
                {(meeting.keyPoints?.length || 0) > 0 && (
                  <ul className="mt-6 space-y-3">
                    {meeting.keyPoints?.map((point, index) => (
                      <li key={`${point}-${index}`} className="flex items-start gap-3 text-sm text-slate-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {(meeting.decisions?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-4 text-xl font-bold text-slate-900">{t.live.highlightDecisions}</h2>
                <ul className="space-y-3 text-sm text-slate-700">
                  {meeting.decisions?.map((decision, index) => <li key={index} className="rounded-xl bg-slate-50 p-4">{decision}</li>)}
                </ul>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-500" />
                  <h2 className="text-xl font-bold text-slate-900">{t.summary.fullTranscript}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen((open) => {
                      if (open) setTranscriptQuery('');
                      return !open;
                    });
                  }}
                  aria-expanded={searchOpen}
                  className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 shrink-0"
                >
                  {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                  {searchOpen ? t.common.close : t.summary.searchTranscript}
                </button>
              </div>

              {searchOpen && (
                <div className="mb-4">
                  <input
                    autoFocus
                    value={transcriptQuery}
                    onChange={(e) => setTranscriptQuery(e.target.value)}
                    placeholder={t.summary.searchPlaceholder}
                    aria-label={t.summary.searchTranscriptLabel}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {transcriptQuery.trim()
                      ? t.summary.linesMatch(filteredTranscript.length, transcript.length)
                      : t.summary.lineCount(transcript.length)}
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {filteredTranscript.map((line) => (
                  <div key={line.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">
                      {line.speaker[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900">{line.speaker}</span>
                        <span className="text-[10px] font-medium text-slate-500">{line.timestamp}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-sm">{line.text}</p>
                    </div>
                  </div>
                ))}
                {filteredTranscript.length === 0 && (
                  <p className="text-sm text-slate-500 py-6 text-center bg-slate-50 rounded-xl">
                    {transcript.length === 0 ? t.summary.noTranscript : t.summary.noLineMatches}
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="p-8 bg-slate-50/30 space-y-10">
            <section>
              <div className="flex items-center justify-between mb-6 gap-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-slate-900" />
                  <h2 className="text-xl font-bold text-slate-900">{t.summary.actionItems}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">
                    {tasks.length}
                  </span>
                  <button
                    type="button"
                    onClick={onAddTask}
                    aria-label={t.summary.addActionItem}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {aiTasks.length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      {t.summary.aiGeneratedGroup}
                    </div>
                    {aiTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onApprove={() => onApproveTask(task.id)}
                        onEdit={() => onEditTask(task)}
                      />
                    ))}
                  </>
                )}

                {manualTasks.length > 0 && (
                  <>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-8 mb-2">
                      {t.summary.manualGroup}
                    </div>
                    {manualTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onEdit={() => onEditTask(task)} />
                    ))}
                  </>
                )}

                {tasks.length === 0 && (
                  <button
                    type="button"
                    onClick={onAddTask}
                    className="w-full py-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-500 text-sm font-medium transition-colors"
                  >
                    {t.summary.noActionItems}
                  </button>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-widest">{t.summary.participants}</h2>
              <div className="space-y-3">
                {meeting.participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={p.name} src={p.avatar} className="w-8 h-8" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-700 truncate">{p.name}</span>
                        {p.role && <span className="block text-xs text-slate-500 truncate">{p.role}</span>}
                      </span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t.summary.deleteMeetingTitle}
        message={t.summary.deleteMeetingMessage(taskCount)}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          setIsDeleting(true);
          try {
            await onDelete?.();
          } catch (error) {
            setReanalyzeError(error instanceof Error ? error.message : t.summary.deleteMeetingFailed);
          } finally {
            setIsDeleting(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirmReanalyze}
        title={t.summary.confirmReanalyzeTitle}
        message={t.summary.confirmReanalyze(aiTaskCount, manualTaskCount)}
        confirmLabel={t.summary.reanalyze}
        onCancel={() => setConfirmReanalyze(false)}
        onConfirm={handleReanalyze}
      />
    </div>
  );
};
