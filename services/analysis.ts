import type { Meeting, MeetingAnalysis, Task, User } from '../types';

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Respectful forms that follow a name in Uzbek and must not be treated as part of it. */
const HONORIFICS = new Set([
  'aka', 'akasi', 'opa', 'opasi', 'aya', 'xola', 'amaki', 'tog\u2018a', 'toga',
  'ustoz', 'domla', 'janob', 'hurmatli', 'og\u2018a', 'oga', 'bek', 'xon',
]);

/** Uzbek case endings, longest first so "larning" is stripped before "ning". */
const CASE_SUFFIXES = [
  'larning', 'lardan', 'larga', 'larni', 'larda', 'lari', 'ning', 'niki', 'dagi',
  'gacha', 'kacha', 'qacha', 'dan', 'lar', 'ni', 'ga', 'ka', 'qa', 'da', 'ham',
];

/**
 * A name can arrive inflected ("Eldorga", "Azizni") or with an honorific
 * ("Eldor aka"). Return every plausible base form of a token; the raw token
 * comes first so a real name that merely ends in a suffix-like string
 * ("Olga") still matches itself.
 */
function tokenCandidates(token: string): string[] {
  const forms = [token];
  for (const suffix of CASE_SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
      forms.push(token.slice(0, -suffix.length));
    }
  }
  return forms;
}

function nameTokens(value: string): Set<string> {
  const tokens = new Set<string>();
  for (const word of normalize(value).split(' ')) {
    if (!word) continue;
    for (const form of tokenCandidates(word)) {
      if (form.length >= 3 && !HONORIFICS.has(form)) tokens.add(form);
    }
  }
  return tokens;
}

/**
 * Match the model's assignee string to a participant. The analyzer is asked for
 * exact participant names, but it may answer with just a first name or an
 * inflected form, so fall back to token matching and give up when ambiguous.
 */
export function findAssignee(assignee: string | null, participants: User[]): User | undefined {
  if (!assignee) return undefined;
  const needle = normalize(assignee);
  if (!needle || needle === 'null' || /^speaker\s*\d*$/.test(needle)) return undefined;

  const exact = participants.find((p) => normalize(p.name) === needle);
  if (exact) return exact;

  const candidates = nameTokens(assignee);
  if (candidates.size === 0) return undefined;

  const matches = participants.filter((p) =>
    normalize(p.name)
      .split(' ')
      .some((part) => part.length >= 3 && candidates.has(part)),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Keep a deadline only when it is a real calendar date; otherwise pass the wording through. */
function normalizeDeadline(deadline: string | null): string {
  if (!deadline) return 'Belgilanmagan';
  const trimmed = deadline.trim();
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return isoMatch[1];
  }
  return trimmed || 'Belgilanmagan';
}

/** Turn the model's extracted action items into Task records for a meeting. */
export function analysisToTasks(
  analysis: MeetingAnalysis,
  meeting: Pick<Meeting, 'id' | 'participants'>,
  idPrefix = 'ai',
): Task[] {
  return analysis.tasks.map((task, index) => {
    // Someone named in the meeting always wins; a role match is only a fallback.
    const stated = findAssignee(task.assignee, meeting.participants);
    const byRole = stated ? undefined : findAssignee(task.suggestedAssignee, meeting.participants);
    const assignee = stated ?? byRole;
    return {
      id: `${idPrefix}-${meeting.id}-${Date.now()}-${index}`,
      title: task.title,
      description: task.description,
      assigneeId: assignee?.id ?? '',
      deadline: normalizeDeadline(task.deadline),
      priority: task.priority,
      status: 'todo',
      meetingId: meeting.id,
      isAiGenerated: true,
      isApproved: false,
      ...(assignee ? { assigneeSource: stated ? ('stated' as const) : ('role' as const) } : {}),
    };
  });
}
