import { z } from "zod";

// 개수(보기 4개 등)는 스키마로 강제하지 않고 받은 뒤 코드에서 검사한다.
export const QuizSet = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      choices: z.array(z.string()),
      answerIndex: z.number().int(),
      explanationKo: z.string(),
    }),
  ),
});

export const ListeningSet = z.object({
  items: z.array(
    z.object({
      question: z.string(),
      questionKo: z.string(),
      choices: z.array(z.string()),
      choicesKo: z.array(z.string()),
      answerIndex: z.number().int(),
    }),
  ),
});

export const ExampleSet = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      easy: z.string(),
      easyKo: z.string(),
      toeic: z.string(),
      toeicKo: z.string(),
    }),
  ),
});

export const TocSet = z.object({
  lectures: z.array(z.object({ no: z.number().int(), title: z.string() })),
});
