import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Upload,
  GripVertical,
  X,
  ArrowUp,
  ArrowDown,
  Merge,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { ScrollArea } from "@components/ui/scroll-area";
import { cn, formatFileSize, generateId } from "@utils/index";
import { useMergePDFs } from "@hooks/usePDF";
import { pickFiles, pickSavePath, pdfErrorMessage, openPDF } from "@services/pdf";
import { useAppStore } from "@stores/appStore";
import type { PDFDocument } from "@apptypes/index";

export function MergePDF() {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [outputName, setOutputName] = useState("merged-document.pdf");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const merge = useMergePDFs();
  const addToast = useAppStore((s) => s.addToast);
  const addRecentFile = useAppStore((s) => s.addRecentFile);

  const handlePickFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const paths = await pickFiles();
      if (paths.length === 0) return;

      const loaded: PDFDocument[] = [];
      for (const path of paths) {
        try {
          const doc = await openPDF(path);
          loaded.push(doc);
        } catch (err) {
          addToast({
            title: "Couldn't read file",
            description: pdfErrorMessage(err),
            variant: "destructive",
          });
        }
      }
      setDocuments((prev) => [...prev, ...loaded]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const moveDocument = (index: number, direction: "up" | "down") => {
    setDocuments((prev) => {
      const newDocs = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newDocs.length) return prev;
      [newDocs[index], newDocs[targetIndex]] = [newDocs[targetIndex], newDocs[index]];
      return newDocs;
    });
  };

  const startMerge = async () => {
    if (documents.length < 2) return;

    const outputPath = await pickSavePath(outputName);
    if (!outputPath) return; // user cancelled — not an error

    try {
      const result = await merge.mutateAsync({
        paths: documents.map((d) => d.path),
        outputPath,
      });
      addToast({
        title: "Merge complete",
        description: `Saved to ${result}`,
        variant: "success",
      });
      addRecentFile({
        path: result,
        name: outputName,
        openedAt: new Date().toISOString(),
        pageCount: documents.reduce((acc, d) => acc + d.pageCount, 0),
        size: documents.reduce((acc, d) => acc + d.size, 0),
        action: "Merged",
      });
    } catch (err) {
      addToast({
        title: "Merge failed",
        description: pdfErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center">
            <Merge className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Merge PDF</h2>
            <p className="text-sm text-muted-foreground">
              Combine multiple PDFs into a single document
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 px-6 pb-6 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <button
            onClick={handlePickFiles}
            disabled={isLoadingFiles}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center transition-all mb-4 shrink-0",
              "border-border hover:border-emerald-400/50 disabled:opacity-60"
            )}
          >
            {isLoadingFiles ? (
              <Loader2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            )}
            <p className="text-sm font-medium">
              {isLoadingFiles ? "Loading files…" : "Click to choose PDFs"}
            </p>
          </button>

          <Card className="flex-1 flex flex-col min-h-0 border-border/50">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Documents ({documents.length})</span>
                {documents.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setDocuments([])}>
                    Clear All
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 px-4 pb-4">
              <div className="space-y-2">
                <AnimatePresence>
                  {documents.map((doc, index) => (
                    <motion.div
                      key={doc.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.pageCount} pages · {formatFileSize(doc.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === 0}
                          onClick={() => moveDocument(index, "up")}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === documents.length - 1}
                          onClick={() => moveDocument(index, "down")}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => removeDocument(doc.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {documents.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No documents added yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        <div className="w-80 shrink-0 flex flex-col gap-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Output Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Filename</label>
                <input
                  type="text"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Total files: {documents.length}</p>
                <p>Total size: {formatFileSize(documents.reduce((acc, d) => acc + d.size, 0))}</p>
              </div>
            </CardContent>
          </Card>

          {merge.isPending && (
            <Card className="border-border/50">
              <CardContent className="pt-6 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span className="text-sm font-medium">Merging…</span>
              </CardContent>
            </Card>
          )}

          {merge.isSuccess && !merge.isPending && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="pt-6 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">Merged successfully</span>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
            disabled={documents.length < 2 || merge.isPending}
            onClick={startMerge}
          >
            <Merge className="w-4 h-4" />
            Merge Documents
          </Button>
        </div>
      </div>
    </div>
  );
}