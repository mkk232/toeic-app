import Anthropic, { APIConnectionError } from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

/** 생성 함수가 쓰는 만큼만. 진짜 Anthropic 클라이언트와 테스트용 가짜 둘 다 맞음 */
export interface ClaudeLike {
  beta: {
    messages: {
      parse: (params: any) => PromiseLike<{ stop_reason: string | null; parsed_output?: unknown }>;
    };
  };
}

/** message 는 화면에 그대로 보여 줄 한국어 */
export class ClaudeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeError";
  }
}

export async function makeClient(apiKey: string): Promise<ClaudeLike> {
  if (import.meta.env.VITE_MOCK_CLAUDE === "1") {
    const { mockClient } = await import("./mockClient");
    return mockClient;
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) as unknown as ClaudeLike;
}

/** SDK 오류를 화면용 한국어 오류로 */
export function toClaudeError(err: unknown): ClaudeError {
  if (err instanceof ClaudeError) return err;
  if ((err as { status?: number })?.status === 401) return new ClaudeError("API 키가 틀렸어요. 설정에서 다시 넣어 주세요.");
  if (err instanceof APIConnectionError || err instanceof TypeError) {
    return new ClaudeError("인터넷이 끊겼어요. 미리 받아 둔 문제로 계속해요.");
  }
  return new ClaudeError("Claude 호출이 실패했어요.");
}
