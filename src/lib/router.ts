import { useEffect, useState } from "react";

export type Route = "/" | "/how-to-use" | "/docs" | "/architecture" | "/sign-in" | "/workspace" | "/404";

const known: Route[] = ["/", "/how-to-use", "/docs", "/architecture", "/sign-in", "/workspace"];

function parse(): { route: Route; hash: string } {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, anchor = ""] = raw.split("#");
  const clean = ("/" + path.replace(/^\/+/, "")).replace(/\/+$/, "") || "/";
  const route = (known as string[]).includes(clean) ? (clean as Route) : "/404";
  return { route, hash: anchor };
}

export function useRoute() {
  const [state, setState] = useState(parse);
  useEffect(() => {
    const on = () => setState(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return state;
}

export function go(to: string) {
  window.location.hash = to;
}
