import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Sidebar } from "../navigation/Sidebar";
import { Header } from "../navigation/Header";
import { motion, AnimatePresence } from "motion/react";

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
        const isInputFocused = activeTag === "INPUT" || activeTag === "TEXTAREA" || (document.activeElement as HTMLElement)?.isContentEditable;
      if (e.ctrlKey && e.key.toLowerCase() === "1") {
        e.preventDefault();
        navigate("/scanner");
      }
      if (e.ctrlKey && e.key.toLowerCase() === "2") {
        e.preventDefault();
        navigate("/reports");
      }
      if (e.ctrlKey && e.key.toLowerCase() === "3") {
        e.preventDefault();
        navigate("/terapias");
      }
      if (e.ctrlKey && e.key.toLowerCase() === "4") {
        e.preventDefault();
        navigate("/pdf-tools");
      }
      if (e.ctrlKey && e.key.toLowerCase() === "5") {
        e.preventDefault();
        navigate("/settings");
      }
      if (e.ctrlKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        navigate("/history");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}