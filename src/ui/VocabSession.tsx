import { useEffect, useState } from "preact/hooks";
import { db, getSettings, type Word } from "../db";
import { todayStr } from "../date";
import { getTodayPlan, gradeWord } from "../dailyQueue";
import type { Grade } from "../srs";
import { speak } from "../speech";
import { makeClient } from "../claude/client";
import { generateExamples } from "../claude/generate";

type Item = { word: Word; retry: boolean };

/** 예문이 없으면 이 단어 하나만 바로 만들어 저장 (키 없거나 실패하면 조용히 넘어감) */
async function fillExamples(word: Word): Promise<Word | null> {
  const { apiKey } = await getSettings();
  if (!apiKey) return null;
  try {
    const ex = await generateExamples(await makeClient(apiKey), [word]);
    if (!ex[word.id]) return null;
    await db.words.update(word.id, { examples: ex[word.id] });
    return { ...word, examples: ex[word.id] };
  } catch {
    return null;
  }
}

export function VocabSession() {
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [noWords, setNoWords] = useState(false);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    (async () => {
      const today = todayStr();
      const [plan, total, s] = await Promise.all([getTodayPlan(today), db.words.count(), getSettings()]);
      setRate(s.speechRate);
      if (!total) return setNoWords(true);
      const dueWords = (await db.words.bulkGet(plan.dueCards.map((c) => c.wordId))).filter((w): w is Word => !!w);
      setQueue([...dueWords, ...plan.newWords].map((word) => ({ word, retry: false })));
    })();
  }, []);

  const cur = queue?.[pos];

  useEffect(() => {
    if (!cur) return;
    speak(cur.word.word, { lang: "en-US", rate }).catch(() => {});
    if (!cur.word.examples) {
      fillExamples(cur.word).then((w) => {
        if (w) setQueue((q) => q && q.map((it) => (it.word.id === w.id ? { ...it, word: w } : it)));
      });
    }
  }, [cur?.word.id, pos]);

  async function grade(g: Grade) {
    if (!cur || busy) return;
    setBusy(true);
    await gradeWord(cur.word.id, g, todayStr());
    setQueue((q) => (q && g === "again" && !cur.retry ? [...q, { word: cur.word, retry: true }] : q));
    setPos((p) => p + 1);
    setFlipped(false);
    setBusy(false);
  }

  if (noWords) {
    return (
      <main class="screen">
        <a class="back" href="#/">← 홈</a>
        <h1>단어</h1>
        <div class="banner warn">설정에서 단어 엑셀을 불러와 주세요.</div>
        <a class="btn" href="#/settings" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>설정으로</a>
      </main>
    );
  }
  if (!queue) return <main class="screen"><p class="muted">불러오는 중…</p></main>;

  if (!cur) {
    return (
      <main class="screen">
        <h1>오늘 단어 끝!</h1>
        <p class="muted">내일 또 만나요. 복습할 때가 된 단어는 그날 다시 나와요.</p>
        <a class="btn" href="#/" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>홈으로</a>
      </main>
    );
  }

  const w = cur.word;
  return (
    <main class="screen">
      <div class="row" style={{ alignItems: "center" }}>
        <a class="back" href="#/">← 홈</a>
        <span class="muted small" style={{ textAlign: "right" }}>{pos + 1} / {queue.length}</span>
      </div>

      <section class="card stack" style={{ minHeight: "320px", justifyContent: "center" }}>
        <div class="big">{w.word}</div>
        <button aria-label="발음 듣기" onClick={() => speak(w.word, { lang: "en-US", rate })}>🔊 발음</button>
        {flipped ? (
          <div class="stack">
            <div class="pre" style={{ fontSize: "20px", textAlign: "center" }}>{w.meaning}</div>
            {w.note && <div class="muted small pre" style={{ textAlign: "center" }}>{w.note}</div>}
            {w.examples ? (
              <div class="stack small">
                <div>
                  <div>{w.examples.easy}</div>
                  <div class="muted">{w.examples.easyKo}</div>
                </div>
                <div>
                  <div>{w.examples.toeic}</div>
                  <div class="muted">{w.examples.toeicKo}</div>
                </div>
              </div>
            ) : (
              <div class="muted small" style={{ textAlign: "center" }}>예문 준비 중</div>
            )}
          </div>
        ) : (
          <button class="primary" onClick={() => setFlipped(true)}>뜻 보기</button>
        )}
      </section>

      <div class="spacer" />
      {flipped && (
        <div class="row bottom">
          <button class="bad" disabled={busy} onClick={() => grade("again")}>모름</button>
          <button class="warn" disabled={busy} onClick={() => grade("hard")}>헷갈림</button>
          <button class="good" disabled={busy} onClick={() => grade("good")}>앎</button>
        </div>
      )}
    </main>
  );
}
