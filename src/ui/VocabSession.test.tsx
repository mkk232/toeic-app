import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/preact";
import { db } from "../db";
import { VocabSession } from "./VocabSession";

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.words.bulkPut([
    { id: "1-0", day: 1, index: 0, word: "resume", meaning: "이력서" },
    { id: "1-1", day: 1, index: 1, word: "applicant", meaning: "지원자, 신청자" },
  ]);
});
afterEach(cleanup);

async function flip() {
  fireEvent.click(await screen.findByRole("button", { name: /뜻 보기/ }));
}

test("모름 카드는 세션 끝에 한 번 더, 다 끝나면 완료 화면", async () => {
  render(<VocabSession />);
  expect(await screen.findByText("resume")).toBeTruthy();
  await flip();
  expect(screen.getByText("이력서")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "모름" }));

  expect(await screen.findByText("applicant")).toBeTruthy();
  await flip();
  fireEvent.click(screen.getByRole("button", { name: "앎" }));

  expect(await screen.findByText("resume")).toBeTruthy();
  await flip();
  fireEvent.click(screen.getByRole("button", { name: "앎" }));

  expect(await screen.findByText("오늘 단어 끝!")).toBeTruthy();
  await waitFor(async () => expect(await db.cards.count()).toBe(2));
});

test("단어가 없으면 엑셀 안내", async () => {
  await db.words.clear();
  render(<VocabSession />);
  expect(await screen.findByText(/설정에서 단어 엑셀/)).toBeTruthy();
});
