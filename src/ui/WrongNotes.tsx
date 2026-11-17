import { useEffect, useState } from "preact/hooks";
import { db, type ListeningItem, type Quiz, type WrongNote } from "../db";
import { resolveWrongNote } from "../lectures";
import { choiceClass } from "./QuizSession";

type Row = { note: WrongNote; quiz?: Quiz; item?: ListeningItem };
const LETTERS = ["A", "B", "C", "D"];

function NoteCard({ row, onResolved }: { row: Row; onResolved: () => void }) {
  const [retry, setRetry] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const src = row.quiz ?? row.item!;
  const answer = src.answerIndex;

  async function pick(i: number) {
    if (chosen !== null) return;
    setChosen(i);
    if (i === answer) {
      await resolveWrongNote(row.note.id!);
      setTimeout(onResolved, 900);
    }
  }

  return (
    <section class="card stack">
      <div class="muted small">{row.quiz ? `${row.quiz.lectureNo}강 복습` : "듣기"} · {row.note.date}</div>
      <div style={{ fontSize: "17px" }}>{src.question}</div>
      {row.item && <div class="muted small">{row.item.questionKo}</div>}
      {!retry ? (
        <>
          <div class="small">
            {src.chosenIndex !== undefined && <div>내 답: ({LETTERS[src.chosenIndex]}) {src.choices[src.chosenIndex]}</div>}
            <div>정답: ({LETTERS[answer]}) {src.choices[answer]}</div>
          </div>
          {row.quiz && <div class="small">{row.quiz.explanationKo}</div>}
          {row.item && <div class="muted small">{row.item.choicesKo.map((k, i) => `(${LETTERS[i]}) ${k}`).join("  ")}</div>}
          <button onClick={() => setRetry(true)}>다시 풀기</button>
        </>
      ) : (
        <div class="stack">
          {src.choices.map((c, i) => (
            <button class={choiceClass(i, answer, chosen)} style={{ textAlign: "left" }} onClick={() => pick(i)}>
              ({LETTERS[i]}) {c}
            </button>
          ))}
          {chosen !== null && chosen !== answer && <button onClick={() => { setChosen(null); setRetry(false); }}>설명 다시 보기</button>}
        </div>
      )}
    </section>
  );
}

export function WrongNotes() {
  const [rows, setRows] = useState<Row[] | null>(null);

  async function load() {
    const notes = (await db.wrongNotes.toArray()).filter((n) => !n.resolved).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    const out: Row[] = [];
    for (const note of notes) {
      if (note.source === "quiz") {
        const quiz = await db.quizzes.get(note.refId);
        if (quiz) out.push({ note, quiz });
      } else {
        const item = await db.listening.get(note.refId);
        if (item) out.push({ note, item });
      }
    }
    setRows(out);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <main class="screen">
      <a class="back" href="#/">← 홈</a>
      <h1>오답 노트</h1>
      {!rows ? (
        <p class="muted">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <div class="banner">틀린 문제가 없어요. 잘하고 있어요!</div>
      ) : (
        rows.map((r) => <NoteCard key={r.note.id} row={r} onResolved={load} />)
      )}
    </main>
  );
}
