import { db, getSettings, saveSettings } from "./db";
import { exportBackup, importBackup } from "./backup";

const asFile = async (b: Blob) => new File([await b.text()], "b.json", { type: "application/json" });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

test("백업에는 API 키가 없고, 불러오면 데이터는 돌아오고 키는 지금 키 유지", async () => {
  await db.words.put({ id: "1-0", day: 1, index: 0, word: "resume", meaning: "이력서" });
  await db.cards.put({ wordId: "1-0", ef: 2.6, reps: 1, interval: 1, due: "2026-11-18", introducedOn: "2026-11-17" });
  await db.wrongNotes.add({ source: "quiz", refId: 1, date: "2026-11-17", resolved: false });
  await saveSettings({ apiKey: "sk-ant-secret-1", newPerDay: 30 });

  const blob = await exportBackup();
  const text = await blob.text();
  expect(text).not.toContain("sk-ant-secret-1");
  expect(JSON.parse(text).version).toBe(1);

  await db.delete();
  await db.open();
  await saveSettings({ apiKey: "sk-ant-new-2" });
  await importBackup(await asFile(blob));

  expect(await db.words.get("1-0")).toMatchObject({ word: "resume" });
  expect((await db.cards.get("1-0"))?.due).toBe("2026-11-18");
  expect(await db.wrongNotes.count()).toBe(1);
  const s = await getSettings();
  expect(s.apiKey).toBe("sk-ant-new-2");
  expect(s.newPerDay).toBe(30);
});

test("불러오면 기존 데이터는 백업 내용으로 바뀜", async () => {
  const blob = await exportBackup();
  await db.words.put({ id: "9-9", day: 9, index: 9, word: "extra", meaning: "" });
  await importBackup(await asFile(blob));
  expect(await db.words.count()).toBe(0);
});

test("버전이 다르면 오류", async () => {
  const f = new File([JSON.stringify({ version: 2, tables: {} })], "x.json");
  await expect(importBackup(f)).rejects.toThrow("이 앱의 백업 파일이 아니에요.");
});

test("JSON 이 아니면 같은 오류", async () => {
  await expect(importBackup(new File(["hello"], "x.txt"))).rejects.toThrow("이 앱의 백업 파일이 아니에요.");
});
