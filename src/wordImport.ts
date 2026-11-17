import { db, type Word } from "./db";

const FORMAT_ERROR = "엑셀 형식이 달라요. 첫 줄이 Day / 단어 / 뜻 이어야 해요.";

const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v)).trim();

/** 엑셀 행 → 단어. 첫 줄은 Day / 단어 / 뜻 / (외움) / (메모) */
export function rowsToWords(rows: unknown[][]): { words: Word[]; skipped: number } {
  const header = rows[0] ?? [];
  if (text(header[1]) !== "단어" || text(header[2]) !== "뜻") throw new Error(FORMAT_ERROR);

  const words: Word[] = [];
  const nextIndex = new Map<number, number>();
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const m = /^day\s*(\d+)$/i.exec(text(row[0]));
    const word = text(row[1]);
    if (!m || !word) {
      // 맨 끝 완전히 빈 줄은 건너뛴 수에 세지 않음
      if (row.some((c) => text(c) !== "")) skipped++;
      continue;
    }
    const day = Number(m[1]);
    const index = nextIndex.get(day) ?? 0;
    nextIndex.set(day, index + 1);
    const w: Word = { id: `${day}-${index}`, day, index, word, meaning: text(row[2]) };
    const note = text(row[4]);
    if (note) w.note = note;
    words.push(w);
  }
  return { words, skipped };
}

export function pickSheet<T>(sheets: { sheet: string; data: T }[]): T {
  return (sheets.find((s) => s.sheet === "Sheet1") ?? sheets[0]).data;
}

/** 같은 id 는 단어·뜻·메모만 갱신. 복습 카드는 건드리지 않음 */
export async function upsertWords(words: Word[]): Promise<{ added: number; updated: number }> {
  return db.transaction("rw", db.words, async () => {
    const existing = new Map((await db.words.bulkGet(words.map((w) => w.id))).filter(Boolean).map((w) => [w!.id, w!]));
    let added = 0;
    let updated = 0;
    const out = words.map((w) => {
      const old = existing.get(w.id);
      if (!old) {
        added++;
        return w;
      }
      updated++;
      const merged: Word = { ...w };
      if (old.word === w.word && old.examples) merged.examples = old.examples;
      return merged;
    });
    await db.words.bulkPut(out);
    return { added, updated };
  });
}

export async function importWordsFromFile(file: File): Promise<{ added: number; updated: number; skipped: number }> {
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const sheets = await readXlsxFile(file);
  if (!sheets.length) throw new Error(FORMAT_ERROR);
  const { words, skipped } = rowsToWords(pickSheet(sheets) as unknown[][]);
  if (!words.length) throw new Error("엑셀에서 단어를 하나도 못 찾았어요.");
  const r = await upsertWords(words);
  return { ...r, skipped };
}
