import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type AgentState = "waiting" | "working" | "blocked" | "offline";
export interface Agent { id: string; name: string; client: string; state: AgentState; activity: string; since: number; paused: boolean; tokenPrefix: string }
export interface Msg { id: string; room: string; from: string; kind: "agent" | "human" | "system"; text: string; at: number; tool?: string }
export type TaskStatus = "queued" | "in_progress" | "blocked" | "done";
export interface Task { id: string; title: string; assignee: string; status: TaskStatus; room: string }
export interface Req { id: string; from: string; question: string; options: string[]; urgency: "low" | "normal" | "high"; answer?: string; at: number }
export interface Act { id: string; at: number; agent: string; tool: string; ok: boolean; ms: number; note: string }
export interface Room { id: string; name: string; topic: string; hops: number; paused: boolean; reason?: "loop_guard" | "manual" }
export interface Settings { hopLimit: number; msgsPerMin: number; leaseSec: number; hidePayloads: boolean; wakeAll: boolean }

const now = () => Date.now();
const rid = (p: string) => p + Math.random().toString(36).slice(2, 8);
const rand = (a: number, b: number) => Math.round(a + Math.random() * (b - a));

interface Step { from: string; text: string; states?: Record<string, [AgentState, string]>; task?: { create?: string; assignee?: string; set?: TaskStatus }; request?: boolean; needsAnswer?: boolean }

const script: Step[] = [
  { from: "planner", text: "Pricing spec is final. @builder please build /pricing with three tiers — details are in the task.", states: { planner: ["waiting", "wait_for_message"], builder: ["working", "reading task"] }, task: { create: "Build /pricing page (3 tiers)", assignee: "builder" } },
  { from: "builder", text: "Picked it up. Scaffolding the tier cards and the billing toggle.", states: { builder: ["working", "coding /pricing"] }, task: { set: "in_progress" } },
  { from: "builder", text: "Preview is up at /pricing. @reviewer can you check layout and accessibility?", states: { builder: ["waiting", "wait_for_message"], reviewer: ["working", "reviewing preview"] } },
  { from: "reviewer", text: "Two issues: the billing toggle has no accessible label, and the Pro badge fails contrast (3.1 : 1).", states: { reviewer: ["waiting", "wait_for_message"], builder: ["working", "fixing a11y"] }, task: { set: "blocked" } },
  { from: "builder", text: "Both fixed in two commits. @reviewer please look again.", states: { builder: ["waiting", "wait_for_message"], reviewer: ["working", "re-reviewing"] }, task: { set: "in_progress" } },
  { from: "reviewer", text: "Approved from my side. One thing I can't decide myself — the Pro-tier headline. Asking the human.", states: { reviewer: ["blocked", "waiting for a human"] }, request: true, needsAnswer: true },
  { from: "planner", text: "", states: { reviewer: ["waiting", "wait_for_message"], planner: ["working", "closing task"] }, task: { set: "done" } },
];

const seedAgents: Agent[] = [
  { id: "a1", name: "planner", client: "Claude Code", state: "waiting", activity: "wait_for_message", since: now() - 7_931_000, paused: false, tokenPrefix: "ar_live_k3Qx" },
  { id: "a2", name: "builder", client: "Codex CLI", state: "waiting", activity: "wait_for_message", since: now() - 2_042_000, paused: false, tokenPrefix: "ar_live_9fTa" },
  { id: "a3", name: "reviewer", client: "OpenCode", state: "waiting", activity: "wait_for_message", since: now() - 18_377_000, paused: false, tokenPrefix: "ar_live_Zm2d" },
  { id: "a4", name: "scribe", client: "Qoder", state: "offline", activity: "last seen 14 min ago", since: now() - 840_000, paused: false, tokenPrefix: "ar_live_p0Lw" },
];

const seedRooms: Room[] = [
  { id: "launch", name: "launch", topic: "Ship the new pricing page", hops: 0, paused: false },
  { id: "research", name: "research", topic: "Competitor teardown, notes and sources", hops: 0, paused: false },
  { id: "general", name: "general", topic: "Everyone, everything else", hops: 0, paused: false },
];

const t0 = now();
const seedMsgs: Msg[] = [
  { id: "m1", room: "general", from: "system", kind: "system", text: "Room #general created", at: t0 - 3_600_000 },
  { id: "m2", room: "research", from: "scribe", kind: "agent", text: "Collected 12 sources on usage-based pricing. Summary is in the artifact `pricing-notes.md`.", at: t0 - 1_200_000, tool: "upload_artifact" },
  { id: "m3", room: "research", from: "you", kind: "human", text: "Thanks. Focus on how they handle overage.", at: t0 - 1_100_000 },
  { id: "m4", room: "launch", from: "system", kind: "system", text: "Room #launch created · planner, builder, reviewer joined", at: t0 - 20_000 },
  { id: "m5", room: "launch", from: "you", kind: "human", text: "Goal this week: ship the new pricing page. Keep me posted and ask when you need a decision.", at: t0 - 8_000 },
];

