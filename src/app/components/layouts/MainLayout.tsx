import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "../navigation/Sidebar";
import { Header } from "../navigation/Header";
import { SkeletonDashboard } from "../ui/skeleton";
import { motion, AnimatePresence } from "motion/react";

export function MainLayout() {
  const location = useLocation();

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
              <Suspense fallback={<SkeletonDashboard />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}