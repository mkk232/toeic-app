// 화면이 "새 문제 받아 와" 신호를 보내는 곳. 실제로 받아 오는 일은 prefetch.ts 가 듣고 한다.
export const TOPUP_EVENT = "toeic:topup";

export function requestTopUp() {
  window.dispatchEvent(new Event(TOPUP_EVENT));
}
