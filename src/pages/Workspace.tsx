import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { A, Icon, Mark } from "@/components/ui";
import { WorkspaceProvider, useWS } from "@/workspace/store";
import { Chat } from "@/workspace/Chat";
import { Activity, Agents, Requests, Settings, Tasks } from "@/workspace/Views";
import { cn } from "@/utils/cn";

const nav = [
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "agents", label: "Agents", icon: "user" },
  { id: "tasks", label: "Tasks", icon: "task" },
  { id: "requests", label: "Requests", icon: "bell" },
  { id: "activity", label: "Activity", icon: "pulse" },
  { id: "settings", label: "Settings", icon: "gear" },
] as const;
type View = (typeof nav)[number]["id"];

function Shell() {
  const [view, setView] = useState<View>("chat");
  const { reqs, agents } = useWS();
  const pending = reqs.filter((r) => !r.answer).length;
  const online = agents.filter((a) => a.state !== "offline").length;

  return (
    <div className="flex h-[100dvh] flex-col bg-paper md:flex-row">
      <nav className="order-2 flex shrink-0 border-t border-ink bg-ink text-paper md:order-1 md:w-[84px] md:flex-col md:border-r md:border-t-0" aria-label="Workspace">
        <A to="/" className="hidden items-center justify-center border-b border-paper/15 py-4 md:flex" aria-label="Leave demo">
          <Mark size={32} dark={false} />
        </A>
        <div className="flex flex-1 justify-around md:flex-col md:justify-start md:py-2">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)} aria-current={view === n.id} className={cn("relative flex flex-1 flex-col items-center gap-1 px-1 py-3 text-[10px] font-medium uppercase tracking-wider transition-colors md:flex-none md:py-4", view === n.id ? "text-paper" : "text-paper/50 hover:text-paper")}>
              {view === n.id && <motion.span layoutId="rail" className="absolute bg-paper/10 max-md:inset-x-0 max-md:top-0 max-md:h-[3px] max-md:bg-signal md:inset-0 md:border-l-[3px] md:border-signal" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}
              <span className="relative">
                <Icon name={n.icon} size={20} />
                {n.id === "requests" && pending > 0 && (
                  <motion.span key={pending} initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center bg-signal px-1 font-mono text-[10px] font-bold text-ink">{pending}</motion.span>
                )}
              </span>
              <span className="relative">{n.label}</span>
            </button>
          ))}
        </div>
        <A to="/" className="hidden items-center justify-center gap-1 border-t border-paper/15 py-4 text-[10px] uppercase tracking-wider text-paper/50 hover:text-signal md:flex">
          <Icon name="arrow" size={12} className="rotate-180" /> Exit
        </A>
      </nav>

      <div className="order-1 flex min-h-0 flex-1 flex-col md:order-2">
        <div className="flex items-center justify-between border-b border-ink/20 bg-paper-2 px-5 py-2">
          <span className="label flex items-center gap-2 text-mute"><span className="h-2 w-2 bg-signal" /> demo workspace · simulated</span>
          <span className="label text-mute">{online} agents online</span>
        </div>
        <div className="min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="h-full">
              {view === "chat" && <Chat />}
              {view === "agents" && <Agents />}
              {view === "tasks" && <Tasks />}
              {view === "requests" && <Requests />}
              {view === "activity" && <Activity />}
              {view === "settings" && <Settings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function Workspace() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
