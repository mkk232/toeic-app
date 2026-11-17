import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import { Settings } from "./Settings";
import { VocabSession } from "./VocabSession";
import { Lectures } from "./Lectures";
import { QuizSession } from "./QuizSession";
import { WrongNotes } from "./WrongNotes";
import { ListeningSession } from "./ListeningSession";
import { Home } from "./Home";
import type { Route } from "./nav";

function currentRoute(): Route {
  const r = window.location.hash.replace(/^#/, "") || "/";
  return (ROUTES as Record<string, unknown>)[r] ? (r as Route) : "/";
}

const ROUTES: Record<Route, ComponentType> = {
  "/": Home,
  "/vocab": VocabSession,
  "/lectures": Lectures,
  "/quiz": QuizSession,
  "/listening": ListeningSession,
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
