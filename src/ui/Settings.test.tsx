import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/preact";
import { db } from "../db";
import { TOPUP_EVENT } from "../prefetchSignal";
import { Settings } from "./Settings";

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(cleanup);

test("키를 저장하면 바로 문제 받기를 요청함", async () => {
  let asked = 0;
  const on = () => asked++;
  window.addEventListener(TOPUP_EVENT, on);
  render(<Settings />);
  fireEvent.input(await screen.findByLabelText("키 붙여 넣기"), { target: { value: "k-1" } });
  fireEvent.click(screen.getByRole("button", { name: "키 저장" }));
  await waitFor(() => expect(asked).toBe(1));
  window.removeEventListener(TOPUP_EVENT, on);
});
