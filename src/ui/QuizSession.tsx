import { useEffect, useState } from "preact/hooks";
import type { Quiz } from "../db";
import { todayStr } from "../date";
import { answerQuiz, nextQuizzes } from "../lectures";
import { PREFETCHED_EVENT } from "../prefetch";

const LETTERS = ["A", "B", "C", "D"];

export function choiceClass(i: number, answer: number, chosen: number | null): string {
  if (chosen === null) return "";
  if (i === answer) return "correct";
  if (i === chosen) return "wrong";
  return "";
}

export function QuizSession() {
  const [batch, setBatch] = useState<Quiz[] | null>(null);
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  async function load() {
    setBatch(await nextQuizzes(5));
    setPos(0);
    setChosen(null);
    setScore(0);
  }
  useEffect(() => {
    load();
    // 비어 있을 때 새 문제가 도착하면 바로 보여 줌 (풀던 중이면 그대로)
    const onArrive = () => nextQuizzes(5).then((b) => setBatch((prev) => (prev && prev.length ? prev : b)));
    window.addEventListener(PREFETCHED_EVENT, onArrive);
    return () => window.removeEventListener(PREFETCHED_EVENT, onArrive);
  }, []);

  if (!batch) return <main class="screen"><p class="muted">불러오는 중…</p></main>;

  if (!batch.length) {
    return (
      <main class="screen">
        <a class="back" href="#/">← 홈</a>
        <h1>강의 복습</h1>
        <div class="banner">문제 준비 중이에요. 인터넷이 되면 자동으로 받아요.</div>
        <p class="muted small">강의를 끝냈으면 강의 화면에서 [끝냄]을 눌러 주세요.</p>
        <a class="btn" href="#/lectures" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>강의 화면으로</a>
      </main>
    );
  }

  const q = batch[pos];
  if (!q) {
    return (
      <main class="screen">
        <h1>{batch.length}문제 중 {score}개 맞힘</h1>
        <p class="muted">틀린 문제는 오답 노트에 모였어요.</p>
        <button class="primary" onClick={load}>더 풀기</button>
        <a class="btn" href="#/wrong" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>오답 노트</a>
        <a class="back" href="#/">← 홈</a>
      </main>
    );
  }

  async function pick(i: number) {
    if (chosen !== null) return;
    setChosen(i);
    if (await answerQuiz(q.id!, i, todayStr())) setScore((s) => s + 1);
  }

  return (
    <main class="screen">
      <div class="row" style={{ alignItems: "center" }}>
        <a class="back" href="#/">← 홈</a>
        <span class="muted small" style={{ textAlign: "right" }}>{q.lectureNo}강 · {pos + 1} / {batch.length}</span>
      </div>
      <section class="card">
        <div style={{ fontSize: "19px", lineHeight: 1.5 }}>{q.question}</div>
      </section>
      <div class="stack">
        {q.choices.map((c, i) => (
          <button class={choiceClass(i, q.answerIndex, chosen)} style={{ textAlign: "left" }} onClick={() => pick(i)}>
            ({LETTERS[i]}) {c}
          </button>
        ))}
      </div>
      {chosen !== null && (
        <>
          <div class="banner">
            <strong>{chosen === q.answerIndex ? "정답!" : `정답은 (${LETTERS[q.answerIndex]})`}</strong>
            <div>{q.explanationKo}</div>
          </div>
          <div class="spacer" />
          <button class="primary bottom" onClick={() => { setPos((p) => p + 1); setChosen(null); }}>다음</button>
        </>
      )}
    </main>
  );
}
