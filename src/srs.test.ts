import { newCard, review } from "./srs";

const T = "2026-11-17";

test("새 카드 + 앎 → 내일, ef 2.6", () => {
  const c = review(newCard("1-0", T), "good", T);
  expect(c).toMatchObject({ reps: 1, interval: 1, ef: 2.6, due: "2026-11-18" });
});

test("앎 두 번 → 6일, 세 번 → round(6*2.7)=16일", () => {
  let c = review(newCard("1-0", T), "good", T);
  c = review(c, "good", T);
  expect(c.interval).toBe(6);
  expect(c.due).toBe("2026-11-23");
  c = review(c, "good", T);
  expect(c.interval).toBe(16);
  expect(c.reps).toBe(3);
});

test("새 카드 + 헷갈림 → ef 2.36, 내일", () => {
  const c = review(newCard("1-0", T), "hard", T);
  expect(c.ef).toBeCloseTo(2.36, 10);
  expect(c).toMatchObject({ interval: 1, reps: 1 });
});

test("새 카드 + 모름 → ef 1.96, reps 0, 내일", () => {
  const c = review(newCard("1-0", T), "again", T);
  expect(c.ef).toBeCloseTo(1.96, 10);
  expect(c).toMatchObject({ reps: 0, interval: 1, due: "2026-11-18" });
});

test("여러 번 맞힌 카드도 모름이면 처음부터", () => {
  let c = review(newCard("1-0", T), "good", T);
  c = review(c, "good", T);
  c = review(c, "again", T);
  expect(c).toMatchObject({ reps: 0, interval: 1 });
});

test("ef 는 1.3 아래로 안 내려감", () => {
  const c = review({ ...newCard("1-0", T), ef: 1.3 }, "again", T);
  expect(c.ef).toBe(1.3);
});

test("newCard 기본값", () => {
  expect(newCard("2-3", T)).toEqual({ wordId: "2-3", ef: 2.5, reps: 0, interval: 0, due: T, introducedOn: T });
});
