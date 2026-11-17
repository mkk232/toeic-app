import Dexie, { type EntityTable } from "dexie";

export interface Examples { easy: string; easyKo: string; toeic: string; toeicKo: string }
/** id = `${day}-${index}`, index 는 그 Day 안 순서(0부터) */
export interface Word { id: string; day: number; index: number; word: string; meaning: string; note?: string; examples?: Examples }
export interface Card { wordId: string; ef: number; reps: number; interval: number; due: string; introducedOn: string }
export interface Lecture { no: number; title: string }
export interface LectureDone { id?: number; lectureNo: number; date: string }
export interface Quiz {
  id?: number; lectureNo: number; kind: "new" | "review"; question: string; choices: string[];
  answerIndex: number; explanationKo: string; createdAt: string; answeredAt?: string; correct?: boolean;
}
export interface ListeningItem {
  id?: number; question: string; questionKo: string; choices: string[]; choicesKo: string[];
  answerIndex: number; accent: "en-US" | "en-GB" | "en-AU"; createdAt: string; answeredAt?: string; correct?: boolean;
}
export interface WrongNote { id?: number; source: "quiz" | "listening"; refId: number; date: string; resolved: boolean }
export interface Settings { apiKey: string; newPerDay: number; speechRate: number }
interface KV { key: string; value: unknown }

export class AppDB extends Dexie {
  words!: EntityTable<Word, "id">;
  cards!: EntityTable<Card, "wordId">;
  lectures!: EntityTable<Lecture, "no">;
  lectureDone!: EntityTable<LectureDone, "id">;
  quizzes!: EntityTable<Quiz, "id">;
  listening!: EntityTable<ListeningItem, "id">;
  wrongNotes!: EntityTable<WrongNote, "id">;
  kv!: EntityTable<KV, "key">;

  constructor() {
    super("toeic-app");
    this.version(1).stores({
      words: "id, day",
      cards: "wordId, due, introducedOn",
      lectures: "no",
      lectureDone: "++id, lectureNo, date",
      quizzes: "++id, lectureNo, kind, answeredAt",
      listening: "++id, answeredAt",
      wrongNotes: "++id, source, resolved",
      kv: "key",
    });
  }
}

export const db = new AppDB();

const DEFAULTS: Settings = { apiKey: "", newPerDay: 20, speechRate: 1 };

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get("settings");
  return { ...DEFAULTS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(p: Partial<Settings>): Promise<void> {
  await db.transaction("rw", db.kv, async () => {
    const cur = await getSettings();
    await db.kv.put({ key: "settings", value: { ...cur, ...p } });
  });
}