const seedTasks: Task[] = [
  { id: "t0", title: "Summarise competitor pricing", assignee: "scribe", status: "done", room: "research" },
  { id: "t00", title: "Collect overage policies", assignee: "scribe", status: "in_progress", room: "research" },
];

const seedAct: Act[] = [
  { id: "x1", at: t0 - 30_000, agent: "builder", tool: "wait_for_message", ok: true, ms: 2_042_113, note: "waiting" },
  { id: "x2", at: t0 - 60_000, agent: "reviewer", tool: "wait_for_message", ok: true, ms: 18_377_041, note: "waiting" },
  { id: "x3", at: t0 - 140_000, agent: "planner", tool: "send_message", ok: false, ms: 4, note: "rate_limited · retry_after 12" },
];

interface Ctx {
  agents: Agent[]; rooms: Room[]; msgs: Msg[]; tasks: Task[]; reqs: Req[]; acts: Act[]; settings: Settings;
  typing: { room: string; agent: string } | null;
  scenarioDone: boolean; running: boolean;
  sendHuman: (room: string, text: string) => void;
  pauseRoom: (id: string) => void; resumeRoom: (id: string) => void;
  runaway: () => void; replay: () => void;
  pauseAgent: (id: string) => void; wakeAgent: (id: string) => void; rotateToken: (id: string) => string;
  addAgent: (name: string, client: string) => string;
  addTask: (title: string, assignee: string, room: string) => void;
  moveTask: (id: string, s: TaskStatus) => void;
  answer: (id: string, a: string) => void;
  setSettings: (s: Partial<Settings>) => void;
}

const C = createContext<Ctx | null>(null);
export const useWS = () => useContext(C)!;

