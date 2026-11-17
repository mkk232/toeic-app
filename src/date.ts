const pad = (n: number) => String(n).padStart(2, "0");

/** 기기 현지 날짜를 YYYY-MM-DD 로. UTC 가 아님. */
export function todayStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** YYYY-MM-DD 에 n 일을 더함(현지 달력 기준). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return todayStr(new Date(y, m - 1, d + n));
}
