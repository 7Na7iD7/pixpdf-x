import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopToolbar } from "./TopToolbar";
import { useAppStore } from "@stores/appStore";
import { cn } from "@utils/index";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { activeSidebarItem } = useAppStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopToolbar />
        <main
          className={cn(
            "flex-1 overflow-hidden relative",
            "bg-gradient-to-br from-background via-background to-muted/20"
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSidebarItem}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="h-full overflow-auto scrollbar-thin"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}