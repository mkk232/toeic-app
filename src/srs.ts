import type { Card } from "./db";
import { addDays } from "./date";

/** 모름 / 헷갈림 / 앎 */
export type Grade = "again" | "hard" | "good";
export const GRADE_QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 5 };

export function newCard(wordId: string, today: string): Card {
  return { wordId, ef: 2.5, reps: 0, interval: 0, due: today, introducedOn: today };
}

/** SM-2: 누른 버튼으로 다음 복습일을 정함 */
export function review(card: Card, grade: Grade, today: string): Card {
  const q = GRADE_QUALITY[grade];
  const ef = Math.max(1.3, card.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  let reps: number;
  let interval: number;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    if (card.reps === 0) interval = 1;
    else if (card.reps === 1) interval = 6;
    else interval = Math.round(card.interval * card.ef); // SM-2 원본: 간격은 바꾸기 전 ef 로 계산
    reps = card.reps + 1;
  }
  return { ...card, ef, reps, interval, due: addDays(today, interval) };
}
