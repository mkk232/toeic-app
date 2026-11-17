// 개발용 가짜 Claude. VITE_MOCK_CLAUDE=1 일 때만 불러온다. 진짜 키 없이 화면을 확인하는 용도.
import type { ClaudeLike } from "./client";

const QUIZ = [
  { question: "I want ___ a new phone.", choices: ["buy", "to buy", "buying", "bought"], answerIndex: 1, explanationKo: "want 뒤에는 to부정사(to + 동사원형)가 와요." },
  { question: "She decided ___ the job.", choices: ["taking", "took", "to take", "takes"], answerIndex: 2, explanationKo: "decide 도 뒤에 to부정사를 써요." },
  { question: "It is important ___ on time.", choices: ["arrive", "to arrive", "arrived", "arrives"], answerIndex: 1, explanationKo: "It is 형용사 + to부정사 형태예요." },
  { question: "He came here ___ you.", choices: ["to help", "help", "helped", "helps"], answerIndex: 0, explanationKo: "'~하려고'라는 목적은 to부정사로 나타내요." },
  { question: "We need someone ___ the report.", choices: ["checks", "checked", "to check", "check"], answerIndex: 2, explanationKo: "someone 을 꾸미는 to부정사예요(~할 누군가)." },
];

const LISTEN = [
  { question: "Where is the meeting room?", questionKo: "회의실이 어디예요?", choices: ["It's on the third floor.", "Yes, I'll meet him.", "At three o'clock."], choicesKo: ["3층에 있어요.", "네, 그를 만날 거예요.", "3시에요."], answerIndex: 0 },
  { question: "When does the store open?", questionKo: "가게는 언제 열어요?", choices: ["At the corner.", "At 9 a.m.", "It's open to everyone."], choicesKo: ["모퉁이에서요.", "오전 9시에요.", "누구에게나 열려 있어요."], answerIndex: 1 },
  { question: "Who sent this email?", questionKo: "이 이메일 누가 보냈어요?", choices: ["Mr. Kim did.", "By express mail.", "Yes, I sent it."], choicesKo: ["김 씨가요.", "빠른우편으로요.", "네, 제가 보냈어요."], answerIndex: 0 },
  { question: "Why don't we take a break?", questionKo: "잠깐 쉬는 게 어때요?", choices: ["It's broken.", "Good idea.", "I took it."], choicesKo: ["그거 고장 났어요.", "좋은 생각이에요.", "제가 가져갔어요."], answerIndex: 1 },
  { question: "Can you print this for me?", questionKo: "이거 출력해 줄래요?", choices: ["It's a nice print.", "Sure, no problem.", "In the printer room."], choicesKo: ["멋진 인쇄물이네요.", "물론이죠.", "프린터실에서요."], answerIndex: 1 },
];

const TOC = ["품사", "문장 구조", "시제", "수동태", "to부정사", "동명사", "분사", "관계대명사", "접속사", "전치사"].map((title, i) => ({ no: i + 1, title }));

const reply = (parsed_output: unknown) => new Promise<{ stop_reason: string; parsed_output: unknown }>((r) => setTimeout(() => r({ stop_reason: "end_turn", parsed_output }), 300));

export const mockClient: ClaudeLike = {
  beta: {
    messages: {
      parse: (params: any) => {
        const content = params.messages[0].content;
        if (Array.isArray(content)) return reply({ lectures: TOC });
        const system: string = params.system;
        if (system.includes("파트 2")) return reply({ items: LISTEN });
        if (system.includes("예문")) {
          const ids = String(content).split("\n").filter((l) => l.includes("\t")).map((l) => l.split("\t"));
          return reply({
            items: ids.map(([id, word]) => ({ id, easy: `I like the word "${word}".`, easyKo: `나는 "${word}"라는 단어가 좋아요.`, toeic: `Please review the ${word} before the meeting.`, toeicKo: `회의 전에 ${word}를 검토해 주세요.` })),
          });
        }
        return reply({ questions: QUIZ });
      },
    },
  },
};
