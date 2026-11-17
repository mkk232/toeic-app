import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/preact";
import { db } from "../db";
import { QuizSession } from "./QuizSession";

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(cleanup);

test("틀린 보기를 누르면 설명이 보이고 오답 노트에 들어감", async () => {
  await db.quizzes.add({
    lectureNo: 5, kind: "new", question: "I want ___ a phone.", choices: ["buy", "to buy", "buying", "bought"],
    answerIndex: 1, explanationKo: "want 뒤에는 to부정사가 와요.", createdAt: "2026-11-17",
  });
  render(<QuizSession />);
  fireEvent.click(await screen.findByRole("button", { name: /buying/ }));
  expect(await screen.findByText("want 뒤에는 to부정사가 와요.")).toBeTruthy();
  await waitFor(async () => expect(await db.wrongNotes.count()).toBe(1));
});

test("문제가 없으면 준비 중 안내", async () => {
  render(<QuizSession />);
  expect(await screen.findByText(/문제 준비 중이에요/)).toBeTruthy();
});
