import type { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Examples, Lecture, ListeningItem, Quiz, Word } from "../db";
import { todayStr } from "../date";
import { ClaudeError, MODEL, toClaudeError, type ClaudeLike } from "./client";
import { ExampleSet, ListeningSet, QuizSet, TocSet } from "./schemas";

const LEARNER = "학습자는 한국인 영어 입문자이고 목표는 토익 800점이다. 설명은 모두 한국어로, 중학생도 알 수 있게 쉽게 쓴다.";

async function ask<S extends z.ZodType>(c: ClaudeLike, schema: S, system: string, content: unknown): Promise<z.infer<S>> {
  let res: { stop_reason: string | null; parsed_output?: unknown };
  try {
    res = await c.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    });
  } catch (err) {
    throw toClaudeError(err);
  }
  if (res.stop_reason === "refusal") throw new ClaudeError("Claude가 이 요청을 거절했어요. 잠시 뒤 다시 해 보세요.");
  if (res.parsed_output == null) throw new ClaudeError("Claude 답을 읽지 못했어요. 다시 해 볼게요.");
  return res.parsed_output as z.infer<S>;
}

function nonEmpty<T>(items: T[]): T[] {
  if (!items.length) throw new ClaudeError("Claude 답을 읽지 못했어요. 다시 해 볼게요.");
  return items;
}

const okIndex = (i: number, n: number) => Number.isInteger(i) && i >= 0 && i < n;

export async function generateLectureQuiz(c: ClaudeLike, lecture: Lecture, count: number, kind: "new" | "review"): Promise<Omit<Quiz, "id">[]> {
  const purpose = kind === "new" ? "오늘 처음 배운 내용을 확인하는" : "이미 배운 내용을 며칠 뒤 다시 확인하는";
  const system = `${LEARNER} 너는 토익 문법 복습 문제를 내는 선생님이다.`;
  const prompt =
    `${lecture.no}강 "${lecture.title}" 범위로 ${purpose} 토익 파트 5 스타일 A~D 4지선다 문제를 ${count}개 만들어.\n` +
    `- 문장은 쉬운 단어로. 빈칸은 ___ 로 표시.\n- choices 는 정확히 4개, answerIndex 는 0~3.\n` +
    `- explanationKo: 정답 이유와 헷갈리는 오답 이유를 2~3문장으로.\n- 문제마다 정답 위치를 골고루 섞어.`;
  const out = await ask(c, QuizSet, system, prompt);
  const createdAt = todayStr();
  return nonEmpty(
    out.questions
      .filter((x) => x.choices.length === 4 && okIndex(x.answerIndex, 4))
      .slice(0, count)
      .map((x) => ({ ...x, lectureNo: lecture.no, kind, createdAt })),
  );
}

const ACCENTS: ListeningItem["accent"][] = ["en-US", "en-GB", "en-AU"];

export async function generateListening(c: ClaudeLike, count: number): Promise<Omit<ListeningItem, "id">[]> {
  const system = `${LEARNER} 너는 토익 듣기 파트 2 문제를 쓰는 출제자다.`;
  const prompt =
    `토익 파트 2(질문-응답) 문제를 ${count}개 만들어.\n` +
    `- question: 짧은 질문이나 말 한 문장. choices: 대답 정확히 3개, 정답 1개(answerIndex 0~2).\n` +
    `- 입문자가 알아들을 수 있는 쉬운 어휘. 그래도 토익식 함정(비슷한 소리 단어, 질문 단어 반복, 의문사 의문문에 Yes/No)을 넣어.\n` +
    `- questionKo, choicesKo 는 자연스러운 한국어 해석(choicesKo 도 3개).\n- 질문 유형(Who/Where/When/Why/How/제안/부탁/평서문)을 섞어.`;
  const out = await ask(c, ListeningSet, system, prompt);
  const createdAt = todayStr();
  return nonEmpty(
    out.items
      .filter((x) => x.choices.length === 3 && x.choicesKo.length === 3 && okIndex(x.answerIndex, 3))
      .slice(0, count)
      .map((x) => ({ ...x, accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)], createdAt })),
  );
}

export async function generateExamples(c: ClaudeLike, words: Pick<Word, "id" | "word" | "meaning">[]): Promise<Record<string, Examples>> {
  const system = `${LEARNER} 너는 토익 단어 예문을 쓰는 선생님이다.`;
  const list = words.map((w) => `${w.id}\t${w.word}\t${w.meaning.replace(/\s+/g, " ")}`).join("\n");
  const prompt =
    `아래 단어마다 예문 2개를 만들어. 형식: id<TAB>단어<TAB>뜻.\n` +
    `- easy: 일상에서 쓰는 아주 쉬운 짧은 문장. toeic: 토익 지문(회사·이메일·공지)에 나올 법한 문장.\n` +
    `- 주어진 뜻으로 쓸 것. easyKo, toeicKo 는 한국어 해석. id 는 그대로 돌려줘.\n\n${list}`;
  const out = await ask(c, ExampleSet, system, prompt);
  const wanted = new Set(words.map((w) => w.id));
  const result: Record<string, Examples> = {};
  for (const { id, easy, easyKo, toeic, toeicKo } of out.items) {
    if (wanted.has(id)) result[id] = { easy, easyKo, toeic, toeicKo };
  }
  return result;
}

export async function parseToc(c: ClaudeLike, image: { base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" }): Promise<Lecture[]> {
  const system = "너는 사진 속 강의 목차를 읽어 목록으로 옮기는 도우미다.";
  const content = [
    { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
    { type: "text", text: "강의 목차 사진이다. 강 번호(no)와 제목(title)을 순서대로 옮겨. 번호가 안 보이면 위에서부터 1, 2, 3. 제목은 사진에 쓰인 그대로." },
  ];
  const out = await ask(c, TocSet, system, content);
  return nonEmpty(
    out.lectures
      .filter((l) => Number.isInteger(l.no) && l.no > 0 && l.title.trim())
      .map((l) => ({ no: l.no, title: l.title.trim() }))
      .sort((a, b) => a.no - b.no),
  );
}
