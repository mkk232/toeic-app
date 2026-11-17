// 소리 내 읽기는 전부 이 파일에서 한다. 나중에 유료 음성으로 바꿀 때 여기만 고치면 된다.

const norm = (lang: string) => lang.replace("_", "-").toLowerCase();

/** 정확한 억양 → 같은 언어(en-*) → 없음 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const want = norm(lang);
  const base = want.split("-")[0];
  return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => norm(v.lang).split("-")[0] === base);
}

function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener?.("voiceschanged", done);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, 1000);
    synth.addEventListener?.("voiceschanged", done);
  });
}

export function stopSpeaking() {
  (window as any).speechSynthesis?.cancel?.();
}

/** 읽기가 끝나면 resolve. 음성 기능이 없으면 바로 resolve */
export async function speak(text: string, opts: { lang: string; rate: number }): Promise<void> {
  const synth: SpeechSynthesis | undefined = (window as any).speechSynthesis;
  const Utter = (window as any).SpeechSynthesisUtterance;
  if (!synth || !Utter) return;
  const voices = await loadVoices(synth);
  synth.cancel();
  await new Promise<void>((resolve) => {
    const u: SpeechSynthesisUtterance = new Utter(text);
    u.lang = opts.lang;
    u.rate = opts.rate;
    const voice = pickVoice(voices, opts.lang);
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}
