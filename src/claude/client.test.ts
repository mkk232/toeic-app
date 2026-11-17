import { AnthropicError } from "@anthropic-ai/sdk";
import { makeClient, toClaudeError } from "./client";

test("멈춘 연결을 오래 안 기다림: 시간 제한 90초, 재시도 1번", async () => {
  const c = (await makeClient("k")) as any;
  expect(c.timeout).toBe(90_000);
  expect(c.maxRetries).toBe(1);
});

test("구조화 답 해석 실패는 '답을 읽지 못했어요'", () => {
  expect(toClaudeError(new AnthropicError("Failed to parse structured output: bad json")).message).toBe(
    "Claude 답을 읽지 못했어요. 다시 해 볼게요.",
  );
});

test("429·529 는 '바빠요'", () => {
  for (const status of [429, 529]) {
    expect(toClaudeError(Object.assign(new Error("x"), { status })).message).toBe("Claude가 바빠요. 잠시 뒤 다시 해 볼게요.");
  }
});
