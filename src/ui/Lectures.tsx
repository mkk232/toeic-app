import { useEffect, useState } from "preact/hooks";
import { db, getSettings, type Lecture, type LectureDone } from "../db";
import { todayStr } from "../date";
import { markLectureDone, saveToc } from "../lectures";
import { makeClient } from "../claude/client";
import { parseToc } from "../claude/generate";
import { fileToClaudeImage } from "../image";
import { go } from "./nav";
import { requestTopUp } from "../prefetchSignal";

export function Lectures() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [done, setDone] = useState<LectureDone[]>([]);
  const [draft, setDraft] = useState<Lecture[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [no, setNo] = useState("");
  const [title, setTitle] = useState("");

  async function reload() {
    setLectures(await db.lectures.orderBy("no").toArray());
    setDone(await db.lectureDone.toArray());
  }
  useEffect(() => {
    reload();
  }, []);

  async function onPhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const { apiKey } = await getSettings();
    if (!apiKey) return setMsg("설정에서 API 키를 먼저 넣어 주세요.");
    setBusy(true);
    setMsg("Claude가 목차를 읽는 중이에요…");
    try {
      const list = await parseToc(await makeClient(apiKey), await fileToClaudeImage(file));
      setDraft(list);
      setMsg(`${list.length}개 강을 찾았어요. 맞으면 저장을 눌러 주세요.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "목차를 읽지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    await saveToc(draft);
    setDraft(null);
    setMsg("목차를 저장했어요.");
    reload();
  }

  async function addOne() {
    const n = Number(no);
    if (!Number.isInteger(n) || n <= 0 || !title.trim()) return setMsg("강 번호(숫자)와 제목을 넣어 주세요.");
    await db.lectures.put({ no: n, title: title.trim() });
    setNo("");
    setTitle("");
    reload();
  }

  async function finish(n: number) {
    await markLectureDone(n, todayStr());
    requestTopUp();
    go("/quiz");
  }

  const lastDone = (n: number) => done.filter((d) => d.lectureNo === n).map((d) => d.date).sort().pop();

  return (
    <main class="screen">
      <a class="back" href="#/">← 홈</a>
      <h1>강의</h1>
      {msg && <div class="banner" role="status">{msg}</div>}

      {draft ? (
        <section class="card stack">
          <h2>읽은 목차</h2>
          <ol class="small" style={{ margin: 0, paddingLeft: "20px" }}>
            {draft.map((l) => <li value={l.no}>{l.title}</li>)}
          </ol>
          <div class="row">
            <button onClick={() => setDraft(null)}>다시</button>
            <button class="primary" onClick={saveDraft}>저장</button>
          </div>
        </section>
      ) : (
        <section class="card stack">
          <h2>{lectures.length ? "목차 다시 올리기" : "목차 사진 올리기"}</h2>
          <p class="muted small">인강 목차 화면을 캡처해서 올리면 Claude가 강 번호와 제목을 읽어요.</p>
          <label class="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {busy ? "읽는 중…" : "사진 고르기"}
            <input type="file" accept="image/*" onChange={onPhoto} disabled={busy} style={{ display: "none" }} aria-label="목차 사진 고르기" />
          </label>
        </section>
      )}

      {lectures.length > 0 && (
        <section class="stack">
          {lectures.map((l) => {
            const d = lastDone(l.no);
            return (
              <div class="card row" style={{ alignItems: "center", padding: "10px 12px" }}>
                <div style={{ flex: 3 }}>
                  <div>{l.no}강 {l.title}</div>
                  {d && <div class="muted small">끝냄 {d}</div>}
                </div>
                <button class={d ? "" : "primary"} onClick={() => finish(l.no)}>{d ? "또 끝냄" : "끝냄"}</button>
              </div>
            );
          })}
        </section>
      )}

      <section class="card stack">
        <h2>직접 추가</h2>
        <div class="row">
          <input inputMode="numeric" placeholder="번호" value={no} onInput={(e) => setNo((e.currentTarget as HTMLInputElement).value)} style={{ flex: 1 }} aria-label="강 번호" />
          <input placeholder="제목 (예: to부정사)" value={title} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} style={{ flex: 3 }} aria-label="강 제목" />
        </div>
        <button onClick={addOne}>추가</button>
      </section>
    </main>
  );
}
