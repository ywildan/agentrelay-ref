import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { clients } from "@/lib/data";
import { CodeBlock, Dot, Icon } from "@/components/ui";
import { hhmmss, useWS, type TaskStatus } from "./store";
import { cn } from "@/utils/cn";

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
}
const dur = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0")).join(":");
};

function Page({ title, sub, action, children }: { title: string; sub: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="thin-scroll light h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-5">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-none">{title}</h1>
            <p className="mt-2 text-[14.5px] text-mute">{sub}</p>
          </div>
          {action}
        </header>
        {children}
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4" onClick={onClose}>
          <motion.div role="dialog" aria-label={title} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-ink bg-paper">
            <div className="flex items-center justify-between border-b border-ink px-5 py-3">
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center hover:bg-ink hover:text-paper"><Icon name="close" size={16} /></button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const btn = "border border-ink px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-ink hover:text-paper";
const field = "w-full border-b-2 border-ink bg-transparent py-2 text-[15px] outline-none focus:border-signal";

/* ------------------------------------------------------------- agents */
export function Agents() {
  useTick();
  const { agents, pauseAgent, wakeAgent, rotateToken, addAgent } = useWS();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState(clients[0].id);
  const [token, setToken] = useState<{ who: string; tok: string } | null>(null);
  const c = clients.find((x) => x.id === client)!;

  return (
    <Page title="Agents" sub="Presence is live: online if a wait is open or seen under 60 s ago." action={<button onClick={() => setOpen(true)} className="bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-signal hover:text-ink">New agent</button>}>
      <ul className="mt-2">
        <AnimatePresence initial={false}>
          {agents.map((a) => (
            <motion.li key={a.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 border-b border-ink/25 py-5 md:grid-cols-[1.4fr_1.4fr_auto_auto] md:items-center">
              <div className="flex items-center gap-4">
                <Dot state={a.paused ? "idle" : a.state} />
                <div>
                  <p className="font-display text-2xl font-bold leading-none">{a.name}</p>
                  <p className="label mt-1 text-mute">{a.client} · {a.tokenPrefix}…</p>
                </div>
              </div>
              <div>
                <p className="label text-mute">{a.paused ? "paused" : a.state}</p>
                <p className="text-[14px]">{a.activity}</p>
              </div>
              <p className="font-mono text-[15px] tabular-nums text-ink-3">{a.state === "offline" ? "—" : dur(Date.now() - a.since)}</p>
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => wakeAgent(a.id)} disabled={a.state === "offline" || a.paused}>Wake</button>
                <button className={btn} onClick={() => pauseAgent(a.id)}>{a.paused ? "Resume" : "Pause"}</button>
                <button className={btn} onClick={() => setToken({ who: a.name, tok: rotateToken(a.id) })}>Rotate token</button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <Modal open={open && !token} onClose={() => setOpen(false)} title="New agent">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const tok = addAgent(name.trim().toLowerCase().replace(/\s+/g, "-"), c.label);
            setToken({ who: name.trim(), tok });
            setName("");
          }}
          className="space-y-5"
        >
          <label className="block"><span className="label text-mute">Name</span><input autoFocus className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. deployer" /></label>
          <label className="block"><span className="label text-mute">Runs in</span>
            <select className={cn(field, "bg-paper")} value={client} onChange={(e) => setClient(e.target.value)}>{clients.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
          </label>
          <button className="w-full bg-ink px-4 py-3 text-[14px] font-semibold text-paper transition-colors hover:bg-signal hover:text-ink">Create agent and token</button>
        </form>
      </Modal>

      <Modal open={!!token} onClose={() => { setToken(null); setOpen(false); }} title={`Token for ${token?.who ?? ""}`}>
        {token && (
          <div className="space-y-4">
            <p className="border-l-4 border-signal bg-signal/10 px-3 py-2 text-[13.5px]">Copy it now. It is shown once; only a hash is stored.</p>
            <CodeBlock title="ar_live token" code={token.tok} />
            <CodeBlock title={c.file} code={c.build("https://relay.example.com/mcp", token.tok)} maxH="max-h-56" />
          </div>
        )}
      </Modal>
    </Page>
  );
}

/* -------------------------------------------------------------- tasks */
const cols: { id: TaskStatus; label: string }[] = [
  { id: "queued", label: "Queued" },
  { id: "in_progress", label: "In progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];
export function Tasks() {
  const { tasks, agents, addTask, moveTask } = useWS();
  const [title, setTitle] = useState("");
  const [who, setWho] = useState("builder");
  return (
    <Page title="Tasks" sub="Delegated work. Agents update these through update_task; you can nudge them here.">
      <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) { addTask(title.trim(), who, "launch"); setTitle(""); } }} className="mt-5 flex flex-wrap items-end gap-4 border border-ink bg-paper-2 p-4">
        <label className="min-w-[14rem] flex-1"><span className="label text-mute">New task</span><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" /></label>
        <label><span className="label block text-mute">Assignee</span>
          <select className={cn(field, "bg-paper-2")} value={who} onChange={(e) => setWho(e.target.value)}>{agents.map((a) => <option key={a.id}>{a.name}</option>)}</select>
        </label>
        <button className="bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-signal hover:text-ink">Create</button>
      </form>

      <LayoutGroup>
        <div className="mt-6 grid gap-px border border-ink bg-ink md:grid-cols-4">
          {cols.map((col, ci) => {
            const items = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="min-h-[16rem] bg-paper p-3">
                <p className="label mb-3 flex justify-between text-mute"><span>{col.label}</span><span className="text-ink">{items.length}</span></p>
                <div className="space-y-2">
                  {items.map((t) => (
                    <motion.div key={t.id} layout layoutId={`task-${t.id}`} transition={{ type: "spring", stiffness: 380, damping: 34 }} className={cn("border border-ink bg-paper-2 p-3", col.id === "blocked" && "border-signal bg-signal/10", col.id === "done" && "opacity-60")}>
                      <p className="text-[14px] font-semibold leading-snug">{t.title}</p>
                      <p className="label mt-2 text-mute">{t.assignee} · #{t.room}</p>
                      <div className="mt-3 flex gap-1.5">
                        <button disabled={ci === 0} onClick={() => moveTask(t.id, cols[ci - 1].id)} className="grid h-7 w-7 place-items-center border border-ink/40 hover:bg-ink hover:text-paper disabled:opacity-25" aria-label="Move left"><Icon name="arrow" size={13} className="rotate-180" /></button>
                        <button disabled={ci === 3} onClick={() => moveTask(t.id, cols[ci + 1].id)} className="grid h-7 w-7 place-items-center border border-ink/40 hover:bg-ink hover:text-paper disabled:opacity-25" aria-label="Move right"><Icon name="arrow" size={13} /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </LayoutGroup>
    </Page>
  );
}

/* ----------------------------------------------------------- requests */
export function Requests() {
  const { reqs, answer } = useWS();
  const pending = reqs.filter((r) => !r.answer);
  const done = reqs.filter((r) => r.answer);
  return (
    <Page title="Requests" sub="Agents ask here through request_human_input. Your answer lands in their inbox.">
      <AnimatePresence initial={false}>
        {pending.length === 0 && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hatch mt-6 border border-dashed border-ink/40 p-10 text-center">
            <p className="font-display text-2xl font-bold">Nothing waiting on you.</p>
            <p className="mx-auto mt-2 max-w-md text-[14.5px] text-mute">In the demo, the reviewer raises a question about the Pro-tier headline a little while after the scenario starts in #launch.</p>
          </motion.div>
        )}
        {pending.map((r) => (
          <motion.div key={r.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="mt-6 border-2 border-signal bg-paper p-6">
            <p className="label flex items-center gap-3 text-signal-dark"><span className="h-2 w-2 bg-signal" /> {r.from} asks · urgency {r.urgency} · {hhmmss(r.at)}</p>
            <p className="font-display mt-3 text-2xl font-bold leading-snug">{r.question}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {r.options.map((o, i) => (
                <button key={o} onClick={() => answer(r.id, o)} className={cn("px-5 py-2.5 text-[14px] font-semibold transition-colors", i === 0 ? "bg-ink text-paper hover:bg-signal hover:text-ink" : "border border-ink hover:bg-ink hover:text-paper")}>{o}</button>
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {done.length > 0 && (
        <>
          <p className="label mb-2 mt-10 text-mute">Answered</p>
          {done.map((r) => (
            <div key={r.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/25 py-3 text-[14.5px]">
              <span className="text-ink-3">{r.question}</span>
              <span className="label bg-ok/15 px-2 py-1 text-ok">{r.answer}</span>
            </div>
          ))}
        </>
      )}
    </Page>
  );
}

/* ----------------------------------------------------------- activity */
export function Activity() {
  const { acts, settings } = useWS();
  const [errOnly, setErrOnly] = useState(false);
  const [dead, setDead] = useState([{ id: "d1", agent: "scribe", note: "redelivered 6× — never acked", at: Date.now() - 3_000_000 }]);
  const list = acts.filter((a) => !errOnly || !a.ok);
  const ms = (n: number) => (n > 60000 ? `${Math.round(n / 60000)} min` : `${n} ms`);
  return (
    <Page title="Activity" sub="Every tool call from every agent, newest first." action={<button className={cn(btn, errOnly && "bg-ink text-paper")} onClick={() => setErrOnly((v) => !v)}>{errOnly ? "Showing errors" : "Errors only"}</button>}>
      <div className="thin-scroll light mt-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead><tr className="label border-b border-ink text-mute"><th className="py-3 font-medium">Time</th><th className="font-medium">Agent</th><th className="font-medium">Tool</th><th className="font-medium">Result</th><th className="font-medium">Took</th><th className="font-medium">Note</th></tr></thead>
          <tbody>
            <AnimatePresence initial={false}>
              {list.slice(0, 40).map((a) => (
                <motion.tr key={a.id} layout initial={{ opacity: 0, backgroundColor: "rgba(255,74,28,0.25)" }} animate={{ opacity: 1, backgroundColor: "rgba(255,74,28,0)" }} transition={{ duration: 0.9 }} className="border-b border-ink/15 text-[13.5px]">
                  <td className="py-2.5 font-mono text-[12px] text-mute">{hhmmss(a.at)}</td>
                  <td className="font-semibold">{a.agent}</td>
                  <td className="font-mono text-[12.5px]">{a.tool}</td>
                  <td><span className={cn("label px-1.5 py-0.5", a.ok ? "text-ok" : "bg-signal text-ink")}>{a.ok ? "ok" : "error"}</span></td>
                  <td className="font-mono text-[12px] text-mute">{ms(a.ms)}</td>
                  <td className="max-w-[18rem] truncate text-ink-3">{settings.hidePayloads ? "hidden" : a.note}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <p className="label mb-2 mt-12 text-mute">Dead letters</p>
      <AnimatePresence>
        {dead.length === 0 && <p className="py-4 text-[14px] text-mute">Empty. Nothing gave up.</p>}
        {dead.map((d) => (
          <motion.div key={d.id} exit={{ opacity: 0, height: 0 }} className="flex flex-wrap items-center justify-between gap-3 overflow-hidden border border-ink bg-paper-2 px-4 py-3">
            <span className="text-[14px]"><span className="font-semibold">{d.agent}</span> · {d.note}</span>
            <span className="flex gap-2"><button className={btn} onClick={() => setDead([])}>Requeue</button><button className={btn} onClick={() => setDead([])}>Discard</button></span>
          </motion.div>
        ))}
      </AnimatePresence>
    </Page>
  );
}

/* ----------------------------------------------------------- settings */
export function Settings() {
  const { settings, setSettings } = useWS();
  const Row = ({ label, hint, children }: { label: string; hint: string; children: ReactNode }) => (
    <div className="grid gap-3 border-b border-ink/25 py-5 md:grid-cols-[1fr_16rem] md:items-center">
      <div><p className="font-display text-xl font-bold">{label}</p><p className="text-[13.5px] text-mute">{hint}</p></div>
      <div>{children}</div>
    </div>
  );
  const Slider = ({ k, min, max, unit }: { k: "hopLimit" | "msgsPerMin" | "leaseSec"; min: number; max: number; unit: string }) => (
    <div className="flex items-center gap-4">
      <input type="range" min={min} max={max} value={settings[k]} onChange={(e) => setSettings({ [k]: +e.target.value })} className="h-1 flex-1 cursor-pointer appearance-none bg-ink/25 accent-[#FF4A1C]" aria-label={k} />
      <span className="w-20 text-right font-mono text-[14px] tabular-nums">{settings[k]}{unit}</span>
    </div>
  );
  const Toggle = ({ k }: { k: "hidePayloads" | "wakeAll" }) => (
    <button role="switch" aria-checked={settings[k]} onClick={() => setSettings({ [k]: !settings[k] })} className={cn("relative h-7 w-14 border border-ink transition-colors", settings[k] ? "bg-ink" : "bg-paper")}>
      <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 34 }} className={cn("absolute top-[3px] h-5 w-5", settings[k] ? "right-[3px] bg-signal" : "left-[3px] bg-ink")} />
    </button>
  );
  return (
    <Page title="Settings" sub="Runtime limits. In the demo, the hop limit applies to the loop guard immediately.">
      <Row label="Hop limit" hint="Agent-to-agent messages before a room pauses."><Slider k="hopLimit" min={4} max={40} unit="" /></Row>
      <Row label="Messages per minute" hint="Per-agent send limit."><Slider k="msgsPerMin" min={10} max={120} unit="/m" /></Row>
      <Row label="Delivery lease" hint="Seconds before an un-acked item is redelivered."><Slider k="leaseSec" min={30} max={300} unit="s" /></Row>
      <Row label="Humans wake all" hint="Human messages wake every member of small rooms."><Toggle k="wakeAll" /></Row>
      <Row label="Hide activity payloads" hint="Keep tool-call notes out of the log."><Toggle k="hidePayloads" /></Row>
    </Page>
  );
}
