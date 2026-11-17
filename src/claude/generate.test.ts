import { APIConnectionError } from "@anthropic-ai/sdk";
import { ClaudeError, MODEL, type ClaudeLike } from "./client";
import { generateLectureQuiz, generateListening, generateExamples, parseToc } from "./generate";

type Reply = { stop_reason: string | null; parsed_output: unknown } | Error;

function fake(reply: Reply) {
  const calls: any[] = [];
  const c: ClaudeLike = {
    beta: {
      messages: {
        parse: async (params: any) => {
          calls.push(params);
          if (reply instanceof Error) throw reply;
          return reply;
        },
      },
    },
  };
  return { c, calls };
}

const q = (over: Partial<{ question: string; choices: string[]; answerIndex: number; explanationKo: string }> = {}) => ({
  question: "The meeting was ___ until Friday.",
  choices: ["postponed", "postpone", "postponing", "postpones"],
  answerIndex: 0,
  explanationKo: "be 동사 뒤 수동태라 과거분사가 맞아요.",
  ...over,
});

const LECTURE = { no: 3, title: "to부정사" };

test("정상 퀴즈 5개 → 5개, 칸 채움, 모델·노력 수준 확인", async () => {
  const { c, calls } = fake({ stop_reason: "end_turn", parsed_output: { questions: [q(), q(), q(), q(), q()] } });
  const out = await generateLectureQuiz(c, LECTURE, 5, "new");
  expect(out).toHaveLength(5);
  expect(out[0]).toMatchObject({ lectureNo: 3, kind: "new", answerIndex: 0 });
  expect(out[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(calls[0].model).toBe(MODEL);
  expect(MODEL).toBe("claude-opus-5-5");
  expect(calls[0].output_config.effort).toBe("medium");
  expect(calls[0].fallbacks).toBe("default");
  expect(JSON.stringify(calls[0].messages)).toContain("to부정사");
});

test("보기 3개짜리·정답 번호 범위 밖 문제는 버림", async () => {
  const { c } = fake({
    stop_reason: "end_turn",
    parsed_output: { questions: [q(), q({ choices: ["a", "b", "c"] }), q({ answerIndex: 4 }), q(), q()] },
  });
  expect(await generateLectureQuiz(c, LECTURE, 5, "review")).toHaveLength(3);
});

test("요청보다 많이 오면 요청 수만큼만", async () => {
  const { c } = fake({ stop_reason: "end_turn", parsed_output: { questions: [q(), q(), q()] } });
  expect(await generateLectureQuiz(c, LECTURE, 2, "new")).toHaveLength(2);
});

test("전부 불량이면 ClaudeError", async () => {
  const { c } = fake({ stop_reason: "end_turn", parsed_output: { questions: [q({ answerIndex: -1 })] } });
  await expect(generateLectureQuiz(c, LECTURE, 5, "new")).rejects.toBeInstanceOf(ClaudeError);
});

test("거절이면 거절 메시지", async () => {
  const { c } = fake({ stop_reason: "refusal", parsed_output: null });
  await expect(generateLectureQuiz(c, LECTURE, 5, "new")).rejects.toThrow("Claude가 이 요청을 거절했어요. 잠시 뒤 다시 해 보세요.");
});

test("답을 못 읽으면 읽기 실패 메시지", async () => {
  const { c } = fake({ stop_reason: "end_turn", parsed_output: null });
  await expect(generateLectureQuiz(c, LECTURE, 5, "new")).rejects.toThrow("Claude 답을 읽지 못했어요. 다시 해 볼게요.");
});

test("401 이면 API 키 메시지", async () => {
  const err = Object.assign(new Error("unauthorized"), { status: 401 });
  const { c } = fake(err);
  await expect(generateLectureQuiz(c, LECTURE, 5, "new")).rejects.toThrow("API 키가 틀렸어요. 설정에서 다시 넣어 주세요.");
});

test("연결 오류면 인터넷 메시지", async () => {
  const { c } = fake(new APIConnectionError({ message: "fetch failed" }));
  await expect(generateListening(c, 2)).rejects.toThrow("인터넷이 끊겼어요. 미리 받아 둔 문제로 계속해요.");
});

test("그 외 오류는 일반 실패 메시지", async () => {
  const { c } = fake(Object.assign(new Error("boom"), { status: 500 }));
  await expect(generateListening(c, 2)).rejects.toThrow("Claude 호출이 실패했어요.");
});

test("듣기: 보기·해석 3개만 통과, 억양은 세 값 중 하나", async () => {
  const item = { question: "Where is the report?", questionKo: "보고서 어디 있어요?", choices: ["On your desk.", "Yes, I did.", "Report it."], choicesKo: ["책상 위에요.", "네, 했어요.", "보고하세요."], answerIndex: 0 };
  const { c } = fake({ stop_reason: "end_turn", parsed_output: { items: [item, { ...item, choices: ["a", "b"] }, { ...item, answerIndex: 3 }] } });
  const out = await generateListening(c, 5);
  expect(out).toHaveLength(1);
  expect(["en-US", "en-GB", "en-AU"]).toContain(out[0].accent);
});

test("예문: id 별로 묶음, 모르는 id 는 버림", async () => {
  const ex = { easy: "I sent my resume.", easyKo: "이력서를 보냈어요.", toeic: "Please attach your resume.", toeicKo: "이력서를 첨부해 주세요." };
  const { c } = fake({ stop_reason: "end_turn", parsed_output: { items: [{ id: "1-0", ...ex }, { id: "9-9", ...ex }] } });
  const out = await generateExamples(c, [{ id: "1-0", word: "resume", meaning: "이력서" }]);
  expect(Object.keys(out)).toEqual(["1-0"]);
  expect(out["1-0"]).toEqual(ex);
});

test("목차: 첫 블록이 이미지, 강 번호 순", async () => {
  const { c, calls } = fake({ stop_reason: "end_turn", parsed_output: { lectures: [{ no: 2, title: "문장 구조" }, { no: 1, title: "품사" }] } });
  const out = await parseToc(c, { base64: "AAAA", mediaType: "image/png" });
  expect(out).toEqual([{ no: 1, title: "품사" }, { no: 2, title: "문장 구조" }]);
  const block = calls[0].messages[0].content[0];
  expect(block).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } });
});
