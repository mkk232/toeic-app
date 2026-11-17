import { render, screen, act, cleanup } from "@testing-library/preact";
import { App } from "./App";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

test("기본 화면은 오늘 할 일", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "오늘 할 일" })).toBeTruthy();
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
