export type Route = "/" | "/vocab" | "/lectures" | "/quiz" | "/listening" | "/wrong" | "/settings";

export function go(route: Route) {
  window.location.hash = `#${route}`;
}
