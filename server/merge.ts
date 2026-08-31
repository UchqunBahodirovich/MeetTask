export interface AnalysisTask {
  title: string;
  description: string;
  assignee: string | null;
  suggestedAssignee: string | null;
  deadline: string | null;
  priority: string;
}

export interface AnalysisPart {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  tasks: AnalysisTask[];
}

/** Words that carry no identity for a task, so they must not drive similarity. */
const GENERIC_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'about', 'due', 'before', 'after',
  'please', 'need', 'needs', 'should', 'must', 'will', 'task', 'action', 'item', 'items',
  'send', 'sending', 'prepare', 'preparing', 'update', 'updating', 'review', 'reviewing',
  'book', 'booking', 'finalize', 'finalise', 'follow', 'followup', 'make', 'create', 'share',
  'yuborish', 'tayyorlash', 'qilish', 'kerak', 'uchun',
]);

export const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function significantWords(title: string): Set<string> {
  return new Set(
    normalizeKey(title)
      .split(' ')
      .filter((word) => word.length > 2 && !GENERIC_WORDS.has(word)),
  );
}

/**
 * Chunks are analysed independently, so the same action can come back worded
 * differently ("Send budget report" / "Budget report due Friday"). Compare the
 * distinctive words only: generic verbs would make unrelated tasks look alike.
 */
export function isSameTask(a: string, b: string): boolean {
  if (normalizeKey(a) === normalizeKey(b)) return true;
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let shared = 0;
  wordsA.forEach((word) => {
    if (wordsB.has(word)) shared += 1;
  });
  return shared / Math.min(wordsA.size, wordsB.size) >= 0.6;
}

function mergeTask(kept: AnalysisTask, incoming: AnalysisTask): AnalysisTask {
  return {
    // Prefer the more descriptive title.
    title: incoming.title.length > kept.title.length && kept.title.length < 12 ? incoming.title : kept.title,
    description: kept.description || incoming.description,
    assignee: kept.assignee ?? incoming.assignee,
    suggestedAssignee: (kept.assignee ?? incoming.assignee) ? null : kept.suggestedAssignee ?? incoming.suggestedAssignee,
    deadline: kept.deadline ?? incoming.deadline,
    priority:
      kept.priority === 'medium' && incoming.priority !== 'medium' ? incoming.priority : kept.priority,
  };
}

/** Fold per-chunk results into one analysis, dropping repeats across chunk boundaries. */
export function mergeAnalyses(parts: AnalysisPart[]): AnalysisPart {
  const keyPoints = new Map<string, string>();
  const decisions = new Map<string, string>();
  const tasks: AnalysisTask[] = [];

  for (const part of parts) {
    part.keyPoints.forEach((point) => keyPoints.set(normalizeKey(point), point));
    part.decisions.forEach((decision) => decisions.set(normalizeKey(decision), decision));

    for (const task of part.tasks) {
      const existingIndex = tasks.findIndex((kept) => isSameTask(kept.title, task.title));
      if (existingIndex === -1) tasks.push(task);
      else tasks[existingIndex] = mergeTask(tasks[existingIndex], task);
    }
  }

  return {
    summary: parts.map((part) => part.summary).filter(Boolean).join(' '),
    keyPoints: [...keyPoints.values()].slice(0, 20),
    decisions: [...decisions.values()].slice(0, 20),
    tasks: tasks.slice(0, 50),
  };
}

/**
 * Drop tasks that the caller already knows about. Used by live meetings, which
 * analyse only the newest transcript lines and append whatever is genuinely new.
 */
export function filterNewTasks(tasks: AnalysisTask[], knownTitles: string[]): AnalysisTask[] {
  if (knownTitles.length === 0) return tasks;
  return tasks.filter((task) => !knownTitles.some((known) => isSameTask(known, task.title)));
}
