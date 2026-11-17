// 소리 내 읽기는 전부 이 파일에서 한다. 나중에 유료 음성으로 바꿀 때 여기만 고치면 된다.

const norm = (lang: string) => lang.replace("_", "-").toLowerCase();

/** 정확한 억양 → 같은 언어(en-*) → 없음 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const want = norm(lang);
  const base = want.split("-")[0];
  return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => norm(v.lang).split("-")[0] === base);
}

const synthOf = (): SpeechSynthesis | undefined => (window as any).speechSynthesis;

export function stopSpeaking() {
  synthOf()?.cancel?.();
}

/**
 * 읽기가 끝나면 resolve. 음성 기능이 없으면 바로 resolve.
 * 아이폰은 터치 직후에만 소리를 허락하므로, await 없이 바로 speak() 를 부른다.
 * 음성 목록이 아직 비어 있으면 언어만 정해 기본 음성으로 읽는다.
 * 끝 신호가 안 와도(아이폰에서 막힘 등) 길이에 맞춘 시간이 지나면 끝난 것으로 본다.
 */
export function speak(text: string, opts: { lang: string; rate: number }): Promise<void> {
  const synth = synthOf();
  const Utter = (window as any).SpeechSynthesisUtterance;
  if (!synth || !Utter) return Promise.resolve();
  const u: SpeechSynthesisUtterance = new Utter(text);
  u.lang = opts.lang;
  u.rate = opts.rate;
  const voice = pickVoice(synth.getVoices?.() ?? [], opts.lang);
  if (voice) u.voice = voice;
  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 2000 + (text.length * 120) / opts.rate);
    u.onend = finish;
    u.onerror = finish;
    synth.cancel();
    synth.speak(u);
  });
}

/** 여러 문장을 차례로 읽고, stop() 하면 그 자리에서 멈추는 재생기 */
export function createPlayer() {
  let generation = 0;
  return {
    async play(parts: string[], opts: { lang: string; rate: number }, gapMs = 600): Promise<void> {
      const mine = ++generation;
      for (let i = 0; i < parts.length; i++) {
        if (mine !== generation) return;
        if (i > 0 && gapMs) await new Promise((r) => setTimeout(r, gapMs));
        if (mine !== generation) return;
        await speak(parts[i], opts);
      }
    },
    stop() {
      generation++;
      stopSpeaking();
    },
  };
}
