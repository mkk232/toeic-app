import { useEffect, useState } from "preact/hooks";
import { getSettings } from "../db";
import { getLastPrefetch, PREFETCHED_EVENT } from "../prefetch";

const WAITING = "문제 준비 중이에요. 인터넷이 되면 자동으로 받아요.";

/** 풀 문제가 없을 때 그 이유를 한 문장으로: 키 없음 → 마지막 오류 → 준비 중 */
export function useEmptyReason(): string {
  const [reason, setReason] = useState(WAITING);
  useEffect(() => {
    const check = async () => {
      const [{ apiKey }, last] = await Promise.all([getSettings(), getLastPrefetch()]);
      setReason(!apiKey ? "설정에서 API 키를 넣어 주세요." : last?.error ? `${WAITING} (마지막 시도: ${last.error})` : WAITING);
    };
    check();
    window.addEventListener(PREFETCHED_EVENT, check);
    return () => window.removeEventListener(PREFETCHED_EVENT, check);
  }, []);
  return reason;
}
