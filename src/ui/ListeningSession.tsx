import { useEffect, useState } from "preact/hooks";
import { db, getSettings, type ListeningItem } from "../db";
import { todayStr } from "../date";
import { answerListening } from "../lectures";
import { speak, stopSpeaking } from "../speech";
import { choiceClass } from "./QuizSession";
import { requestTopUp } from "../prefetchSignal";

const LETTERS = ["A", "B", "C"];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 질문 → 쉼 → (A)(B)(C) 대답을 차례로 읽음 */
async function playItem(item: ListeningItem, rate: number) {
  const opts = { lang: item.accent, rate };
  await speak(item.question, opts);
  for (let i = 0; i < item.choices.length; i++) {
    await pause(600);
    await speak(`${LETTERS[i]}. ${item.choices[i]}`, opts);
  }
}

export function ListeningSession() {
  const [items, setItems] = useState<ListeningItem[] | null>(null);
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [score, setScore] = useState(0);

  useEffect(() => {
    (async () => {
      setRate((await getSettings()).speechRate);
      const open = (await db.listening.toArray()).filter((i) => !i.answeredAt).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      setItems(open.slice(0, 5));
    })();
    return () => stopSpeaking();
  }, []);

  if (!items) return <main class="screen"><p class="muted">불러오는 중…</p></main>;
  if (!items.length) {
    return (
      <main class="screen">
        <a class="back" href="#/">← 홈</a>
        <h1>듣기</h1>
        <div class="banner">문제 준비 중이에요. 인터넷이 되면 자동으로 받아요.</div>
      </main>
    );
  }

  const item = items[pos];
  if (!item) {
    return (
      <main class="screen">
        <h1>{items.length}문제 중 {score}개 맞힘</h1>
        <p class="muted">틀린 문제는 오답 노트에 모였어요.</p>
        <a class="btn" href="#/wrong" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>오답 노트</a>
        <a class="back" href="#/">← 홈</a>
      </main>
    );
  }

  async function play() {
    if (playing) return;
    setPlaying(true);
    try {
      await playItem(item, rate);
    } finally {
      setPlaying(false);
    }
  }

  async function pick(i: number) {
    if (chosen !== null) return;
    stopSpeaking();
    setChosen(i);
    if (await answerListening(item.id!, i, todayStr())) setScore((s) => s + 1);
  }

  function next() {
    setPos((p) => p + 1);
    setChosen(null);
    if (pos + 1 >= items!.length) requestTopUp();
  }

  return (
    <main class="screen">
      <div class="row" style={{ alignItems: "center" }}>
        <a class="back" href="#/">← 홈</a>
        <span class="muted small" style={{ textAlign: "right" }}>파트 2 · {pos + 1} / {items.length}</span>
      </div>
      <section class="card stack" style={{ alignItems: "stretch" }}>
        <p class="muted small" style={{ margin: 0 }}>질문 하나와 대답 3개를 들려줘요. 알맞은 대답을 고르세요.</p>
        <button class="primary" onClick={play} disabled={playing}>{playing ? "재생 중…" : chosen === null ? "▶ 듣기" : "▶ 다시 듣기"}</button>
      </section>
      <div class="row">
        {LETTERS.map((l, i) => (
          <button class={choiceClass(i, item.answerIndex, chosen)} onClick={() => pick(i)}>({l})</button>
        ))}
      </div>
      {chosen !== null && (
        <>
          <section class="card stack small">
            <strong>{chosen === item.answerIndex ? "정답!" : `정답은 (${LETTERS[item.answerIndex]})`}</strong>
            <div>
              <div>{item.question}</div>
              <div class="muted">{item.questionKo}</div>
            </div>
            {item.choices.map((c, i) => (
              <div>
                <div style={{ fontWeight: i === item.answerIndex ? 700 : 400 }}>({LETTERS[i]}) {c}</div>
                <div class="muted">{item.choicesKo[i]}</div>
              </div>
            ))}
          </section>
          <div class="spacer" />
          <button class="primary bottom" onClick={next}>다음</button>
        </>
      )}
    </main>
  );
}
