import { useEffect } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRoute } from "@/lib/router";
import { Footer, Nav } from "@/components/Chrome";
import { A } from "@/components/ui";
import Landing from "@/pages/Landing";
import HowToUse from "@/pages/HowToUse";
import Docs from "@/pages/Docs";
import Architecture from "@/pages/Architecture";
import SignIn from "@/pages/SignIn";
import Workspace from "@/pages/Workspace";

function NotFound() {
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-[1280px] place-items-center px-5 pt-24">
      <div className="text-center">
        <p className="label text-signal">Error 404 — no route</p>
        <h1 className="font-display mt-4 text-[clamp(4rem,14vw,10rem)] font-extrabold leading-none">Dropped call.</h1>
        <p className="mx-auto mt-4 max-w-md text-ink-3">That address isn't registered on the switchboard.</p>
        <A to="/" className="mt-8 inline-block bg-ink px-5 py-3 text-[14px] font-semibold text-paper transition-colors hover:bg-signal">Back to start</A>
      </div>
    </main>
  );
}

export default function App() {
  const { route, hash } = useRoute();
  const bare = route === "/workspace" || route === "/sign-in";

  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }), 520);
    return () => clearTimeout(t);
  }, [route, hash]);

  const page = (() => {
    switch (route) {
      case "/": return <Landing />;
      case "/how-to-use": return <HowToUse />;
      case "/docs": return <Docs />;
      case "/architecture": return <Architecture />;
      case "/sign-in": return <SignIn />;
      case "/workspace": return <Workspace />;
      default: return <NotFound />;
    }
  })();

  return (
    <MotionConfig reducedMotion="user">
      {!bare && <Nav route={route} />}
      <AnimatePresence mode="wait" onExitComplete={() => { if (!hash) window.scrollTo(0, 0); }}>
        <motion.div key={route} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}>
          {page}
        </motion.div>
      </AnimatePresence>
      {!bare && <Footer />}
    </MotionConfig>
  );
}
