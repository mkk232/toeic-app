import { useEffect, useState } from "preact/hooks";
import { db, getSettings } from "../db";
import { todayStr } from "../date";
import { getTodayPlan } from "../dailyQueue";
import { getLastPrefetch, PREFETCHED_EVENT } from "../prefetch";

type Counts = { due: number; fresh: number; quiz: number; listening: number; words: number; wrong: number; hasKey: boolean; error?: string };

async function loadCounts(): Promise<Counts> {
  const [plan, quizzes, listening, words, wrong, s, last] = await Promise.all([
    getTodayPlan(todayStr()),
    db.quizzes.toArray(),
    db.listening.toArray(),
    db.words.count(),
    db.wrongNotes.toArray(),
    getSettings(),
    getLastPrefetch(),
  ]);
  return {
    due: plan.dueCards.length,
    fresh: plan.newWords.length,
    quiz: quizzes.filter((q) => !q.answeredAt).length,
    listening: listening.filter((i) => !i.answeredAt).length,
    words,
    wrong: wrong.filter((w) => !w.resolved).length,
    hasKey: !!s.apiKey,
    error: last?.error,
  };
}

function Task({ href, label, value, unit }: { href: string; label: string; value: number; unit: string }) {
  return (
    <a class="card row" href={href} style={{ alignItems: "center", textDecoration: "none", color: "inherit", minHeight: "64px" }}>
      <span style={{ flex: 2, fontSize: "18px" }}>{label}</span>
      <span style={{ textAlign: "right", fontSize: "18px", fontWeight: 600 }} class={value ? "" : "muted"}>
        {value ? `${value}${unit}` : "끝 ✓"}
      </span>
    </a>
  );
}

export function Home() {
  const [c, setC] = useState<Counts | null>(null);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);

  useEffect(() => {
    const refresh = () => loadCounts().then(setC);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    refresh();
    window.addEventListener(PREFETCHED_EVENT, refresh);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(PREFETCHED_EVENT, refresh);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <main class="screen">
      <h1>오늘 할 일</h1>
      {!online && <div class="banner warn">오프라인 · 미리 받은 문제로 공부 중</div>}
      {c && !c.words && <div class="banner warn">설정에서 단어 엑셀을 불러와 주세요.</div>}
      {c && !c.hasKey && <div class="banner warn">설정에서 API 키를 넣어 주세요.</div>}
      {c && (
        <div class="stack">
          <Task href="#/vocab" label="단어 복습" value={c.due} unit="개" />
          <Task href="#/vocab" label="새 단어" value={c.fresh} unit="개" />
          <Task href="#/quiz" label="강의 복습" value={c.quiz} unit="문제" />
          <Task href="#/listening" label="듣기" value={c.listening} unit="문제" />
        </div>
      )}
      <a class="back" href="#/lectures">강의 목차 · 오늘 들은 강 표시하기 →</a>
      {c?.error && <p class="muted small">마지막 문제 받기: {c.error}</p>}
      <div class="spacer" />
      <div class="row bottom">
        <a class="btn" href="#/wrong" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
          오답 노트{c?.wrong ? ` (${c.wrong})` : ""}
        </a>
        <a class="btn" href="#/settings" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>설정</a>
      </div>
    </main>
  );
}
