import { todayStr, addDays } from "./date";

test("현지 자정 직후도 현지 날짜로", () => {
  expect(todayStr(new Date(2026, 10, 18, 0, 30))).toBe("2026-11-18");
});

test("현지 밤 늦게도 현지 날짜로", () => {
  expect(todayStr(new Date(2026, 10, 17, 23, 59))).toBe("2026-11-17");
});

test("월이 넘어가는 날짜 더하기", () => {
  expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
});

test("해가 넘어가는 날짜 더하기", () => {
  expect(addDays("2026-12-31", 6)).toBe("2027-01-06");
});
