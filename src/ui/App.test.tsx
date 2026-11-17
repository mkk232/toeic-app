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
