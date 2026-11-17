import { db, getSettings, saveSettings, type Settings } from "./db";

const TABLES = ["words", "cards", "lectures", "lectureDone", "quizzes", "listening", "wrongNotes"] as const;
const NOT_BACKUP = "이 앱의 백업 파일이 아니에요.";

/** 모든 공부 기록을 JSON 으로. API 키는 넣지 않음 */
export async function exportBackup(): Promise<Blob> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await db[t].toArray();
  const { apiKey: _omit, ...settings } = await getSettings();
  const data = { version: 1, exportedAt: new Date().toISOString(), settings, tables };
  return new Blob([JSON.stringify(data)], { type: "application/json" });
}

/** 백업으로 통째로 바꿈. 지금 넣어 둔 API 키는 그대로 */
export async function importBackup(file: File): Promise<void> {
  let data: { version?: number; settings?: Partial<Settings>; tables?: Record<string, unknown[]> };
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error(NOT_BACKUP);
  }
  if (data?.version !== 1 || typeof data.tables !== "object") throw new Error(NOT_BACKUP);
  const { apiKey } = await getSettings();
  await db.transaction("rw", TABLES.map((t) => db[t]), async () => {
    for (const t of TABLES) {
      await db[t].clear();
      const rows = data.tables![t];
      if (Array.isArray(rows) && rows.length) await (db[t] as any).bulkAdd(rows);
    }
  });
  const { apiKey: _ignored, ...rest } = data.settings ?? {};
  await saveSettings({ ...rest, apiKey });
}

export function backupFileName(today: string) {
  return `toeic-backup-${today}.json`;
}
