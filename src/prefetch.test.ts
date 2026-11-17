import { db, saveSettings, type Quiz, type ListeningItem } from "./db";
import type { ClaudeLike } from "./claude/client";
import { topUp } from "./prefetch";

const T = "2026-11-17";

type Kind = "quiz" | "listening" | "examples";

/** 요청 내용을 보고 종류를 가려 가짜 답을 주는 Claude. 종류별 호출 수를 셈 */
function fakeClaude(opts: { failListening?: boolean; delay?: number } = {}) {
  const calls: Record<Kind, number> = { quiz: 0, listening: 0, examples: 0 };
  const quizCounts: number[] = [];
  const c: ClaudeLike = {
    beta: {
      messages: {
        parse: async (params: any) => {
          if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
          const system: string = params.system;
          const prompt = String(params.messages[0].content);
          if (system.includes("파트 2")) {
            calls.listening++;
            if (opts.failListening) throw Object.assign(new Error("x"), { status: 500 });
            const n = Number(/(\d+)개/.exec(prompt)![1]);
            return { stop_reason: "end_turn", parsed_output: { items: Array.from({ length: n }, () => ({ question: "q", questionKo: "", choices: ["a", "b", "c"], choicesKo: ["", "", ""], answerIndex: 0 })) } };
          }
          if (system.includes("예문")) {
            calls.examples++;
            const ids = prompt.split("\n").filter((l) => l.includes("\t")).map((l) => l.split("\t")[0]);
            return { stop_reason: "end_turn", parsed_output: { items: ids.map((id) => ({ id, easy: "e", easyKo: "", toeic: "t", toeicKo: "" })) } };
          }
          calls.quiz++;
          const n = Number(/문제를 (\d+)개/.exec(prompt)![1]);
          quizCounts.push(n);
          return { stop_reason: "end_turn", parsed_output: { questions: Array.from({ length: n }, () => ({ question: "q", choices: ["a", "b", "c", "d"], answerIndex: 0, explanationKo: "" })) } };
        },
      },
    },
  };
  return { c, calls, quizCounts };
}

const listenItem = (): ListeningItem => ({ question: "q", questionKo: "", choices: ["a", "b", "c"], choicesKo: ["", "", ""], answerIndex: 0, accent: "en-US", createdAt: T });
const openQuiz = (kind: Quiz["kind"], lectureNo = 1): Quiz => ({ lectureNo, kind, question: "q", choices: ["a", "b", "c", "d"], answerIndex: 0, explanationKo: "", createdAt: T });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

test("API 키가 없으면 Claude 를 안 부름", async () => {
  await db.lectureDone.add({ lectureNo: 1, date: T });
  const { c, calls } = fakeClaude();
  expect(await topUp(T, c)).toEqual({ quizzes: 0, listening: 0, examples: 0 });
  expect(calls).toEqual({ quiz: 0, listening: 0, examples: 0 });
});

describe("키 있음", () => {
  beforeEach(async () => {
    await saveSettings({ apiKey: "k" });
    await db.lectures.put({ no: 1, title: "품사" });
  });

  test("끝낸 강 1개, 퀴즈 0개 → new 5개 + review 5개", async () => {
    await db.lectureDone.add({ lectureNo: 1, date: T });
    const { c } = fakeClaude();
    const r = await topUp(T, c);
    expect(r.quizzes).toBe(10);
    const qs = await db.quizzes.toArray();
    expect(qs.filter((q) => q.kind === "new")).toHaveLength(5);
    expect(qs.filter((q) => q.kind === "review")).toHaveLength(5);
  });

  test("review 는 끝낸 강들에 돌아가며 20개까지 채움", async () => {
    for (let n = 1; n <= 5; n++) {
      await db.lectures.put({ no: n, title: `강${n}` });
      await db.lectureDone.add({ lectureNo: n, date: T });
      await db.quizzes.bulkAdd(Array.from({ length: 5 }, () => ({ ...openQuiz("new", n), answeredAt: T })));
    }
    await db.quizzes.bulkAdd(Array.from({ length: 12 }, () => openQuiz("review")));
    const { c, quizCounts } = fakeClaude();
    await topUp(T, c);
    const openReview = (await db.quizzes.toArray()).filter((q) => q.kind === "review" && !q.answeredAt);
    expect(openReview).toHaveLength(20);
    expect(Math.max(...quizCounts)).toBeLessThanOrEqual(5);
  });

  test("안 푼 듣기 2개 → 3개만 더 받음", async () => {
    await db.listening.bulkAdd([listenItem(), listenItem()]);
    const { c } = fakeClaude();
    const r = await topUp(T, c);
    expect(r.listening).toBe(3);
    expect(await db.listening.count()).toBe(5);
  });

  test("듣기가 실패해도 예문 단계는 계속, 오류 메시지 남김", async () => {
    await db.words.bulkPut([{ id: "1-0", day: 1, index: 0, word: "resume", meaning: "이력서" }]);
    const { c, calls } = fakeClaude({ failListening: true });
    const r = await topUp(T, c);
    expect(r.error).toBe("Claude 호출이 실패했어요.");
    expect(calls.examples).toBe(1);
    expect((await db.words.get("1-0"))?.examples?.easy).toBe("e");
  });

  test("오늘·내일 새 단어 예문을 한 번에", async () => {
    await saveSettings({ newPerDay: 2 });
    await db.words.bulkPut(Array.from({ length: 6 }, (_, i) => ({ id: `1-${i}`, day: 1, index: i, word: `w${i}`, meaning: "뜻" })));
    const { c, calls } = fakeClaude();
    const r = await topUp(T, c);
    expect(calls.examples).toBe(1);
    expect(r.examples).toBe(4);
    expect((await db.words.get("1-4"))?.examples).toBeUndefined();
  });

  test("동시에 두 번 불러도 한 번 분량만", async () => {
    await db.lectureDone.add({ lectureNo: 1, date: T });
    const { c, calls } = fakeClaude({ delay: 10 });
    await Promise.all([topUp(T, c), topUp(T, c)]);
    expect(calls.listening).toBe(1);
    expect((await db.quizzes.toArray()).filter((q) => q.kind === "new")).toHaveLength(5);
  });
});
