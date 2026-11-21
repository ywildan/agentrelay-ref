import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { A, Dot, Icon, Logo } from "@/components/ui";
import { go } from "@/lib/router";

const agents = [
  { n: "planner", c: "Claude Code", s: 7_931 },
  { n: "builder", c: "Codex CLI", s: 2_042 },
  { n: "reviewer", c: "OpenCode", s: 18_377 },
  { n: "scribe", c: "Qoder", s: 311 },
];
const fmt = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0")).join(":");

export default function SignIn() {
  const [t, setT] = useState(0);
  const [email, setEmail] = useState("demo@agentrelay.dev");
  const [pw, setPw] = useState("demo-password");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => go("/workspace"), 700);
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-paper lg:flex">
        <A to="/" className="inline-block"><Logo dark={false} /></A>

        <div>
          <p className="label text-paper/50">Right now, in your workspace</p>
          <ul className="mt-6 border-t border-paper/20">
            {agents.map((a, i) => (
              <motion.li key={a.n} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }} className="flex items-center justify-between border-b border-paper/20 py-5">
                <span className="flex items-center gap-4">
                  <Dot state="waiting" />
                  <span>
                    <span className="font-display block text-2xl font-bold leading-none">{a.n}</span>
                    <span className="label text-paper/45">{a.c}</span>
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-mono text-2xl tabular-nums">{fmt(a.s + t)}</span>
                  <span className="label block text-signal">waiting · 0 tokens</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="max-w-sm text-[14px] leading-relaxed text-paper/55">Each of these agents has been blocked on one call since the timer started. Nothing is polling.</p>
      </section>

      <section className="flex items-center px-6 py-14 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <A to="/" className="label mb-12 inline-flex items-center gap-2 text-mute hover:text-ink">
            <Icon name="arrow" size={14} className="rotate-180" /> Back to site
          </A>
          <p className="label text-signal">Demo workspace</p>
          <h1 className="font-display mt-3 text-5xl font-extrabold leading-[0.98]">Sign in.</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-3">This is a simulated environment — no account, no server. Credentials are pre-filled; just press the button.</p>

          <form onSubmit={submit} className="mt-10 space-y-5">
            <label className="block">
              <span className="label text-mute">Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full border-b-2 border-ink bg-transparent py-2.5 text-[16px] outline-none transition-colors focus:border-signal" />
            </label>
            <label className="block">
              <span className="label text-mute">Password</span>
              <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} className="mt-2 w-full border-b-2 border-ink bg-transparent py-2.5 text-[16px] outline-none transition-colors focus:border-signal" />
            </label>
            <button disabled={busy} className="group relative mt-4 flex w-full items-center justify-between overflow-hidden bg-ink px-5 py-4 text-[15px] font-semibold text-paper transition-colors hover:bg-signal hover:text-ink">
              <motion.span className="absolute inset-y-0 left-0 bg-signal" initial={{ width: 0 }} animate={{ width: busy ? "100%" : 0 }} transition={{ duration: 0.7, ease: "easeInOut" }} />
              <span className="relative">{busy ? "Opening workspace…" : "Open workspace"}</span>
              <Icon name="arrow" size={18} className="relative transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          <p className="mt-8 flex items-start gap-3 border-t border-ink/20 pt-6 text-[13px] leading-relaxed text-mute">
            <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
            In a real deployment there are no default credentials: the first admin comes from ADMIN_EMAIL / ADMIN_PASSWORD or a one-time setup form.
          </p>
        </div>
      </section>
    </main>
  );
}
