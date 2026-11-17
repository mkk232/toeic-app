import { db, getSettings, type Card, type Word } from "./db";
import { newCard, review, type Grade } from "./srs";

/** 아직 시작 안 한 단어를 (day, index) 순으로 오늘 몫만큼 */
export function pickNewWords(words: Word[], introduced: Set<string>, introducedToday: number, newPerDay: number): Word[] {
  const room = Math.max(0, newPerDay - introducedToday);
  if (room === 0) return [];
  return words
    .filter((w) => !introduced.has(w.id))
    .sort((a, b) => a.day - b.day || a.index - b.index)
    .slice(0, room);
}

export async function getTodayPlan(today: string): Promise<{ dueCards: Card[]; newWords: Word[] }> {
  const [{ newPerDay }, cards, words] = await Promise.all([getSettings(), db.cards.toArray(), db.words.toArray()]);
  const introduced = new Set(cards.map((c) => c.wordId));
  const introducedToday = cards.filter((c) => c.introducedOn === today).length;
  const dueCards = cards
    .filter((c) => c.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  return { dueCards, newWords: pickNewWords(words, introduced, introducedToday, newPerDay) };
}

export async function gradeWord(wordId: string, grade: Grade, today: string): Promise<Card> {
  return db.transaction("rw", db.cards, async () => {
    const cur = (await db.cards.get(wordId)) ?? newCard(wordId, today);
    const next = review(cur, grade, today);
    await db.cards.put(next);
    return next;
  });
}
