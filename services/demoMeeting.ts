import type { TranscriptLine, User } from '../types';

/**
 * Scripted demo meeting (Uzbek).
 *
 * This exists to show the whole pipeline without a microphone: the lines are
 * replayed on a timer, and everything downstream — live task detection, name
 * and role assignment, deadline resolution, the final analysis — runs for real
 * against the same API a live meeting uses.
 *
 * Remove this file and the `isDemoMeeting` check in LiveMeeting to drop it.
 */

/** A meeting whose title starts with "demo" replays the script instead of listening. */
export const isDemoMeeting = (title: string) => /^\s*demo\b/i.test(title);

export const DEMO_TEAM: Array<Pick<User, 'name' | 'email' | 'role'>> = [
  { name: 'Aziz Karimov', email: 'aziz@meettask.ai', role: 'Backend Engineer' },
  { name: 'Eldor Rahimov', email: 'eldor@meettask.ai', role: '3D Artist' },
  { name: 'Nodira Yusupova', email: 'nodira@meettask.ai', role: 'Product Designer' },
  { name: 'Malika Tosheva', email: 'malika@meettask.ai', role: 'Finance Analyst' },
];

const normalizeIdentity = (value: string) => value.trim().toLocaleLowerCase();

/**
 * Connect the scripted people to their real workspace records. Stable user IDs
 * still come from Firestore; demoMeeting.ts supplies the canonical demo roles.
 */
export function resolveDemoTeam(team: User[]): User[] {
  return DEMO_TEAM.flatMap((demoMember) => {
    const member = team.find(
      (candidate) => normalizeIdentity(candidate.email) === normalizeIdentity(demoMember.email)
        || normalizeIdentity(candidate.name) === normalizeIdentity(demoMember.name),
    );
    return member ? [{ ...member, role: demoMember.role }] : [];
  });
}

interface ScriptLine {
  speaker: string;
  text: string;
  /** Seconds to wait before this line appears. */
  delay: number;
  /** What this line is here to demonstrate (documentation only). */
  shows?: string;
}

/**
 * One coherent project: the first release of "Bozor 3D", a shopping app that
 * shows products as 3D models. Every line has a job — together they exercise
 * everything the assistant does, so the demo is a walkthrough of the product
 * rather than a random conversation.
 *
 * Roles in the seeded team:
 *   Nodira Yusupova — Product Designer   Aziz Karimov  — Backend Engineer
 *   Eldor Rahimov   — 3D Artist          Malika Tosheva — Finance Analyst
 */
