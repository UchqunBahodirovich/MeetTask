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

const roleTokens = (value: string) => new Set(
  normalize(value).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2),
);

const ROLE_FAMILIES: Array<{ roles: string[]; tasks: string[] }> = [
  { roles: ['designer', 'design', 'ux', 'ui'], tasks: ['design', 'dizayn', 'ux', 'ui', 'mockup', 'maket', 'prototype', 'prototip', 'interface', 'interfeys'] },
  { roles: ['product designer', 'product design', 'ux designer'], tasks: ['user flow', 'foydalanuvchi oqimi', 'journey', 'usability', 'qulaylik', 'confusing', 'chalkash', 'experience', 'tajriba', 'user problem', 'foydalanuvchi muammosi', 'requirement', 'talab'] },
  { roles: ['ui designer', 'interface designer', 'visual designer'], tasks: ['visual', 'vizual', 'layout', 'joylashuv', 'color', 'rang', 'typography', 'tipografiya', 'component', 'komponent', 'icon', 'ikonka', 'pixel', 'style', 'stil'] },
  { roles: ['finance', 'financial', 'accountant', 'moliya', 'buxgalter'], tasks: ['finance', 'financial', 'budget', 'byudjet', 'moliya', 'buxgalter', 'price', 'pricing', 'narx', 'cost', 'xarajat', 'invoice', 'hisob faktura'] },
  { roles: ['backend', 'server', 'api'], tasks: ['backend', 'server', 'api', 'database', 'ma lumotlar bazasi', 'integration', 'integratsiya', 'endpoint', 'webhook'] },
  { roles: ['frontend', 'web'], tasks: ['frontend', 'react', 'css', 'html', 'web sahifa', 'browser', 'brauzer'] },
  { roles: ['3d', 'modeler', 'modellovchi'], tasks: ['3d', 'model', 'render', 'texture', 'tekstura', 'animation', 'animatsiya'] },
  { roles: ['qa', 'tester', 'test', 'quality', 'sifat'], tasks: ['qa', 'test', 'testing', 'sinov', 'bug', 'xato', 'quality', 'sifat'] },
  { roles: ['marketing', 'marketer', 'smm', 'marketolog'], tasks: ['marketing', 'campaign', 'kampaniya', 'reklama', 'smm', 'seo', 'content', 'kontent'] },
  { roles: ['sales', 'seller', 'savdo'], tasks: ['sales', 'sale', 'savdo', 'customer', 'mijoz', 'lead', 'deal', 'sotuv'] },
  { roles: ['legal', 'lawyer', 'yurist', 'huquq'], tasks: ['legal', 'contract', 'shartnoma', 'law', 'qonun', 'yuridik', 'huquq'] },
  { roles: ['devops', 'sre', 'infrastructure', 'infratuzilma'], tasks: ['deploy', 'deployment', 'devops', 'infrastructure', 'infratuzilma', 'ci', 'cd', 'monitoring'] },
  { roles: ['data', 'analyst', 'analytics', 'tahlilchi'], tasks: ['data', 'analytics', 'tahlil', 'report', 'hisobot', 'metric', 'metrika', 'dashboard'] },
];

const normalizedWords = (value: string) => normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const termCount = (value: string, terms: string[]) => {
  const words = normalizedWords(value);
  const sentence = ` ${words.join(' ')} `;
  return terms.filter((rawTerm) => {
    const term = normalize(rawTerm);
    if (term.includes(' ')) return sentence.includes(` ${term} `);
    return words.some((word) => word === term || (term.length >= 4 && word.startsWith(term)));
  }).length;
};

/** Infer one unambiguous, exact team role from task vocabulary. */
export function inferAssigneesByTask(taskText: string, participants: User[]): { role: string; members: User[] } | null {
  const roles = [...new Set(participants.map((participant) => participant.role).filter(Boolean) as string[])];
  const taskWords = new Set(normalizedWords(taskText).filter((word) => word.length > 2));
  let best: { role: string; score: number } | null = null;
  let tied = false;

  for (const role of roles) {
    const directMatches = [...roleTokens(role)].filter((word) => taskWords.has(word)).length;
    let score = directMatches * 3;
    for (const family of ROLE_FAMILIES) {
      if (termCount(role, family.roles) > 0) score += termCount(taskText, family.tasks) * 10;
    }
    if (!best || score > best.score) {
      best = { role, score };
      tied = false;
    } else if (score > 0 && score === best.score) {
      tied = true;
    }
  }

  if (!best || best.score === 0 || tied) return null;
  return { role: best.role, members: participants.filter((participant) => participant.role === best.role) };
}

/** Return everyone with the requested role; tolerate a uniquely matching role phrase. */
export function findAssigneesByRole(role: string | null, participants: User[]): User[] {
  if (!role) return [];
  const exact = participants.filter((participant) => participant.role && normalize(participant.role) === normalize(role));
  if (exact.length) return exact;

  const wanted = roleTokens(role);
  if (!wanted.size) return [];
  const matchingRoles = [...new Set(participants.map((participant) => participant.role).filter(Boolean) as string[])]
    .filter((participantRole) => {
      const available = roleTokens(participantRole);
      return [...wanted].every((token) => available.has(token)) || [...available].every((token) => wanted.has(token));
    });
  return matchingRoles.length === 1
    ? participants.filter((participant) => participant.role === matchingRoles[0])
    : [];
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
    const participantIds = new Set(meeting.participants.map((participant) => participant.id));
    const statedIds = [...new Set(task.assigneeIds.filter((id) => participantIds.has(id)))];
    const explicitRoleMembers = statedIds.length ? [] : findAssigneesByRole(task.suggestedRole, meeting.participants);
    const inferredRole = statedIds.length || explicitRoleMembers.length
      ? null
      : inferAssigneesByTask(`${task.title} ${task.description}`, meeting.participants);
    const roleMembers = explicitRoleMembers.length ? explicitRoleMembers : inferredRole?.members ?? [];
    const assigneeIds = statedIds.length ? statedIds : roleMembers.map((member) => member.id);
    const assignedByRole = task.assignmentBasis === 'role' || (!statedIds.length && roleMembers.length > 0);
    const assignmentRole = explicitRoleMembers.length ? task.suggestedRole : inferredRole?.role;
    return {
      id: `${idPrefix}-${meeting.id}-${Date.now()}-${index}`,
      title: task.title,
      description: task.description,
      assigneeId: assigneeIds[0] ?? '',
      assigneeIds,
      deadline: normalizeDeadline(task.deadline),
      priority: task.priority,
      status: 'todo',
      meetingId: meeting.id,
      isAiGenerated: true,
      isApproved: false,
      ...(assigneeIds.length ? { assigneeSource: assignedByRole ? ('role' as const) : ('stated' as const) } : {}),
      ...(assignedByRole && assignmentRole ? { assignmentRole } : {}),
    };
  });
}
