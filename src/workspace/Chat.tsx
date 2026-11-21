import { Fragment, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dot, Icon } from "@/components/ui";
import { agentColor, hhmmss, useWS, type Msg } from "./store";
import { cn } from "@/utils/cn";

function Text({ t }: { t: string }) {
  return (
    <>
      {t.split(/(@\w+|`[^`]+`)/g).map((p, i) =>
        p.startsWith("@") ? (
          <span key={i} className="font-semibold text-signal-dark">{p}</span>
        ) : p.startsWith("`") ? (
          <code key={i} className="bg-paper-3 px-1 font-mono text-[0.85em]">{p.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Row({ m }: { m: Msg }) {
  if (m.kind === "system")
    return (
      <motion.li layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="my-3 flex items-center gap-3">
        <span className="hatch h-px flex-1 border-t border-dashed border-ink/30" />
        <span className="label max-w-[80%] text-center text-mute">{m.text}</span>
        <span className="h-px flex-1 border-t border-dashed border-ink/30" />
      </motion.li>
    );
  const mine = m.kind === "human";
  return (
    <motion.li layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }} className="grid grid-cols-[2.25rem_1fr] gap-3 py-2.5">
      <span className="mt-0.5 grid h-9 w-9 place-items-center font-display text-sm font-bold uppercase text-paper" style={{ background: agentColor(m.from) }}>{m.from[0]}</span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[14px] font-semibold">{m.from}</span>
          <span className="label text-mute">{hhmmss(m.at)}</span>
          {m.tool && <span className="label border border-ink/25 px-1.5 text-[9.5px] text-mute">{m.tool}</span>}
          {mine && <span className="label text-[9.5px] text-signal-dark">human</span>}
        </p>
        <p className="mt-0.5 break-words text-[15px] leading-[1.6] text-ink-3"><Text t={m.text} /></p>
      </div>
    </motion.li>
  );
}

export function Chat() {
  const { rooms, msgs, agents, typing, sendHuman, pauseRoom, resumeRoom, runaway, replay, scenarioDone, settings } = useWS();
  const [roomId, setRoomId] = useState("launch");
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const room = rooms.find((r) => r.id === roomId)!;
  const list = msgs.filter((m) => m.room === roomId);
  const typingHere = typing?.room === roomId ? typing.agent : null;
  const limit = settings.hopLimit;

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [list.length, typingHere, roomId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    sendHuman(roomId, text);
    setText("");
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] lg:grid-cols-[13rem_1fr_17rem] lg:grid-rows-1">
      {/* rooms */}
      <aside className="thin-scroll light flex gap-1 overflow-x-auto border-b border-ink/20 p-2 lg:block lg:overflow-visible lg:border-b-0 lg:border-r lg:p-4">
        <p className="label mb-3 hidden text-mute lg:block">Rooms</p>
        {rooms.map((r) => (
          <button key={r.id} onClick={() => setRoomId(r.id)} className={cn("relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-left text-[14px] lg:w-full", r.id === roomId ? "font-semibold text-paper" : "hover:bg-paper-2")}>
            {r.id === roomId && <motion.span layoutId="room-bg" className="absolute inset-0 bg-ink" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}
            <Icon name="hash" size={14} className="relative" />
            <span className="relative flex-1">{r.name}</span>
            {r.paused && <span className="relative h-2 w-2 bg-signal" title="paused" />}
          </button>
        ))}
      </aside>

      {/* thread */}
      <section className="flex min-h-0 flex-col lg:border-r lg:border-ink/20">
        <header className="flex items-center justify-between gap-4 border-b border-ink/20 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="font-display truncate text-2xl font-bold leading-none"># {room.name}</h2>
            <p className="mt-1 truncate text-[13px] text-mute">{room.topic}</p>
          </div>
          <AnimatePresence>
            {room.paused && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="label shrink-0 bg-signal px-2.5 py-1.5 text-ink">
                paused{room.reason === "loop_guard" ? " · loop guard" : ""}
              </motion.span>
            )}
          </AnimatePresence>
        </header>

        <div ref={box} className="thin-scroll light min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <ul>
            <AnimatePresence initial={false}>{list.map((m) => <Row key={m.id} m={m} />)}</AnimatePresence>
          </ul>
          <AnimatePresence>
            {typingHere && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-3 pl-1">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="h-2 w-2 bg-ink" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
                  ))}
                </span>
                <span className="label text-mute">{typingHere} is writing</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form onSubmit={submit} className="border-t border-ink/20 p-3">
          <div className="flex items-stretch border border-ink focus-within:border-signal">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message #${room.name} — mention an agent with @builder`} aria-label="Message" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-mute" />
            <button className="grid w-14 place-items-center bg-ink text-paper transition-colors hover:bg-signal hover:text-ink disabled:opacity-40" disabled={!text.trim()} aria-label="Send">
              <Icon name="send" size={18} />
            </button>
          </div>
        </form>
      </section>

      {/* context */}
      <aside className="thin-scroll light hidden overflow-y-auto p-5 lg:block">
        <p className="label text-mute">Loop guard</p>
        <p className="font-display mt-1 text-5xl font-extrabold leading-none tabular-nums">
          {room.hops}
          <span className="text-xl text-mute">/{limit}</span>
        </p>
        <div className="mt-3 flex gap-[2px]">
          {Array.from({ length: limit }).map((_, i) => (
            <motion.span key={i} className="h-3 flex-1" animate={{ backgroundColor: i < room.hops ? (i >= limit * 0.8 ? "#FF4A1C" : "#14130F") : "rgba(20,19,15,0.12)" }} />
          ))}
        </div>

        <div className="mt-5 grid gap-2">
          {room.paused ? (
            <button onClick={() => resumeRoom(room.id)} className="flex items-center justify-center gap-2 bg-ink px-3 py-2.5 text-[13px] font-semibold text-paper transition-colors hover:bg-signal hover:text-ink">
              <Icon name="play" size={14} /> Resume room
            </button>
          ) : (
            <button onClick={() => pauseRoom(room.id)} className="flex items-center justify-center gap-2 border border-ink px-3 py-2.5 text-[13px] font-semibold transition-colors hover:bg-ink hover:text-paper">
              <Icon name="pause" size={14} /> Pause room
            </button>
          )}
          {roomId === "launch" && (
            <>
              <button onClick={runaway} disabled={room.paused} className="border border-signal px-3 py-2.5 text-[13px] font-semibold text-signal-dark transition-colors hover:bg-signal hover:text-ink disabled:opacity-40">
                Simulate runaway loop
              </button>
              {scenarioDone && (
                <button onClick={replay} className="border border-ink px-3 py-2.5 text-[13px] font-semibold transition-colors hover:bg-ink hover:text-paper">
                  Replay scenario
                </button>
              )}
            </>
          )}
        </div>

        <p className="label mb-3 mt-8 text-mute">Members</p>
        <ul className="space-y-3">
          {agents.filter((a) => a.state !== "offline").map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span className="mt-1.5"><Dot state={a.paused ? "idle" : a.state} /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold leading-tight">{a.name}</span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={a.activity + a.state} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="label block truncate text-[10px] text-mute">
                    {a.paused ? "paused" : a.state} · {a.activity}
                  </motion.span>
                </AnimatePresence>
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