export const newToken = () => "ar_live_" + Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[rand(0, 61)]).join("");

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState(seedAgents);
  const [rooms, setRoomsS] = useState(seedRooms);
  const [msgs, setMsgs] = useState(seedMsgs);
  const [tasks, setTasks] = useState(seedTasks);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [acts, setActs] = useState(seedAct);
  const [settings, setSettingsS] = useState<Settings>({ hopLimit: 20, msgsPerMin: 60, leaseSec: 120, hidePayloads: false, wakeAll: true });
  const [typing, setTyping] = useState<Ctx["typing"]>(null);
  const [scenarioDone, setDone] = useState(false);
  const [running, setRunning] = useState(false);

  const R = useRef({ rooms: seedRooms, settings, reqs: [] as Req[], tasks: seedTasks, agents: seedAgents });
  R.current.settings = settings;
  R.current.reqs = reqs;
  R.current.tasks = tasks;
  R.current.agents = agents;
  const step = useRef(0);
  const taskId = useRef<string | null>(null);
  const runawayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const setRooms = useCallback((fn: (r: Room[]) => Room[]) => {
    R.current.rooms = fn(R.current.rooms);
    setRoomsS(R.current.rooms);
  }, []);

  const act = useCallback((agent: string, tool: string, ok = true, note = "", ms = rand(12, 140)) => {
    setActs((a) => [{ id: rid("x"), at: now(), agent, tool, ok, ms, note }, ...a].slice(0, 80));
  }, []);

  const setState = useCallback((name: string, st: AgentState, activity: string) => {
    setAgents((as) => as.map((a) => (a.name === name && a.state !== "offline" ? { ...a, state: st, activity, since: now() } : a)));
  }, []);

  /** the single place where messages enter a room (mirrors sendMessage on the server) */
  const post = useCallback((room: string, from: string, kind: Msg["kind"], text: string, tool?: string): boolean => {
    const r = R.current.rooms.find((x) => x.id === room);
    if (!r) return false;
    if (kind === "agent" && r.paused) {
      act(from, "send_message", false, "room_paused", 3);
      return false;
    }
    const m: Msg = { id: rid("m"), room, from, kind, text, at: now(), tool };
    setMsgs((x) => [...x, m]);
    if (kind === "agent") {
      const hops = r.hops + 1;
      const limit = R.current.settings.hopLimit;
      act(from, tool ?? "send_message", true, text.slice(0, 48));
      if (hops >= limit) {
        setRooms((rs) => rs.map((x) => (x.id === room ? { ...x, hops, paused: true, reason: "loop_guard" } : x)));
        setMsgs((x) => [...x, { id: rid("m"), room, from: "system", kind: "system", text: `Hop limit (${limit}) reached — room paused by loop guard. Post a message to resume.`, at: now() }]);
        if (runawayTimer.current) { clearInterval(runawayTimer.current); runawayTimer.current = null; }
      } else {
        setRooms((rs) => rs.map((x) => (x.id === room ? { ...x, hops } : x)));
      }
    } else if (kind === "human") {
      act("you", "dashboard.post", true, text.slice(0, 48));
      const wasGuard = r.paused && r.reason === "loop_guard";
      setRooms((rs) => rs.map((x) => (x.id === room ? { ...x, hops: 0, paused: wasGuard ? false : x.paused } : x)));
      if (wasGuard) setMsgs((x) => [...x, { id: rid("m"), room, from: "system", kind: "system", text: "Human message received — counter reset, room resumed.", at: now() }]);
    }
    return true;
  }, [act, setRooms]);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  /* -------- scripted scenario in #launch -------- */
  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!alive) return;
      const s = step.current;
      const launch = R.current.rooms.find((r) => r.id === "launch")!;
      const gate = s > 0 && script[s - 1].needsAnswer && !R.current.reqs.find((q) => q.from === "reviewer" && q.answer);
      if (s >= script.length || launch.paused || gate || runawayTimer.current) {
        if (s >= script.length) setRunning(false);
        t = setTimeout(loop, 1200);
        return;
      }
      setRunning(true);
      const st = script[s];
      setTyping({ room: "launch", agent: st.from });
      t = setTimeout(() => {
        if (!alive) return;
        setTyping(null);
        let text = st.text;
        if (!text) {
          const ans = R.current.reqs.find((q) => q.from === "reviewer" && q.answer)?.answer ?? "approved";
          text = `Human answered “${ans}”. Closing the task — thanks both.`;
        }
        const ok = post("launch", st.from, "agent", text, "send_message");
        if (ok) {
          if (st.states) Object.entries(st.states).forEach(([n, [s2, a]]) => setState(n, s2, a));
          if (st.task?.create) {
            const id = rid("t");
            taskId.current = id;
            setTasks((x) => [{ id, title: st.task!.create!, assignee: st.task!.assignee!, status: "queued", room: "launch" }, ...x]);
            act(st.from, "create_task", true, st.task.create);
          }
          if (st.task?.set && taskId.current) {
            const id = taskId.current;
            setTasks((x) => x.map((k) => (k.id === id ? { ...k, status: st.task!.set! } : k)));
            act(st.from, "update_task", true, st.task.set);
          }
          if (st.request) {
            setReqs((q) => [{ id: rid("q"), from: st.from, question: "Approve the Pro-tier headline: “Ship faster with agents that never sleep”?", options: ["Approve", "Needs changes"], urgency: "normal", at: now() }, ...q]);
            act(st.from, "request_human_input", true, "Pro-tier headline");
          }
          step.current = s + 1;
          if (step.current >= script.length) {
            later(() => { post("launch", "system", "system", "Scenario finished — every agent is back in wait_for_message."); setDone(true); }, 900);
          }
        }
        t = setTimeout(loop, 3400);
      }, 1500);
    };
    t = setTimeout(loop, 2600);
    const ts = timers.current;
    return () => {
      alive = false;
      clearTimeout(t);
      ts.forEach(clearTimeout);
      if (runawayTimer.current) clearInterval(runawayTimer.current);
    };
  }, [post, setState, act, later]);

  /* -------- actions -------- */
  const sendHuman = useCallback((room: string, text: string) => {
    const t = text.trim();
    if (!t) return;
    post(room, "you", "human", t);
    const mention = /@(\w+)/.exec(t)?.[1];
    const target = R.current.agents.find((a) => a.name === mention && a.state !== "offline") ?? R.current.agents.find((a) => a.name === "planner")!;
    if (target.paused) return;
    later(() => {
      setTyping({ room, agent: target.name });
      setState(target.name, "working", "reading message");
      act(target.name, "wait_for_message", true, "message", rand(800, 4000));
      later(() => {
        setTyping(null);
        post(room, target.name, "agent", `Got it — “${t.length > 56 ? t.slice(0, 56) + "…" : t}”. I'll pick that up and report back here.`, "send_message");
        act(target.name, "ack_message", true, "1 item", 9);
        later(() => setState(target.name, "waiting", "wait_for_message"), 1600);
      }, 1700);
    }, 700);
  }, [post, later, setState, act]);

  const pauseRoom = useCallback((id: string) => {
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, paused: true, reason: "manual" } : r)));
    setMsgs((x) => [...x, { id: rid("m"), room: id, from: "system", kind: "system", text: "Room paused by operator. Only Resume reopens it.", at: now() }]);
    if (runawayTimer.current) { clearInterval(runawayTimer.current); runawayTimer.current = null; }
  }, [setRooms]);
  const resumeRoom = useCallback((id: string) => {
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, paused: false, reason: undefined, hops: 0 } : r)));
    setMsgs((x) => [...x, { id: rid("m"), room: id, from: "system", kind: "system", text: "Room resumed by operator.", at: now() }]);
  }, [setRooms]);

  const runaway = useCallback(() => {
    if (runawayTimer.current) return;
    const lines = ["Acknowledged. Continuing with your point.", "Agreed — let me double-check that.", "Thanks, I'll take another look.", "Makes sense, circling back."];
    let i = 0;
    setState("builder", "working", "answering reviewer");
    setState("reviewer", "working", "answering builder");
    runawayTimer.current = setInterval(() => {
      const who = i % 2 === 0 ? "builder" : "reviewer";
      post("launch", who, "agent", `@${who === "builder" ? "reviewer" : "builder"} ${lines[i % lines.length]}`, "send_message");
      i++;
      if (R.current.rooms.find((r) => r.id === "launch")!.paused) {
        setState("builder", "waiting", "wait_for_message");
        setState("reviewer", "waiting", "wait_for_message");
      }
    }, 520);
  }, [post, setState]);

  const replay = useCallback(() => {
    step.current = 0;
    taskId.current = null;
    setDone(false);
    setReqs([]);
    post("launch", "you", "human", "New goal: let's run the pricing page flow again, start from the spec.");
  }, [post]);

  const pauseAgent = useCallback((id: string) => setAgents((as) => as.map((a) => (a.id === id ? { ...a, paused: !a.paused, state: a.paused ? "waiting" : a.state } : a))), []);
  const wakeAgent = useCallback((id: string) => {
    const a = R.current.agents.find((x) => x.id === id);
    if (!a) return;
    setState(a.name, "working", "woken by operator");
    act(a.name, "wait_for_message", true, "interrupted · wake", 5);
    later(() => setState(a.name, "waiting", "wait_for_message"), 1800);
  }, [setState, act, later]);
  const rotateToken = useCallback((id: string) => {
    const tok = newToken();
    setAgents((as) => as.map((a) => (a.id === id ? { ...a, tokenPrefix: tok.slice(0, 12) } : a)));
    return tok;
  }, []);
  const addAgent = useCallback((name: string, client: string) => {
    const tok = newToken();
    setAgents((as) => [...as, { id: rid("a"), name, client, state: "offline", activity: "never connected", since: now(), paused: false, tokenPrefix: tok.slice(0, 12) }]);
    return tok;
  }, []);
  const addTask = useCallback((title: string, assignee: string, room: string) => {
    setTasks((x) => [{ id: rid("t"), title, assignee, status: "queued", room }, ...x]);
    act("you", "create_task", true, title);
  }, [act]);
  const moveTask = useCallback((id: string, s: TaskStatus) => setTasks((x) => x.map((t) => (t.id === id ? { ...t, status: s } : t))), []);
  const answer = useCallback((id: string, a: string) => {
    setReqs((q) => q.map((r) => (r.id === id ? { ...r, answer: a } : r)));
    act("you", "human_requests.answer", true, a);
    post("launch", "you", "human", `Answer to reviewer: ${a}`);
  }, [act, post]);
  const setSettings = useCallback((s: Partial<Settings>) => setSettingsS((x) => ({ ...x, ...s })), []);

  const value = useMemo<Ctx>(() => ({ agents, rooms, msgs, tasks, reqs, acts, settings, typing, scenarioDone, running, sendHuman, pauseRoom, resumeRoom, runaway, replay, pauseAgent, wakeAgent, rotateToken, addAgent, addTask, moveTask, answer, setSettings }), [agents, rooms, msgs, tasks, reqs, acts, settings, typing, scenarioDone, running, sendHuman, pauseRoom, resumeRoom, runaway, replay, pauseAgent, wakeAgent, rotateToken, addAgent, addTask, moveTask, answer, setSettings]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export const hhmmss = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false });
export const agentColor = (name: string) => ({ planner: "#14130F", builder: "#FF4A1C", reviewer: "#2E7D4F", scribe: "#B7791F", you: "#6A6558" } as Record<string, string>)[name] ?? ["#3A372F", "#D93A10", "#1F6F8B", "#7A4E9A"][name.length % 4];
