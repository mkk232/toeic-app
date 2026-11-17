import { render, screen, act, cleanup } from "@testing-library/preact";
import { App } from "./App";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

test("기본 화면은 오늘 할 일", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "오늘 할 일" })).toBeTruthy();
});

test("단어가 없으면 엑셀 안내, 키가 없으면 키 안내", async () => {
  render(<App />);
  expect(await screen.findByText("설정에서 단어 엑셀을 불러와 주세요.")).toBeTruthy();
  expect(await screen.findByText("설정에서 API 키를 넣어 주세요.")).toBeTruthy();
});

test("홈 숫자: 새 단어 수가 보임", async () => {
  const { db } = await import("../db");
  await db.words.bulkPut(Array.from({ length: 3 }, (_, i) => ({ id: `1-${i}`, day: 1, index: i, word: `w${i}`, meaning: "뜻" })));
  render(<App />);
  expect(await screen.findByText("새 단어")).toBeTruthy();
  expect(await screen.findByText("3개")).toBeTruthy();
  await db.words.clear();
});

test("#/settings 로 가면 설정 화면", async () => {
  render(<App />);
  await act(() => {
    window.location.hash = "#/settings";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(screen.getByRole("heading", { name: "설정" })).toBeTruthy();
});

test("설정 화면에 API 키 입력칸과 엑셀 불러오기가 있다", async () => {
  window.location.hash = "#/settings";
  render(<App />);
  expect(screen.getByLabelText("키 붙여 넣기")).toBeTruthy();
  expect(screen.getByLabelText("엑셀 불러오기")).toBeTruthy();
});
