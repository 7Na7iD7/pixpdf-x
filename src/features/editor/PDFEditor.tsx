import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  FileText,
  Upload,
  PenTool,
  RotateCw,
  Trash2,
  Copy,
  ArrowUpDown,
  Type,
  Stamp,
  Save,
  Undo2,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { ScrollArea } from "@components/ui/scroll-area";
import { cn, generateId } from "@utils/index";
import type { PDFDocument, PDFPage } from "@apptypes/index";

interface EditablePage extends PDFPage {
  selected: boolean;
  rotation: number;
}

export function PDFEditor() {
  const [document, setDocument] = useState<PDFDocument | null>(null);
  const [pages, setPages] = useState<EditablePage[]>([]);
  const [activeTool, setActiveTool] = useState<"select" | "rotate" | "delete" | "duplicate" | "reorder" | "text" | "watermark">("select");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === "application/pdf") {
      const doc = {
        id: generateId(),
        path: (file as any).path || file.name,
        name: file.name,
        size: file.size,
        pageCount: 8,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };
      setDocument(doc);
      setPages(
        Array.from({ length: doc.pageCount }, (_, i) => ({
          index: i,
          width: 595,
          height: 842,
          selected: false,
          rotation: 0,
        }))
      );
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  const togglePageSelection = (index: number) => {
    setPages((prev) =>
      prev.map((p) => (p.index === index ? { ...p, selected: !p.selected } : p))
    );
  };

  const rotateSelected = () => {
    setPages((prev) =>
      prev.map((p) => (p.selected ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const deleteSelected = () => {
    setPages((prev) => prev.filter((p) => !p.selected));
  };

  const duplicateSelected = () => {
    setPages((prev) => {
      const newPages = [...prev];
      prev.forEach((p, i) => {
        if (p.selected) {
          newPages.splice(i + 1, 0, { ...p, selected: false });
        }
      });
      return newPages.map((p, i) => ({ ...p, index: i }));
    });
  };

  const tools = [
    { id: "select" as const, label: "Select", icon: PenTool },
    { id: "rotate" as const, label: "Rotate", icon: RotateCw },
    { id: "delete" as const, label: "Delete", icon: Trash2 },
    { id: "duplicate" as const, label: "Duplicate", icon: Copy },
    { id: "reorder" as const, label: "Reorder", icon: ArrowUpDown },
    { id: "text" as const, label: "Add Text", icon: Type },
    { id: "watermark" as const, label: "Watermark", icon: Stamp },
  ];

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
              isDragActive ? "border-cyan-400 bg-cyan-500/5" : "border-border hover:border-cyan-400/50"
            )}
          >
            <input {...getInputProps()} />
            <PenTool className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">PDF Editor</h3>
            <p className="text-muted-foreground text-sm">Open a PDF to edit pages, add text, or watermarks</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center">
            <PenTool className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">PDF Editor</h2>
            <p className="text-sm text-muted-foreground">Modify pages, add annotations, and more</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 px-6 pb-6 min-h-0">
        <div className="w-16 shrink-0 flex flex-col gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] transition-all",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                    : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="leading-tight">{tool.label}</span>
              </button>
            );
          })}
          <div className="flex-1" />
          <Button variant="outline" size="icon" className="w-full h-10" title="Undo">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button className="w-full gap-1 bg-cyan-600 hover:bg-cyan-700 h-10" title="Save">
            <Save className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <Card className="mb-3 border-border/50">
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{document.name}</p>
                  <p className="text-xs text-muted-foreground">{pages.length} pages</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeTool === "rotate" && (
                  <Button size="sm" variant="outline" onClick={rotateSelected} disabled={!pages.some((p) => p.selected)}>
                    <RotateCw className="w-3 h-3 mr-1" />
                    Rotate Selected
                  </Button>
                )}
                {activeTool === "delete" && (
                  <Button size="sm" variant="destructive" onClick={deleteSelected} disabled={!pages.some((p) => p.selected)}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete Selected
                  </Button>
                )}
                {activeTool === "duplicate" && (
                  <Button size="sm" variant="outline" onClick={duplicateSelected} disabled={!pages.some((p) => p.selected)}>
                    <Copy className="w-3 h-3 mr-1" />
                    Duplicate Selected
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-3 gap-4 p-1">
              <AnimatePresence>
                {pages.map((page) => (
                  <motion.div
                    key={page.index}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => togglePageSelection(page.index)}
                    className={cn(
                      "relative aspect-[210/297] bg-white rounded-lg shadow-sm cursor-pointer transition-all overflow-hidden",
                      page.selected && "ring-2 ring-cyan-400 shadow-md"
                    )}
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <span className="text-xs font-medium">{page.index + 1}</span>
                    </div>
                    {page.selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}