import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/preact";
import { db, saveSettings } from "../db";
import { QuizSession } from "./QuizSession";
import { PREFETCHED_EVENT } from "../prefetch";

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
  await saveSettings({ apiKey: "k" });
  render(<QuizSession />);
  expect(await screen.findByText(/문제 준비 중이에요/)).toBeTruthy();
});

test("복습 문제를 보고만 있을 때 새 강 문제가 오면 새 강 문제부터", async () => {
  await db.quizzes.add({
    lectureNo: 1, kind: "review", question: "Old review?", choices: ["a", "b", "c", "d"],
    answerIndex: 0, explanationKo: "", createdAt: "2026-11-10",
  });
  render(<QuizSession />);
  await screen.findByText("Old review?");
  await db.quizzes.add({
    lectureNo: 2, kind: "new", question: "New lecture?", choices: ["a", "b", "c", "d"],
    answerIndex: 0, explanationKo: "", createdAt: "2026-11-17",
  });
  window.dispatchEvent(new Event(PREFETCHED_EVENT));
  expect(await screen.findByText("New lecture?")).toBeTruthy();
});

test("API 키가 없으면 빈 화면에서 키 안내", async () => {
  render(<QuizSession />);
  expect(await screen.findByText("설정에서 API 키를 넣어 주세요.")).toBeTruthy();
});

test("준비 중이다가 문제를 받아 오면 화면이 바뀜", async () => {
  await saveSettings({ apiKey: "k" });
  render(<QuizSession />);
  await screen.findByText(/문제 준비 중이에요/);
  await db.quizzes.add({
    lectureNo: 1, kind: "new", question: "Fresh question?", choices: ["a", "b", "c", "d"],
    answerIndex: 0, explanationKo: "", createdAt: "2026-11-17",
  });
  window.dispatchEvent(new Event(PREFETCHED_EVENT));
  expect(await screen.findByText("Fresh question?")).toBeTruthy();
});
