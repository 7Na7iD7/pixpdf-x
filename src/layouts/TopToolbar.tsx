import { motion } from "framer-motion";
import {
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Search,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  RotateCcw,
} from "lucide-react";
import { Button } from "@components/ui/button";
import { Separator } from "@components/ui/separator";
import { useAppStore } from "@stores/appStore";
import { cn } from "@utils/index";

export function TopToolbar() {
  const { currentDocument, isLoading } = useAppStore();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center h-14 px-4 bg-card/50 backdrop-blur-xl border-b border-border shrink-0 gap-1"
    >
      <div className="flex items-center gap-1">
        <ToolbarButton icon={FolderOpen} label="Open" shortcut="Ctrl+O" />
        <ToolbarButton icon={Save} label="Save" shortcut="Ctrl+S" disabled={!currentDocument} />
        <ToolbarButton icon={Undo2} label="Undo" shortcut="Ctrl+Z" />
        <ToolbarButton icon={Redo2} label="Redo" shortcut="Ctrl+Y" />
      </div>

      <Separator orientation="vertical" className="h-6 mx-2" />

      <div className="flex items-center gap-1">
        <ToolbarButton icon={Search} label="Search" shortcut="Ctrl+F" />
      </div>

      <Separator orientation="vertical" className="h-6 mx-2" />

      <div className="flex items-center gap-1">
        <ToolbarButton icon={ZoomOut} label="Zoom Out" />
        <span className="text-xs text-muted-foreground w-12 text-center font-mono">
          100%
        </span>
        <ToolbarButton icon={ZoomIn} label="Zoom In" />
      </div>

      <Separator orientation="vertical" className="h-6 mx-2" />

      <div className="flex items-center gap-1">
        <ToolbarButton icon={ChevronLeft} label="Previous" />
        <span className="text-xs text-muted-foreground px-2 font-mono">
          {currentDocument ? `1 / ${currentDocument.pageCount}` : "— / —"}
        </span>
        <ToolbarButton icon={ChevronRight} label="Next" />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <ToolbarButton icon={Printer} label="Print" />
        <ToolbarButton icon={Download} label="Export" />
        <ToolbarButton icon={RotateCcw} label="Reset View" />
      </div>

      {isLoading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="ml-3 flex items-center gap-2"
        >
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Processing...</span>
        </motion.div>
      )}
    </motion.header>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      onClick={onClick}
      className={cn("relative group", disabled && "opacity-40")}
      title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}
