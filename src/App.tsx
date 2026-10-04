import { useEffect } from "react";
import { motion } from "framer-motion";
import { Greeting } from "./components/Greeting";
import { StatusStrip } from "./components/StatusStrip";
import { WeatherWidget } from "./components/WeatherWidget";
import { AgendaPanel } from "./components/AgendaPanel";
import { TripCard } from "./components/TripCard";
import { TaskPanel } from "./components/TaskPanel";
import { NotesPanel } from "./components/NotesPanel";
import { ChatPanel } from "./components/ChatPanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { CaptureBar } from "./components/CaptureBar";
import { CommandPalette } from "./components/CommandPalette";
import { GmailPanel } from "./components/GmailPanel";
import { ChiefOfStaffPanel } from "./components/ChiefOfStaffPanel";
import { DebriefPanel } from "./components/DebriefPanel";
import { FocusTimer } from "./components/FocusTimer";
import { useTasks } from "./hooks/useTasks";
import { useNotes } from "./hooks/useNotes";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export default function App() {
  const {
    tasks,
    loading: tasksLoading,
    refresh: refreshTasks,
    toggleDone,
    setDueDate,
    setRecurrence,
    removeTask,
  } = useTasks();
  const { notes, loading: notesLoading, refresh: refreshNotes, removeNote } = useNotes();

  function handleCaptured(result: { type: "task" | "note" }) {
    if (result.type === "task") refreshTasks();
    else refreshNotes();
  }

  useEffect(() => {
    function onCaptured(e: Event) {
      handleCaptured((e as CustomEvent<{ type: "task" | "note" }>).detail);
    }
    window.addEventListener("friday:captured", onCaptured);
    return () => window.removeEventListener("friday:captured", onCaptured);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      document.documentElement.style.setProperty("--sx", `${(e.clientX / window.innerWidth) * 100}%`);
      document.documentElement.style.setProperty("--sy", `${(e.clientY / window.innerHeight) * 100}%`);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 1200px 800px at 50% -10%, rgba(79, 215, 200, 0.12), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: "radial-gradient(600px circle at var(--sx, 50%) var(--sy, 30%), rgba(200, 164, 79, 0.07), transparent 70%)",
          }}
        />
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.06 }}
        className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10"
      >
        <motion.div variants={fadeUp}>
          <StatusStrip />
        </motion.div>

        <motion.div variants={fadeUp}>
          <Greeting />
        </motion.div>

        <motion.div variants={fadeUp}>
          <ChatPanel />
        </motion.div>

        <motion.div variants={fadeUp}>
          <MemoryPanel />
        </motion.div>

        <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <WeatherWidget />
          <AgendaPanel />
        </motion.div>

        <motion.div variants={fadeUp}>
          <TripCard />
        </motion.div>

        <motion.div variants={fadeUp}>
          <DebriefPanel tasks={tasks} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <FocusTimer tasks={tasks} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <ChiefOfStaffPanel />
        </motion.div>

        <motion.div variants={fadeUp}>
          <GmailPanel />
        </motion.div>

        <motion.div variants={fadeUp} className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-2">
          <TaskPanel
            tasks={tasks}
            loading={tasksLoading}
            onToggle={toggleDone}
            onSetDueDate={setDueDate}
            onSetRecurrence={setRecurrence}
            onRemove={removeTask}
          />
          <NotesPanel notes={notes} loading={notesLoading} onRemove={removeNote} />
        </motion.div>
      </motion.div>

      <CaptureBar onCaptured={handleCaptured} />
      <CommandPalette />
    </div>
  );
}