const SCRIPT: ScriptLine[] = [
  {
    speaker: 'Nodira Yusupova',
    delay: 1,
    text: 'Assalomu alaykum. Bugun «Bozor 3D» ilovasining birinchi relizi bo‘yicha yig‘ilamiz. Har bir yo‘nalishni ko‘rib chiqamiz.',
    shows: 'Kirish — vazifa emas, kontekst',
  },
  {
    speaker: 'Nodira Yusupova',
    delay: 6,
    text: 'Aziz, siz dushanbagacha to‘lov tizimini API ga ulab, ishlaydigan holatda tayyorlab qo‘ying. Bu eng muhim ish, usiz reliz bo‘lmaydi.',
    shows: 'Ism aytilgan + hafta kuni muddati + yuqori muhimlik',
  },
  {
    speaker: 'Aziz Karimov',
    delay: 6,
    text: 'Xo‘p. Karta to‘lovi tayyor, faqat bank tomonidagi tekshiruv qoldi. Dushanbagacha ulguraman.',
    shows: 'Rozilik — yangi vazifa yaratmasligi kerak',
  },
  {
    speaker: 'Nodira Yusupova',
    delay: 6,
    text: 'Eldor akani o‘zi bilan gaplashib, eng ko‘p sotiladigan yigirmata mahsulotning 3D modelini olsam, ular katalogga qo‘shiladi.',
    shows: 'Hurmat qo‘shimchasi + ishni bajaruvchi aniqlanishi (koordinator emas)',
  },
  {
    speaker: 'Eldor Rahimov',
    delay: 6,
    text: 'Modellarni tayyorlayman, juma kunigacha yuboraman.',
    shows: 'Muddat qo‘shiladi, vazifa ikkilanmaydi',
  },
  {
    speaker: 'Malika Tosheva',
    delay: 6,
    text: 'Byudjet bo‘yicha aytishim kerak: 3D modellar uchun ajratilgan mablag‘ o‘ttiz foizga oshib ketdi.',
    shows: 'Muhim ma’lumot — vazifa emas, xulosaga tushadi',
  },
  {
    speaker: 'Nodira Yusupova',
    delay: 6,
    text: 'Unda kimdir keyingi chorak uchun byudjetni qayta hisoblab chiqishi kerak.',
    shows: 'Hech kim aytilmagan → kasbi bo‘yicha moliyachiga',
  },
  {
    speaker: 'Aziz Karimov',
    delay: 6,
    text: 'Yana bir muammo bor: mahsulot sahifasi sekin ochilyapti.',
    shows: 'Muammo bayoni — keyingi vazifaga zamin',
  },
  {
    speaker: 'Nodira Yusupova',
    delay: 6,
    text: 'Aziz va Eldor birgalikda mahsulot sahifasining tezligini tekshirib chiqishsin.',
    shows: 'Ikkita mas’ul bitta vazifada',
  },
  {
    speaker: 'Eldor Rahimov',
    delay: 6,
    text: 'Menimcha, 3D modellarning hajmi katta, shuning uchun sekin yuklanyapti.',
    shows: 'Muhokama — vazifa emas',
  },
  {
    speaker: 'Nodira Yusupova',
    delay: 6,
    text: 'Yana kimdir to‘lov sahifasining dizaynini yangilashi kerak, hozirgisi chalkash.',
    shows: 'Hech kim aytilmagan → kasbi bo‘yicha dizaynerga',
  },
  {
    speaker: 'Malika Tosheva',
    delay: 6,
    text: 'Narxlar masalasi ham ochiq qolyapti.',
    shows: 'O‘tish — keyingi vazifa uchun',
  },
  {
    speaker: 'Nodira Yusupova',
    delay: 6,
    text: 'Malika, ertaga narxlar ro‘yxatini tayyorlab bering.',
    shows: 'Nisbiy muddat — «ertaga» aniq sanaga aylanadi',
  },
  {
    speaker: 'Malika Tosheva',
    delay: 6,
    text: 'Xo‘p, ertaga tayyorlayman.',
    shows: 'Rozilik — dublikat bo‘lmasligi kerak',
  },
  {
    speaker: 'Nodira Yusupova',
    delay: 6,
    text: 'Reliz sanasini o‘n beshinchi oktabrga belgilaymiz degan qarorga keldik.',
    shows: 'Qaror — vazifalar ro‘yxatiga tushmasligi kerak',
  },
  {
    speaker: 'Eldor Rahimov',
    delay: 6,
    text: 'Aytgancha, kechagi o‘yinni ko‘rdingizmi? Juda qiziq bo‘ldi.',
    shows: 'Ishga aloqasiz gap — vazifa to‘qib chiqarilmasligi kerak',
  },
  {
    speaker: 'Nodira Yusupova',
    delay: 5,
    text: 'Rahmat, yig‘ilishni yakunlaymiz.',
    shows: 'Yakun',
  },
];

const formatOffset = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export interface DemoPlayer {
  stop: () => void;
}

/**
 * Replay the script, calling `onLines` with the transcript so far. Lines arrive
 * one at a time so the screen fills the way a real meeting does.
 */
export function playDemoMeeting(
  onLines: (lines: TranscriptLine[]) => void,
  onFinished?: () => void,
): DemoPlayer {
  const lines: TranscriptLine[] = [];
  const timers: number[] = [];
  let elapsed = 0;

  SCRIPT.forEach((entry, index) => {
    elapsed += entry.delay;
    const at = elapsed;
    timers.push(
      window.setTimeout(() => {
        const previous = lines.at(-1);
        // Same speaker keeps talking in one block, exactly like the real grouping.
        if (previous && previous.speaker === entry.speaker) {
          previous.text = `${previous.text} ${entry.text}`;
        } else {
          lines.push({
            id: `demo-${index}`,
            speaker: entry.speaker,
            text: entry.text,
            timestamp: formatOffset(at),
          });
        }
        onLines([...lines.map((line) => ({ ...line }))]);
        if (index === SCRIPT.length - 1) onFinished?.();
      }, at * 1000),
    );
  });

  return {
    stop: () => timers.forEach((timer) => window.clearTimeout(timer)),
  };
}
