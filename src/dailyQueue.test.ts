import { db, type Word, type Card } from "./db";
import { pickNewWords, getTodayPlan, gradeWord } from "./dailyQueue";

const T = "2026-11-17";

function words(): Word[] {
  const out: Word[] = [];
  // 일부러 섞인 순서로 만든다 (정렬을 확인하려고)
  for (let i = 19; i >= 0; i--) out.push({ id: `2-${i}`, day: 2, index: i, word: `b${i}`, meaning: "뜻" });
  for (let i = 29; i >= 0; i--) out.push({ id: `1-${i}`, day: 1, index: i, word: `a${i}`, meaning: "뜻" });
  return out;
}

test("카드 없음, 하루 20개 → day1 0~19", () => {
  const got = pickNewWords(words(), new Set(), 0, 20).map((w) => w.id);
  expect(got).toEqual(Array.from({ length: 20 }, (_, i) => `1-${i}`));
});

test("오늘 이미 5개 시작 → 15개", () => {
  expect(pickNewWords(words(), new Set(), 5, 20)).toHaveLength(15);
});

test("day1 이 전부 시작됨 → day2 부터", () => {
  const introduced = new Set(Array.from({ length: 30 }, (_, i) => `1-${i}`));
  const got = pickNewWords(words(), introduced, 0, 20).map((w) => w.id);
  expect(got[0]).toBe("2-0");
  expect(got).toHaveLength(20);
});

test("하루 몫을 넘겨 시작했으면 0개", () => {
  expect(pickNewWords(words(), new Set(), 25, 20)).toHaveLength(0);
});

describe("DB 사용", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test("getTodayPlan: 어제·오늘 복습만, 어제 먼저", async () => {
    await db.words.bulkPut(words());
    const base: Omit<Card, "wordId" | "due"> = { ef: 2.5, reps: 1, interval: 1, introducedOn: "2026-11-10" };
    await db.cards.bulkPut([
      { ...base, wordId: "1-2", due: "2026-11-18" },
      { ...base, wordId: "1-1", due: T },
      { ...base, wordId: "1-0", due: "2026-11-16" },
    ]);
    const plan = await getTodayPlan(T);
    expect(plan.dueCards.map((c) => c.wordId)).toEqual(["1-0", "1-1"]);
    expect(plan.newWords[0].id).toBe("1-3");
    expect(plan.newWords).toHaveLength(20);
  });

  test("gradeWord: 카드가 없으면 만들고 오늘 시작으로 셈", async () => {
    await db.words.bulkPut(words());
    const c = await gradeWord("1-0", "good", T);
    expect(c).toMatchObject({ wordId: "1-0", introducedOn: T, reps: 1, due: "2026-11-18" });
    const plan = await getTodayPlan(T);
    expect(plan.newWords).toHaveLength(19);
  });
});
