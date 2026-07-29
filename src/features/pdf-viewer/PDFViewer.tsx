import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Upload,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Info,
  Grid3X3,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@components/ui/button";
import { ScrollArea } from "@components/ui/scroll-area";
import { Separator } from "@components/ui/separator";
import { useAppStore } from "@stores/appStore";
import { cn, formatFileSize } from "@utils/index";
import { pickFile, openPDF, renderPage, pdfErrorMessage } from "@services/pdf";

export function PDFViewer() {
  const { currentDocument, setCurrentDocument, addRecentFile, addToast } = useAppStore();
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"single" | "thumbnails">("single");
  const [showInfo, setShowInfo] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const [pageImages, setPageImages] = useState<Record<number, string | "loading" | "error">>({});
  const [renderErrorMessage, setRenderErrorMessage] = useState<string | null>(null);

  const handlePickFile = async () => {
    setIsLoadingFile(true);
    try {
      const path = await pickFile();
      if (!path) return;
      const doc = await openPDF(path);
      setCurrentDocument(doc);
      setCurrentPage(1);
      setPageImages({});
      setRenderErrorMessage(null);
      addRecentFile({
        path: doc.path,
        name: doc.name,
        openedAt: new Date().toISOString(),
        pageCount: doc.pageCount,
        size: doc.size,
        action: "Opened",
      });
    } catch (err) {
      addToast({ title: "Couldn't open file", description: pdfErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoadingFile(false);
    }
  };

  useEffect(() => {
    if (!currentDocument) return;
    const pageIndex = currentPage - 1;
    if (pageImages[pageIndex] && pageImages[pageIndex] !== "error") return;

    let cancelled = false;
    setPageImages((prev) => ({ ...prev, [pageIndex]: "loading" }));

    renderPage(currentDocument.path, pageIndex, zoom / 100)
      .then((dataUrl) => {
        if (cancelled) return;
        setPageImages((prev) => ({ ...prev, [pageIndex]: dataUrl }));
      })
      .catch((err) => {
        if (cancelled) return;
        setRenderErrorMessage(pdfErrorMessage(err));
        setPageImages((prev) => ({ ...prev, [pageIndex]: "error" }));
      });

    return () => {
      cancelled = true;
    };
  }, [currentDocument?.path, currentPage, zoom]);

  if (!currentDocument) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <button
            onClick={handlePickFile}
            disabled={isLoadingFile}
            className={cn(
              "w-full border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300",
              "border-border hover:border-naviki-400/50 hover:bg-muted/30 disabled:opacity-60"
            )}
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-naviki-400/20 to-naviki-600/20 flex items-center justify-center mx-auto mb-6">
              {isLoadingFile ? (
                <Loader2 className="w-10 h-10 text-naviki-400 animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-naviki-400" />
              )}
            </div>
            <h3 className="text-xl font-semibold mb-2">Open a PDF Document</h3>
            <p className="text-muted-foreground text-sm mb-4">Click to browse for a PDF file</p>
          </button>
        </motion.div>
      </div>
    );
  }

  const currentPageImage = pageImages[currentPage - 1];

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center h-12 px-4 border-b border-border bg-card/30 shrink-0 gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(25, z - 25))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center font-mono">{zoom}%</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(400, z + 25))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2 font-mono">
              {currentPage} / {currentDocument.pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCurrentPage((p) => Math.min(currentDocument.pageCount, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center gap-1">
            <Button variant={viewMode === "single" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setViewMode("single")}>
              <FileText className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === "thumbnails" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setViewMode("thumbnails")}>
              <Grid3X3 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1" />

          <Button variant="ghost" size="icon-sm" onClick={() => setShowInfo(!showInfo)}>
            <Info className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex items-center justify-center p-8 min-h-full">
            <AnimatePresence mode="wait">
              <motion.div key={currentPage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
                {currentPageImage && currentPageImage !== "loading" && currentPageImage !== "error" ? (
                  <img
                    src={currentPageImage}
                    alt={`Page ${currentPage}`}
                    className="rounded-lg shadow-2xl max-w-full"
                    style={{ width: `${8.27 * zoom}px`, minWidth: "300px" }}
                  />
                ) : (
                  <div
                    className="bg-white rounded-lg shadow-2xl flex items-center justify-center"
                    style={{
                      width: `${8.27 * zoom}px`,
                      height: `${11.69 * zoom}px`,
                      minWidth: "300px",
                      minHeight: "424px",
                    }}
                  >
                    {currentPageImage === "loading" ? (
                      <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                    ) : (
                      <div className="text-center text-muted-foreground px-6">
                        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-500/70" />
                        <p className="text-sm font-medium mb-1">Page preview unavailable</p>
                        <p className="text-xs opacity-60 max-w-[240px] mx-auto">
                          {renderErrorMessage ||
                            "Rendering failed. Check that the pdfium library is installed next to the app executable."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-border bg-card/30 overflow-hidden"
          >
            <div className="w-[280px] p-6">
              <h3 className="font-semibold mb-4">Document Info</h3>
              <div className="space-y-3 text-sm">
                <InfoRow label="Name" value={currentDocument.name} />
                <InfoRow label="Size" value={formatFileSize(currentDocument.size)} />
                <InfoRow label="Pages" value={String(currentDocument.pageCount)} />
                <InfoRow label="Path" value={currentDocument.path} truncate />
                {currentDocument.metadata?.author && (
                  <InfoRow label="Author" value={currentDocument.metadata.author} />
                )}
                {currentDocument.metadata?.title && (
                  <InfoRow label="Title" value={currentDocument.metadata.title} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className={cn("font-medium", truncate && "truncate")}>{value}</p>
    </div>
  );
}