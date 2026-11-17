import { db, getSettings, saveSettings } from "./db";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

test("빈 DB 기본 설정", async () => {
  expect(await getSettings()).toEqual({ apiKey: "", newPerDay: 20, speechRate: 1 });
});

test("일부만 저장해도 나머지는 그대로", async () => {
  await saveSettings({ newPerDay: 40 });
  const s = await getSettings();
  expect(s.newPerDay).toBe(40);
  expect(s.apiKey).toBe("");
  expect(s.speechRate).toBe(1);
});

test("키 저장 뒤 다른 값 저장해도 키 유지", async () => {
  await saveSettings({ apiKey: "k-1" });
  await saveSettings({ speechRate: 0.8 });
  expect(await getSettings()).toEqual({ apiKey: "k-1", newPerDay: 20, speechRate: 0.8 });
});
