import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/preact";
import { db } from "../db";
import { TOPUP_EVENT } from "../prefetchSignal";
import { Settings } from "./Settings";

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(cleanup);

test("백업 내보내기: 공유 시트를 쓸 수 있으면 파일로 공유", async () => {
  const shared: any[] = [];
  Object.assign(navigator, {
    canShare: () => true,
    share: async (data: any) => { shared.push(data); },
  });
  render(<Settings />);
  fireEvent.click(await screen.findByRole("button", { name: "백업 내보내기" }));
  await waitFor(() => expect(shared).toHaveLength(1));
  const file: File = shared[0].files[0];
  expect(file.name).toMatch(/^toeic-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(file.type).toBe("application/json");
  delete (navigator as any).canShare;
  delete (navigator as any).share;
});

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
