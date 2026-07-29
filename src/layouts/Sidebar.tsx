import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Merge,
  Scissors,
  Minimize2,
  RefreshCw,
  PenTool,
  Shield,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileImage,
} from "lucide-react";
import { cn } from "@utils/index";
import { useAppStore } from "@stores/appStore";
import type { SidebarItem } from "@apptypes/index";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@components/ui/tooltip";
import { Separator } from "@components/ui/separator";
import { Badge } from "@components/ui/badge";
import { ScrollArea } from "@components/ui/scroll-area";

interface NavItem {
  id: SidebarItem;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "viewer", label: "PDF Viewer", icon: FileText },
  { id: "merge", label: "Merge PDF", icon: Merge },
  { id: "split", label: "Split PDF", icon: Scissors },
  { id: "compress", label: "Compress PDF", icon: Minimize2 },
  { id: "convert", label: "Convert PDF", icon: RefreshCw },
  { id: "editor", label: "PDF Editor", icon: PenTool },
  { id: "security", label: "Security", icon: Shield },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { activeSidebarItem, setActiveSidebarItem, isSidebarCollapsed, toggleSidebar } =
    useAppStore();

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: isSidebarCollapsed ? 72 : 260 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative flex flex-col h-full bg-card/50 backdrop-blur-xl border-r border-border z-20"
      >
        <div className="flex items-center h-16 px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-naviki-400 to-naviki-600 shrink-0 shadow-lg shadow-naviki-500/20">
              <FileImage className="w-5 h-5 text-white" />
            </div>
            <AnimatePresence>
              {!isSidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-col"
                >
                  <span className="text-sm font-bold tracking-tight whitespace-nowrap">
                    PixPDF <span className="text-naviki-400">X</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    by NAVIKI Labs
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <ScrollArea className="flex-1 py-3">
          <nav className="px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = activeSidebarItem === item.id;
              const Icon = item.icon;
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveSidebarItem(item.id)}
                      className={cn(
                        "relative flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute left-0 w-1 h-6 rounded-r-full bg-primary"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <Icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                      {!isSidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {item.badge && !isSidebarCollapsed && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  </TooltipTrigger>
                  {isSidebarCollapsed && (
                    <TooltipContent side="right" className="flex items-center gap-4">
                      {item.label}
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-2 border-t border-border shrink-0">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-full gap-2 px-3 py-2 text-xs font-medium text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}