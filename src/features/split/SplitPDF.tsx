import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Upload, Scissors, Plus, X, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { ScrollArea } from "@components/ui/scroll-area";
import { cn, formatFileSize } from "@utils/index";
import { useSplitPDF } from "@hooks/usePDF";
import { pickFile, pickFolder, openPDF, pdfErrorMessage } from "@services/pdf";
import { useAppStore } from "@stores/appStore";
import type { PDFDocument, PageRange } from "@apptypes/index";

export function SplitPDF() {
  const [document, setDocument] = useState<PDFDocument | null>(null);
  const [ranges, setRanges] = useState<PageRange[]>([{ start: 1, end: 1, label: "Part 1" }]);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const split = useSplitPDF();
  const addToast = useAppStore((s) => s.addToast);
  const addRecentFile = useAppStore((s) => s.addRecentFile);

  const handlePickFile = async () => {
    setIsLoadingFile(true);
    try {
      const path = await pickFile();
      if (!path) return;
      const doc = await openPDF(path);
      setDocument(doc);
      setRanges([{ start: 1, end: doc.pageCount, label: "Part 1" }]);
    } catch (err) {
      addToast({ title: "Couldn't open file", description: pdfErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoadingFile(false);
    }
  };

  const addRange = () => {
    setRanges((prev) => [
      ...prev,
      { start: 1, end: document?.pageCount || 1, label: `Part ${prev.length + 1}` },
    ]);
  };

  const updateRange = (index: number, field: keyof PageRange, value: string | number) => {
    setRanges((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const removeRange = (index: number) => {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const startSplit = async () => {
    if (!document) return;

    for (const r of ranges) {
      if (r.start < 1 || r.end < r.start || r.end > document.pageCount) {
        addToast({
          title: "Invalid range",
          description: `"${r.label}": ${r.start}-${r.end} is out of bounds for a ${document.pageCount}-page document`,
          variant: "destructive",
        });
        return;
      }
    }

    const outputDir = await pickFolder();
    if (!outputDir) return;

    try {
      const outputPaths = await split.mutateAsync({ path: document.path, ranges, outputDir });
      addToast({
        title: "Split complete",
        description: `Created ${outputPaths.length} file(s) in ${outputDir}`,
        variant: "success",
      });
      addRecentFile({
        path: outputDir,
        name: document.name,
        openedAt: new Date().toISOString(),
        pageCount: document.pageCount,
        size: document.size,
        action: "Split",
      });
    } catch (err) {
      addToast({ title: "Split failed", description: pdfErrorMessage(err), variant: "destructive" });
    }
  };

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <button
            onClick={handlePickFile}
            disabled={isLoadingFile}
            className={cn(
              "w-full border-2 border-dashed rounded-2xl p-12 text-center transition-all",
              "border-border hover:border-amber-400/50 disabled:opacity-60"
            )}
          >
            {isLoadingFile ? (
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            )}
            <h3 className="text-xl font-semibold mb-2">Select a PDF to Split</h3>
            <p className="text-muted-foreground text-sm">Click to browse</p>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center">
            <Scissors className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Split PDF</h2>
            <p className="text-sm text-muted-foreground">Extract pages into separate documents</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 px-6 pb-6 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="mb-4 border-border/50">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {document.pageCount} pages · {formatFileSize(document.size)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDocument(null)}>
                Change
              </Button>
            </CardContent>
          </Card>

          <Card className="flex-1 flex flex-col min-h-0 border-border/50">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Page Ranges</CardTitle>
              <Button variant="outline" size="sm" onClick={addRange} className="gap-1">
                <Plus className="w-3 h-3" />
                Add Range
              </Button>
            </CardHeader>
            <ScrollArea className="flex-1 px-4 pb-4">
              <div className="space-y-3">
                <AnimatePresence>
                  {ranges.map((range, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-3 p-4 rounded-lg bg-muted/50"
                    >
                      <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
                      <input
                        type="text"
                        value={range.label}
                        onChange={(e) => updateRange(index, "label", e.target.value)}
                        className="w-32 px-2 py-1.5 rounded bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={document.pageCount}
                          value={range.start}
                          onChange={(e) => updateRange(index, "start", parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 rounded bg-background border border-border text-sm text-center focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                        <span className="text-muted-foreground">—</span>
                        <input
                          type="number"
                          min={1}
                          max={document.pageCount}
                          value={range.end}
                          onChange={(e) => updateRange(index, "end", parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 rounded bg-background border border-border text-sm text-center focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {Math.max(0, range.end - range.start + 1)} pages
                      </span>
                      {ranges.length > 1 && (
                        <Button variant="ghost" size="icon-sm" onClick={() => removeRange(index)}>
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </Card>
        </div>

        <div className="w-80 shrink-0 flex flex-col gap-4">
          {split.isPending && (
            <Card className="border-border/50">
              <CardContent className="pt-6 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span className="text-sm font-medium">Splitting…</span>
              </CardContent>
            </Card>
          )}
          {split.isSuccess && !split.isPending && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="pt-6 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">Split complete</span>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
            disabled={ranges.length === 0 || split.isPending}
            onClick={startSplit}
          >
            <Scissors className="w-4 h-4" />
            Split Document
          </Button>
        </div>
      </div>
    </div>
  );
}