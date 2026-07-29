import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import {
  FileText,
  Minimize2,
  Zap,
  Image,
  Gauge,
  CheckCircle2,
  Loader2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Progress } from "@components/ui/progress";
import { cn, formatFileSize } from "@utils/index";
import { useCompressPDF } from "@hooks/usePDF";
import { pickFile, pickSavePath, openPDF, pdfErrorMessage } from "@services/pdf";
import { useAppStore } from "@stores/appStore";
import type { PDFDocument } from "@apptypes/index";

const presets = [
  { id: "low", label: "Low Quality", desc: "Smallest size", icon: Zap },
  { id: "medium", label: "Balanced", desc: "Good compromise", icon: Gauge },
  { id: "high", label: "High Quality", desc: "Minimal loss", icon: Image },
];

interface CompressProgress {
  stage: string;
  done: number;
  total: number;
  percent: number;
}

const stageLabels: Record<string, string> = {
  analyzing: "Analyzing document…",
  "recompressing-images": "Recompressing images…",
  rasterizing: "Rasterizing pages…",
  finalizing: "Finalizing…",
};

export function CompressPDF() {
  const [document, setDocument] = useState<PDFDocument | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<"low" | "medium" | "high">("medium");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [progress, setProgress] = useState<CompressProgress | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const compress = useCompressPDF();
  const addToast = useAppStore((s) => s.addToast);
  const addRecentFile = useAppStore((s) => s.addRecentFile);

  useEffect(() => {
    const unlistenPromise = listen<CompressProgress>("compress-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handlePickFile = async () => {
    setIsLoadingFile(true);
    try {
      const path = await pickFile();
      if (!path) return;
      const doc = await openPDF(path);
      setDocument(doc);
      compress.reset();
      setProgress(null);
    } catch (err) {
      addToast({ title: "Couldn't open file", description: pdfErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoadingFile(false);
    }
  };

  const estimateRemaining = (): string | null => {
    if (!progress || progress.total <= 1 || progress.done === 0 || !startTimeRef.current) return null;
    const elapsedMs = Date.now() - startTimeRef.current;
    const perPageMs = elapsedMs / progress.done;
    const remainingPages = progress.total - progress.done;
    const remainingMs = perPageMs * remainingPages;
    const remainingSec = Math.round(remainingMs / 1000);
    if (remainingSec < 60) return `~${remainingSec}s remaining`;
    const min = Math.floor(remainingSec / 60);
    const sec = remainingSec % 60;
    return `~${min}m ${sec}s remaining`;
  };

  const startCompress = async () => {
    if (!document) return;
    const outputPath = await pickSavePath(`compressed-${document.name}`);
    if (!outputPath) return;

    setProgress({ stage: "analyzing", done: 0, total: 1, percent: 0 });
    startTimeRef.current = Date.now();

    try {
      const res = await compress.mutateAsync({ path: document.path, outputPath, quality: selectedPreset });
      if (res.rasterized) {
        addToast({
          title: "Compressed (converted to images)",
          description:
            "This file's scanned pages weren't JPEG, so pages were rasterized and re-compressed. Any selectable text was lost.",
          variant: "success",
        });
      } else {
        addToast({ title: "Compression complete", description: `Saved to ${outputPath}`, variant: "success" });
      }
      addRecentFile({
        path: outputPath,
        name: document.name,
        openedAt: new Date().toISOString(),
        pageCount: document.pageCount,
        size: res.compressedSize,
        action: "Compressed",
      });
    } catch (err) {
      addToast({ title: "Compression failed", description: pdfErrorMessage(err), variant: "destructive" });
    } finally {
      startTimeRef.current = null;
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
              "border-border hover:border-rose-400/50 disabled:opacity-60"
            )}
          >
            {isLoadingFile ? (
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            )}
            <h3 className="text-xl font-semibold mb-2">Compress PDF</h3>
            <p className="text-muted-foreground text-sm">Click to choose a PDF to reduce its file size</p>
          </button>
        </motion.div>
      </div>
    );
  }

  const result = compress.data;
  const eta = estimateRemaining();

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-600/20 flex items-center justify-center">
            <Minimize2 className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Compress PDF</h2>
            <p className="text-sm text-muted-foreground">Reduce file size while preserving quality</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 px-6 pb-6 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="mb-4 border-border/50">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {document.pageCount} pages · {formatFileSize(document.size)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDocument(null)} disabled={compress.isPending}>
                Change
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {presets.map((preset) => {
              const Icon = preset.icon;
              const isSelected = selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id as "low" | "medium" | "high")}
                  disabled={compress.isPending}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border text-left transition-all disabled:opacity-50",
                    isSelected
                      ? "border-rose-500/50 bg-rose-500/5 shadow-sm"
                      : "border-border hover:border-rose-400/30 hover:bg-muted/30"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isSelected ? "bg-rose-500/10" : "bg-muted")}>
                    <Icon className={cn("w-5 h-5", isSelected ? "text-rose-400" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className={cn("font-medium text-sm", isSelected && "text-rose-400")}>{preset.label}</p>
                    <p className="text-xs text-muted-foreground">{preset.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {result && !compress.isPending && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-medium text-sm">Compression Complete</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(result.originalSize)} → {formatFileSize(result.compressedSize)} (
                        {Math.max(0, Math.round((1 - result.compressedSize / result.originalSize) * 100))}% smaller)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="w-80 shrink-0 flex flex-col gap-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Compression Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Original</span>
                <span className="font-mono">{formatFileSize(document.size)}</span>
              </div>
              {result && !compress.isPending && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Compressed</span>
                    <span className="font-mono">{formatFileSize(result.compressedSize)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reduction</span>
                    <span className="font-mono text-emerald-400">
                      {Math.max(0, Math.round((1 - result.compressedSize / result.originalSize) * 100))}%
                    </span>
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                {result?.rasterized
                  ? "This file's images weren't JPEG-based (common for scanned books), so pages were rasterized and re-saved as JPEG. Any selectable text in the original was lost — this only applies to Low/Medium presets."
                  : "Compresses embedded JPEG images and PDF streams. Non-JPEG scanned formats (CCITTFax/JBIG2) are already near-optimal and won't shrink further without rasterizing."}
              </p>
            </CardContent>
          </Card>

          {compress.isPending && (
            <Card className="border-border/50">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  <span className="text-sm font-medium">
                    {progress ? stageLabels[progress.stage] || "Processing…" : "Processing…"}
                  </span>
                </div>
                <Progress value={progress?.percent ?? 0} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{progress?.percent ?? 0}%</span>
                  {progress && progress.stage === "rasterizing" && (
                    <span>
                      {progress.done} / {progress.total} pages
                    </span>
                  )}
                </div>
                {eta && <p className="text-xs text-muted-foreground">{eta}</p>}
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full gap-2 bg-rose-600 hover:bg-rose-700"
            disabled={compress.isPending}
            onClick={startCompress}
          >
            <Minimize2 className="w-4 h-4" />
            Compress Document
          </Button>
        </div>
      </div>
    </div>
  );
}