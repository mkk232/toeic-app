import { db, getSettings, type Word } from "./db";
import { todayStr } from "./date";
import { getTodayPlan, pickNewWords } from "./dailyQueue";
import { makeClient, toClaudeError, type ClaudeLike } from "./claude/client";
import { generateExamples, generateLectureQuiz, generateListening } from "./claude/generate";
import { TOPUP_EVENT } from "./prefetchSignal";

export const TARGET = { reviewQuizzes: 20, listening: 5 } as const;
export const PREFETCHED_EVENT = "toeic:prefetched";

type Result = { quizzes: number; listening: number; examples: number; error?: string };

let running: Promise<Result> | null = null;
let again = false;

/**
 * 인터넷이 될 때 모자란 문제·예문을 채움. 동시에 두 번 돌지 않음.
 * 돌고 있는 중에 다시 부르면(예: 방금 강을 끝냄) 지금 것이 끝난 뒤 한 번 더 돈다.
 * onStep: 단계 하나가 끝날 때마다 불림(화면을 빨리 갱신하려고).
 */
export function topUp(today: string, client?: ClaudeLike, onStep?: () => void): Promise<Result> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let r: Result;
    do {
      again = false;
      r = await run(today, client, onStep);
    } while (again);
    return r;
  })().finally(() => (running = null));
  return running;
}

async function run(today: string, client?: ClaudeLike, onStep?: () => void): Promise<Result> {
  const settings = await getSettings();
  const result: Result = { quizzes: 0, listening: 0, examples: 0 };
  if (!settings.apiKey) return result;
  const c = client ?? (await makeClient(settings.apiKey));

  const step = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      result.error ??= toClaudeError(err).message;
    }
    onStep?.();
  };

  const titles = new Map((await db.lectures.toArray()).map((l) => [l.no, l.title]));
  const lectureOf = (no: number) => ({ no, title: titles.get(no) ?? `${no}강` });
  const doneNos = [...new Set((await db.lectureDone.toArray()).map((d) => d.lectureNo))];

  // 1) 끝냈는데 새 문제가 없는 강 → 5문제
  const withNew = new Set((await db.quizzes.toArray()).filter((q) => q.kind === "new").map((q) => q.lectureNo));
  for (const no of doneNos.filter((n) => !withNew.has(n))) {
    await step(async () => {
      const qs = await generateLectureQuiz(c, lectureOf(no), 5, "new");
      await db.quizzes.bulkAdd(qs);
      result.quizzes += qs.length;
    });
  }

  // 2) 안 푼 복습 문제를 20개까지, 복습 문제가 적은 강부터 한 강당 최대 5개
  const all = await db.quizzes.toArray();
  let need = TARGET.reviewQuizzes - all.filter((q) => q.kind === "review" && !q.answeredAt).length;
  const reviewCount = (no: number) => all.filter((q) => q.kind === "review" && q.lectureNo === no).length;
  for (const no of [...doneNos].sort((a, b) => reviewCount(a) - reviewCount(b))) {
    if (need <= 0) break;
    const n = Math.min(5, need);
    await step(async () => {
      const qs = await generateLectureQuiz(c, lectureOf(no), n, "review");
      await db.quizzes.bulkAdd(qs);
      result.quizzes += qs.length;
      need -= qs.length;
    });
  }

  // 3) 안 푼 듣기를 5개까지
  const openListening = (await db.listening.toArray()).filter((i) => !i.answeredAt).length;
  if (openListening < TARGET.listening) {
    await step(async () => {
      const items = await generateListening(c, TARGET.listening - openListening);
      await db.listening.bulkAdd(items);
      result.listening += items.length;
    });
  }

  // 4) 오늘·내일 새 단어 중 예문 없는 것 → 한 번에
  await step(async () => {
    const { newWords } = await getTodayPlan(today);
    const [cards, words] = await Promise.all([db.cards.toArray(), db.words.toArray()]);
    const taken = new Set([...cards.map((x) => x.wordId), ...newWords.map((w) => w.id)]);
    const tomorrow = pickNewWords(words, taken, 0, settings.newPerDay);
    const missing: Word[] = [...newWords, ...tomorrow].filter((w) => !w.examples);
    if (!missing.length) return;
    const ex = await generateExamples(c, missing);
    await db.transaction("rw", db.words, async () => {
      for (const [id, e] of Object.entries(ex)) await db.words.update(id, { examples: e });
    });
    result.examples += Object.keys(ex).length;
  });

  return result;
}

export async function getLastPrefetch(): Promise<{ at: string; error?: string } | undefined> {
  return (await db.kv.get("prefetch"))?.value as { at: string; error?: string } | undefined;
}

const announce = () => window.dispatchEvent(new Event(PREFETCHED_EVENT));

async function runAndRecord() {
  const r = await topUp(todayStr(), undefined, announce);
  await db.kv.put({ key: "prefetch", value: { at: new Date().toISOString(), error: r.error } });
  announce();
}

/** 앱 시작 때 1번, 인터넷이 다시 될 때, 앱으로 돌아올 때, 화면이 신호를 보낼 때 */
export function startAutoPrefetch(): void {
  const go = () => {
    if (navigator.onLine !== false) runAndRecord().catch(() => {});
  };
  window.addEventListener("online", go);
  window.addEventListener(TOPUP_EVENT, go);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") go();
  });
  go();
}
