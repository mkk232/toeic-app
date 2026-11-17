import { useEffect, useState } from "preact/hooks";
import { getSettings, saveSettings, type Settings as S } from "../db";
import { importWordsFromFile } from "../wordImport";
import { backupFileName, exportBackup, importBackup } from "../backup";
import { todayStr } from "../date";
import { requestTopUp } from "../prefetchSignal";

export function Settings() {
  const [s, setS] = useState<S | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings().then((v) => {
      setS(v);
      setKeyDraft(v.apiKey);
    });
  }, []);

  async function update(p: Partial<S>) {
    await saveSettings(p);
    setS(await getSettings());
  }

  async function onKeySave() {
    await update({ apiKey: keyDraft.trim() });
    setMsg(keyDraft.trim() ? "API 키를 저장했어요." : "API 키를 지웠어요.");
    if (keyDraft.trim()) requestTopUp();
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("단어를 불러오는 중이에요…");
    try {
      const r = await importWordsFromFile(file);
      requestTopUp();
      setMsg(`새 단어 ${r.added}개, 바뀐 단어 ${r.updated}개를 불러왔어요.` + (r.skipped ? ` (읽지 못한 줄 ${r.skipped}개)` : ""));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "단어를 불러오지 못했어요.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  async function onExport() {
    const blob = await exportBackup();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName(todayStr());
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setMsg("백업 파일을 만들었어요. \"파일에 저장\"을 골라 주세요.");
  }

  async function onImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!confirm("지금 기록을 백업 내용으로 바꿔요. 계속할까요?")) return;
    try {
      await importBackup(file);
      setS(await getSettings());
      setMsg("백업을 불러왔어요.");
      requestTopUp();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "백업을 불러오지 못했어요.");
    }
  }

  return (
    <main class="screen">
      <a class="back" href="#/">← 홈</a>
      <h1>설정</h1>
      {msg && <div class="banner" role="status">{msg}</div>}

      <section class="card stack">
        <h2>Claude API 키</h2>
        <label>
          키 붙여 넣기
          <input
            type="password"
            autocomplete="off"
            placeholder="sk-ant-..."
            value={keyDraft}
            onInput={(e) => setKeyDraft((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <p class="muted small">키는 이 폰에만 저장돼요. 백업 파일에도 안 들어가요.</p>
        <button class="primary" onClick={onKeySave}>키 저장</button>
      </section>

      <section class="card stack">
        <h2>단어 엑셀</h2>
        <p class="muted small">첫 줄이 Day / 단어 / 뜻 인 엑셀(.xlsx)이에요. 다시 불러와도 공부 기록은 남아요.</p>
        <label class="btn" style={{ justifyContent: "center", alignItems: "center", display: "flex" }}>
          {busy ? "불러오는 중…" : "엑셀 불러오기"}
          <input type="file" accept=".xlsx" onChange={onFile} disabled={busy} style={{ display: "none" }} aria-label="엑셀 불러오기" />
        </label>
      </section>

      {s && (
        <section class="card stack">
          <h2>공부 양</h2>
          <label>
            하루 새 단어
            <select value={String(s.newPerDay)} onChange={(e) => update({ newPerDay: Number((e.currentTarget as HTMLSelectElement).value) })}>
              {[10, 20, 30, 40].map((n) => <option value={String(n)}>{n}개</option>)}
            </select>
          </label>
          <label>
            듣기 속도
            <select value={String(s.speechRate)} onChange={(e) => update({ speechRate: Number((e.currentTarget as HTMLSelectElement).value) })}>
              <option value="0.8">느리게 (0.8배)</option>
              <option value="1">보통 (1배)</option>
            </select>
          </label>
        </section>
      )}

      <section class="card stack">
        <h2>백업</h2>
        <p class="muted small">앱을 지우면 공부 기록도 사라져요. 일주일에 한 번 "파일"(iCloud Drive)에 내보내 두세요. API 키는 백업에 안 들어가요.</p>
        <button onClick={onExport}>백업 내보내기</button>
        <label class="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          백업 불러오기
          <input type="file" accept=".json,application/json" onChange={onImport} style={{ display: "none" }} aria-label="백업 불러오기" />
        </label>
      </section>
    </main>
  );
}
