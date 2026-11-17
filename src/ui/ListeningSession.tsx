import { useEffect, useMemo, useState } from "preact/hooks";
import { db, getSettings, type ListeningItem } from "../db";
import { todayStr } from "../date";
import { answerListening } from "../lectures";
import { createPlayer } from "../speech";
import { choiceClass } from "./QuizSession";
import { requestTopUp } from "../prefetchSignal";
import { PREFETCHED_EVENT } from "../prefetch";
import { useEmptyReason } from "./useEmptyReason";

const LETTERS = ["A", "B", "C"];

/** 질문 → 쉼 → (A)(B)(C) 대답 순서로 읽을 문장들 */
export const listeningParts = (item: ListeningItem) => [item.question, ...item.choices.map((c, i) => `${LETTERS[i]}. ${c}`)];

export function ListeningSession() {
  const player = useMemo(() => createPlayer(), []);
  const emptyReason = useEmptyReason();
  const [items, setItems] = useState<ListeningItem[] | null>(null);
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const loadOpen = async () =>
      (await db.listening.toArray()).filter((i) => !i.answeredAt).sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).slice(0, 5);
    (async () => {
      setRate((await getSettings()).speechRate);
      setItems(await loadOpen());
    })();
    // 비어 있을 때 새 문제가 도착하면 바로 보여 줌
    const onArrive = () => loadOpen().then((b) => setItems((prev) => (prev && prev.length ? prev : b)));
    window.addEventListener(PREFETCHED_EVENT, onArrive);
    return () => {
      window.removeEventListener(PREFETCHED_EVENT, onArrive);
      player.stop();
    };
  }, []);

  if (!items) return <main class="screen"><p class="muted">불러오는 중…</p></main>;
  if (!items.length) {
    return (
      <main class="screen">
        <a class="back" href="#/">← 홈</a>
        <h1>듣기</h1>
        <div class="banner">{emptyReason}</div>
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
    if (playing) {
      player.stop();
      return setPlaying(false);
    }
    setPlaying(true);
    try {
      await player.play(listeningParts(item), { lang: item.accent, rate });
    } finally {
      setPlaying(false);
    }
  }

  async function pick(i: number) {
    if (chosen !== null) return;
    player.stop();
    setChosen(i);
    if (await answerListening(item.id!, i, todayStr())) setScore((s) => s + 1);
  }

  function next() {
    player.stop();
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
        <button class="primary" onClick={play}>{playing ? "■ 멈춤" : chosen === null ? "▶ 듣기" : "▶ 다시 듣기"}</button>
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
