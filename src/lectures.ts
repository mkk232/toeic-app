import { db, type Lecture, type Quiz } from "./db";

export async function saveToc(lectures: Lecture[]): Promise<void> {
  await db.transaction("rw", db.lectures, async () => {
    await db.lectures.clear();
    await db.lectures.bulkPut(lectures);
  });
}

export async function markLectureDone(lectureNo: number, today: string): Promise<void> {
  await db.lectureDone.add({ lectureNo, date: today });
}

/** 안 푼 문제: new 먼저, 그다음 review, 각각 오래된 순 */
export async function nextQuizzes(limit: number): Promise<Quiz[]> {
  const open = (await db.quizzes.toArray()).filter((q) => !q.answeredAt);
  const rank = (q: Quiz) => (q.kind === "new" ? 0 : 1);
  return open
    .sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt) || (a.id ?? 0) - (b.id ?? 0))
    .slice(0, limit);
}

export async function answerQuiz(id: number, choice: number, today: string): Promise<boolean> {
  return db.transaction("rw", db.quizzes, db.wrongNotes, async () => {
    const q = await db.quizzes.get(id);
    if (!q) return false;
    const correct = q.answerIndex === choice;
    await db.quizzes.update(id, { answeredAt: today, correct, chosenIndex: choice });
    if (!correct) await db.wrongNotes.add({ source: "quiz", refId: id, date: today, resolved: false });
    return correct;
  });
}

export async function answerListening(id: number, choice: number, today: string): Promise<boolean> {
  return db.transaction("rw", db.listening, db.wrongNotes, async () => {
    const item = await db.listening.get(id);
    if (!item) return false;
    const correct = item.answerIndex === choice;
    await db.listening.update(id, { answeredAt: today, correct, chosenIndex: choice });
    if (!correct) await db.wrongNotes.add({ source: "listening", refId: id, date: today, resolved: false });
    return correct;
  });
}

export async function resolveWrongNote(id: number): Promise<void> {
  await db.wrongNotes.update(id, { resolved: true });
}
