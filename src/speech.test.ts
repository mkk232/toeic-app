import { pickVoice, speak } from "./speech";

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

test("음성 목록이 늦게 오면 기다렸다가 고름", async () => {
  let voices: SpeechSynthesisVoice[] = [];
  const listeners: Record<string, () => void> = {};
  const spoken: SpeechSynthesisUtterance[] = [];
  (window as any).SpeechSynthesisUtterance = class {
    text: string; lang = ""; rate = 1; voice: SpeechSynthesisVoice | null = null;
    onend: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(t: string) { this.text = t; }
  };
  (window as any).speechSynthesis = {
    getVoices: () => voices,
    addEventListener: (n: string, f: () => void) => { listeners[n] = f; },
    removeEventListener: () => {},
    cancel: () => {},
    speak: (u: any) => { spoken.push(u); setTimeout(() => u.onend?.(), 0); },
  };
  setTimeout(() => { voices = [v("en-AU")]; listeners.voiceschanged?.(); }, 20);
  await speak("hi", { lang: "en-AU", rate: 0.8 });
  expect(spoken).toHaveLength(1);
  expect(spoken[0].voice?.lang).toBe("en-AU");
  expect(spoken[0].rate).toBe(0.8);
  delete (window as any).speechSynthesis;
});
