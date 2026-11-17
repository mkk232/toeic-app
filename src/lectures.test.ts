import { db, type Quiz, type ListeningItem } from "./db";
import { saveToc, markLectureDone, nextQuizzes, answerQuiz, answerListening, resolveWrongNote } from "./lectures";

const T = "2026-11-17";
const quiz = (over: Partial<Quiz> = {}): Quiz => ({
  lectureNo: 1, kind: "new", question: "q", choices: ["a", "b", "c", "d"], answerIndex: 2,
  explanationKo: "설명", createdAt: "2026-11-10", ...over,
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});

test("saveToc 두 번째가 첫 목차를 대체", async () => {
  await saveToc([{ no: 1, title: "a" }, { no: 2, title: "b" }, { no: 3, title: "c" }]);
  await saveToc([{ no: 1, title: "품사" }]);
  expect(await db.lectures.toArray()).toEqual([{ no: 1, title: "품사" }]);
});

test("markLectureDone 기록", async () => {
  await markLectureDone(3, T);
  expect(await db.lectureDone.toArray()).toMatchObject([{ lectureNo: 3, date: T }]);
});

test("오답이면 correct false + 오답 노트", async () => {
  const id = (await db.quizzes.add(quiz())) as number;
  expect(await answerQuiz(id, 0, T)).toBe(false);
  expect(await db.quizzes.get(id)).toMatchObject({ correct: false, answeredAt: T, chosenIndex: 0 });
  expect(await db.wrongNotes.toArray()).toMatchObject([{ source: "quiz", refId: id, date: T, resolved: false }]);
});

test("정답이면 오답 노트 안 늘어남", async () => {
  const id = (await db.quizzes.add(quiz())) as number;
  expect(await answerQuiz(id, 2, T)).toBe(true);
  expect(await db.wrongNotes.count()).toBe(0);
});

test("nextQuizzes: 안 푼 것만, new 먼저, 오래된 순", async () => {
  await db.quizzes.bulkAdd([
    quiz({ kind: "review", createdAt: "2026-11-01", question: "r-old" }),
    quiz({ kind: "new", createdAt: "2026-11-15", question: "n-new" }),
    quiz({ kind: "new", createdAt: "2026-11-02", question: "n-old" }),
    quiz({ kind: "new", createdAt: "2026-11-01", question: "done", answeredAt: T, correct: true }),
  ]);
  expect((await nextQuizzes(10)).map((q) => q.question)).toEqual(["n-old", "n-new", "r-old"]);
  expect(await nextQuizzes(1)).toHaveLength(1);
});

test("듣기 오답도 오답 노트", async () => {
  const item: ListeningItem = { question: "q", questionKo: "", choices: ["a", "b", "c"], choicesKo: ["", "", ""], answerIndex: 1, accent: "en-US", createdAt: T };
  const id = (await db.listening.add(item)) as number;
  expect(await answerListening(id, 0, T)).toBe(false);
  expect(await db.wrongNotes.toArray()).toMatchObject([{ source: "listening", refId: id }]);
});

test("resolveWrongNote", async () => {
  const id = (await db.wrongNotes.add({ source: "quiz", refId: 1, date: T, resolved: false })) as number;
  await resolveWrongNote(id);
  expect((await db.wrongNotes.get(id))?.resolved).toBe(true);
});
