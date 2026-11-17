import { pickVoice, speak, createPlayer } from "./speech";

const v = (lang: string, name = lang) => ({ lang, name }) as SpeechSynthesisVoice;

test("정확한 억양이 없으면 같은 언어 아무 음성", () => {
  expect(pickVoice([v("ko-KR"), v("en-GB")], "en-US")?.lang).toBe("en-GB");
});

test("정확한 억양이 있으면 그것", () => {
  expect(pickVoice([v("en-GB"), v("en-US")], "en-US")?.lang).toBe("en-US");
});

test("밑줄 표기(en_US)도 같은 억양으로 봄", () => {
  expect(pickVoice([v("en-GB"), v("en_US")], "en-US")?.lang).toBe("en_US");
});

test("영어 음성이 없으면 undefined", () => {
  expect(pickVoice([v("ko-KR")], "en-US")).toBeUndefined();
});

test("speechSynthesis 가 없어도 오류 없이 끝남", async () => {
  const had = "speechSynthesis" in window;
  const orig = (window as any).speechSynthesis;
  delete (window as any).speechSynthesis;
  await expect(speak("hello", { lang: "en-US", rate: 1 })).resolves.toBeUndefined();
  if (had) (window as any).speechSynthesis = orig;
});

function installFakeSynth(opts: { voices?: SpeechSynthesisVoice[]; autoEnd?: boolean } = {}) {
  const state = { voices: opts.voices ?? [], listeners: {} as Record<string, () => void>, spoken: [] as any[], cancels: 0 };
  (window as any).SpeechSynthesisUtterance = class {
    text: string; lang = ""; rate = 1; voice: SpeechSynthesisVoice | null = null;
    onend: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(t: string) { this.text = t; }
  };
  (window as any).speechSynthesis = {
    getVoices: () => state.voices,
    addEventListener: (n: string, f: () => void) => { state.listeners[n] = f; },
    removeEventListener: () => {},
    cancel: () => { state.cancels++; },
    speak: (u: any) => { state.spoken.push(u); if (opts.autoEnd !== false) setTimeout(() => u.onend?.(), 5); },
  };
  return state;
}
afterEach(() => {
  delete (window as any).speechSynthesis;
  vi.useRealTimers();
});

test("음성 목록이 비어 있으면 기다리지 않고 바로 언어만 정해 읽음(아이폰 터치 유지)", async () => {
  const st = installFakeSynth();
  const p = speak("hi", { lang: "en-AU", rate: 0.8 });
  expect(st.spoken).toHaveLength(1);
  expect(st.spoken[0].lang).toBe("en-AU");
  expect(st.spoken[0].voice).toBeNull();
  expect(st.spoken[0].rate).toBe(0.8);
  await p;
});

test("목록이 나중에 채워지면 다음 읽기부터 그 억양 음성을 고름", async () => {
  const st = installFakeSynth();
  await speak("one", { lang: "en-AU", rate: 1 });
  st.voices = [v("en-US"), v("en-AU")];
  st.listeners.voiceschanged?.();
  await speak("two", { lang: "en-AU", rate: 1 });
  expect(st.spoken[1].voice?.lang).toBe("en-AU");
});

test("끝 신호가 안 와도 시간이 지나면 끝난 것으로 봄", async () => {
  vi.useFakeTimers();
  installFakeSynth({ autoEnd: false });
  let done = false;
  speak("hello there", { lang: "en-US", rate: 1 }).then(() => (done = true));
  await vi.advanceTimersByTimeAsync(20000);
  expect(done).toBe(true);
});

test("player.stop() 하면 남은 문장을 더 읽지 않음", async () => {
  const st = installFakeSynth();
  const player = createPlayer();
  const p = player.play(["q", "A. a", "B. b", "C. c"], { lang: "en-US", rate: 1 }, 0);
  await new Promise((r) => setTimeout(r, 2));
  player.stop();
  await p;
  expect(st.spoken.map((u: any) => u.text)).toEqual(["q"]);
});

test("player 로 끝까지 읽으면 순서대로 전부", async () => {
  const st = installFakeSynth();
  await createPlayer().play(["q", "A. a", "B. b"], { lang: "en-US", rate: 1 }, 0);
  expect(st.spoken.map((u: any) => u.text)).toEqual(["q", "A. a", "B. b"]);
});
