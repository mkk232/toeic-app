import { db } from "./db";
import { rowsToWords, upsertWords, pickSheet } from "./wordImport";

const HEADER = ["Day", "단어", "뜻", "외움", null, null];

test("행을 단어로 바꿈: id·순서·줄바꿈·메모", () => {
  const { words, skipped } = rowsToWords([
    HEADER,
    ["day1", " alpha ", "가", null, null],
    ["day1", "beta", "나\n(다)", null, "메모"],
    ["day2", "gamma", "라"],
  ]);
  expect(skipped).toBe(0);
  expect(words.map((w) => w.id)).toEqual(["1-0", "1-1", "2-0"]);
  expect(words[0]).toEqual({ id: "1-0", day: 1, index: 0, word: "alpha", meaning: "가" });
  expect(words[1].meaning).toBe("나\n(다)");
  expect(words[1].note).toBe("메모");
  expect(words[2]).toMatchObject({ day: 2, index: 0, word: "gamma" });
});

test("첫 줄이 Day/단어/뜻이 아니면 오류", () => {
  expect(() => rowsToWords([["Day", "word", "meaning"], ["day1", "a", "b"]])).toThrow(
    "엑셀 형식이 달라요. 첫 줄이 Day / 단어 / 뜻 이어야 해요.",
  );
});

test("단어 빈 줄·Day 를 못 읽는 줄은 건너뜀", () => {
  const { words, skipped } = rowsToWords([HEADER, ["day1", null, "가"], ["dayX", "a", "b"], ["day3", "c", "d"]]);
  expect(skipped).toBe(2);
  expect(words.map((w) => w.id)).toEqual(["3-0"]);
});

test("건너뛴 줄은 Day 안 순서에 안 들어감", () => {
  const { words } = rowsToWords([HEADER, ["day1", "a", "가"], ["day1", "", "x"], ["day1", "b", "나"]]);
  expect(words.map((w) => w.id)).toEqual(["1-0", "1-1"]);
});

test("Sheet1 이 있으면 그 시트, 없으면 첫 시트", () => {
  const a = [["a"]];
  const b = [["b"]];
  expect(pickSheet([{ sheet: "편집", data: a }, { sheet: "Sheet1", data: b }])).toBe(b);
  expect(pickSheet([{ sheet: "편집", data: a }])).toBe(a);
});

describe("DB 저장", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test("두 번 불러와도 중복 없음, 공부 기록 유지", async () => {
    const { words } = rowsToWords([HEADER, ["day1", "alpha", "가"], ["day1", "beta", "나"]]);
    expect(await upsertWords(words)).toEqual({ added: 2, updated: 0 });
    await db.cards.put({ wordId: "1-0", ef: 2.6, reps: 1, interval: 1, due: "2026-12-01", introducedOn: "2026-11-17" });
    expect(await upsertWords(words)).toEqual({ added: 0, updated: 2 });
    expect(await db.words.count()).toBe(2);
    expect((await db.cards.get("1-0"))?.due).toBe("2026-12-01");
  });

  test("철자가 바뀌면 예문 삭제, 같으면 예문 유지", async () => {
    const ex = { easy: "e", easyKo: "이", toeic: "t", toeicKo: "티" };
    await db.words.bulkPut([
      { id: "1-0", day: 1, index: 0, word: "alpha", meaning: "가", examples: ex },
      { id: "1-1", day: 1, index: 1, word: "beta", meaning: "나", examples: ex },
    ]);
    const { words } = rowsToWords([HEADER, ["day1", "alpha", "가(새 뜻)"], ["day1", "betta", "나"]]);
    await upsertWords(words);
    const w0 = await db.words.get("1-0");
    const w1 = await db.words.get("1-1");
    expect(w0?.meaning).toBe("가(새 뜻)");
    expect(w0?.examples).toEqual(ex);
    expect(w1?.word).toBe("betta");
    expect(w1?.examples).toBeUndefined();
  });
});
