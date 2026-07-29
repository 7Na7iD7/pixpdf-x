import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  RefreshCw,
  Image,
  FileType,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { cn, formatFileSize } from "@utils/index";
import { useConvertPDF } from "@hooks/usePDF";
import { pickFile, pickFolder, pickSavePath, openPDF, pdfErrorMessage } from "@services/pdf";
import { useAppStore } from "@stores/appStore";
import type { PDFDocument } from "@apptypes/index";

const formats = [
  { id: "txt" as const, label: "Plain Text", icon: FileType, desc: "Extracted text content", color: "from-green-500/20 to-green-600/20", iconColor: "text-green-400", ready: true },
  { id: "pdfa" as const, label: "PDF/A (partial)", icon: ShieldCheck, desc: "Version bump only — not full conformance", color: "from-amber-500/20 to-amber-600/20", iconColor: "text-amber-400", ready: true },
  { id: "png" as const, label: "PNG Images", icon: Image, desc: "One PNG per page, saved to a folder", color: "from-purple-500/20 to-purple-600/20", iconColor: "text-purple-400", ready: true },
  { id: "jpg" as const, label: "JPEG Images", icon: Image, desc: "One JPG per page, saved to a folder", color: "from-blue-500/20 to-blue-600/20", iconColor: "text-blue-400", ready: true },
];

export function ConvertPDF() {
  const [document, setDocument] = useState<PDFDocument | null>(null);
  const [targetFormat, setTargetFormat] = useState<"png" | "jpg" | "txt" | "pdfa">("txt");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const convert = useConvertPDF();
  const addToast = useAppStore((s) => s.addToast);
  const addRecentFile = useAppStore((s) => s.addRecentFile);

  const handlePickFile = async () => {
    setIsLoadingFile(true);
    try {
      const path = await pickFile();
      if (!path) return;
      const doc = await openPDF(path);
      setDocument(doc);
      convert.reset();
    } catch (err) {
      addToast({ title: "Couldn't open file", description: pdfErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoadingFile(false);
    }
  };

  const startConvert = async () => {
    if (!document) return;
    const fmt = formats.find((f) => f.id === targetFormat)!;
    if (!fmt.ready) {
      addToast({
        title: "Not available yet",
        description: `${fmt.label} export needs a page-rendering engine that isn't wired up yet.`,
        variant: "destructive",
      });
      return;
    }

    const isImageExport = targetFormat === "png" || targetFormat === "jpg";
    let outputPath: string | null;

    if (isImageExport) {
      outputPath = await pickFolder();
    } else {
      const ext = targetFormat === "pdfa" ? "pdf" : targetFormat;
      const defaultName = document.name.replace(/\.pdf$/i, `.${ext}`);
      outputPath = await pickSavePath(defaultName);
    }
    if (!outputPath) return;

    try {
      const result = await convert.mutateAsync({ path: document.path, outputPath, format: targetFormat });
      addToast({
        title: "Conversion complete",
        description: isImageExport
          ? `Saved ${document.pageCount} page image(s) to ${result}`
          : `Saved to ${result}`,
        variant: "success",
      });
      addRecentFile({
        path: result,
        name: document.name,
        openedAt: new Date().toISOString(),
        pageCount: document.pageCount,
        size: document.size,
        action: "Converted",
      });
    } catch (err) {
      addToast({ title: "Conversion failed", description: pdfErrorMessage(err), variant: "destructive" });
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
              "border-border hover:border-violet-400/50 disabled:opacity-60"
            )}
          >
            {isLoadingFile ? (
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            )}
            <h3 className="text-xl font-semibold mb-2">Convert PDF</h3>
            <p className="text-muted-foreground text-sm">Click to select a PDF to convert</p>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/20 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Convert PDF</h2>
            <p className="text-sm text-muted-foreground">Transform PDFs into different formats</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 px-6 pb-6 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="mb-4 border-border/50">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-400" />
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

          <div className="grid grid-cols-2 gap-3">
            {formats.map((fmt) => {
              const Icon = fmt.icon;
              const isSelected = targetFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  onClick={() => setTargetFormat(fmt.id)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border text-left transition-all relative",
                    isSelected
                      ? "border-violet-500/50 bg-violet-500/5 shadow-sm"
                      : "border-border hover:border-violet-400/30 hover:bg-muted/30",
                    !fmt.ready && "opacity-70"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", isSelected ? "bg-violet-500/10" : "bg-muted")}>
                    <Icon className={cn("w-5 h-5", isSelected ? fmt.iconColor : "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className={cn("font-medium text-sm flex items-center gap-1", isSelected && fmt.iconColor)}>
                      {fmt.label}
                      {!fmt.ready && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmt.desc}</p>
                  </div>
                  {isSelected && fmt.ready && <ArrowRight className={cn("w-4 h-4 ml-auto", fmt.iconColor)} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-80 shrink-0 flex flex-col gap-4">
          {convert.isPending && (
            <Card className="border-border/50">
              <CardContent className="pt-6 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                <span className="text-sm font-medium">Converting…</span>
              </CardContent>
            </Card>
          )}

          {convert.isSuccess && !convert.isPending && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="py-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="font-medium text-sm">Conversion Complete</span>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
            disabled={convert.isPending}
            onClick={startConvert}
          >
            <RefreshCw className="w-4 h-4" />
            Convert to {formats.find((f) => f.id === targetFormat)?.label}
          </Button>
        </div>
      </div>
    </div>
  );
}