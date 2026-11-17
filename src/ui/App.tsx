import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import { Settings } from "./Settings";

export type Route = "/" | "/vocab" | "/lectures" | "/quiz" | "/listening" | "/wrong" | "/settings";

function currentRoute(): Route {
  const r = window.location.hash.replace(/^#/, "") || "/";
  return (ROUTES as Record<string, unknown>)[r] ? (r as Route) : "/";
}

export function go(route: Route) {
  window.location.hash = `#${route}`;
}

function Placeholder({ title }: { title: string }) {
  return (
    <main class="screen">
      <h1>{title}</h1>
      <p class="muted">준비 중이에요.</p>
      <a class="back" href="#/">← 홈</a>
    </main>
  );
}

const ROUTES: Record<Route, ComponentType> = {
  "/": () => <Placeholder title="오늘 할 일" />,
  "/vocab": () => <Placeholder title="단어" />,
  "/lectures": () => <Placeholder title="강의" />,
  "/quiz": () => <Placeholder title="강의 복습" />,
  "/listening": () => <Placeholder title="듣기" />,
  "/wrong": () => <Placeholder title="오답 노트" />,
  "/settings": Settings,
};

export function App() {
  const [route, setR] = useState<Route>(currentRoute());
  useEffect(() => {
    const onHash = () => setR(currentRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const Screen = ROUTES[route];
  return <Screen />;
}
