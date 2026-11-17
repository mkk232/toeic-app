import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import { Settings } from "./Settings";
import { VocabSession } from "./VocabSession";
import { Lectures } from "./Lectures";
import { QuizSession } from "./QuizSession";
import { WrongNotes } from "./WrongNotes";

import type { Route } from "./nav";

function currentRoute(): Route {
  const r = window.location.hash.replace(/^#/, "") || "/";
  return (ROUTES as Record<string, unknown>)[r] ? (r as Route) : "/";
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
  "/vocab": VocabSession,
  "/lectures": Lectures,
  "/quiz": QuizSession,
  "/listening": () => <Placeholder title="듣기" />,
  "/wrong": WrongNotes,
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
