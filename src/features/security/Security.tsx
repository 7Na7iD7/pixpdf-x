import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { cn, formatFileSize } from "@utils/index";
import { useEncryptPDF, useDecryptPDF } from "@hooks/usePDF";
import { pickFile, pickSavePath, openPDF, pdfErrorMessage } from "@services/pdf";
import { useAppStore } from "@stores/appStore";
import type { PDFDocument } from "@apptypes/index";

export function Security() {
  const [document, setDocument] = useState<PDFDocument | null>(null);
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const encrypt = useEncryptPDF();
  const decrypt = useDecryptPDF();
  const addToast = useAppStore((s) => s.addToast);
  const addRecentFile = useAppStore((s) => s.addRecentFile);

  const handlePickFile = async () => {
    setIsLoadingFile(true);
    try {
      const path = await pickFile();
      if (!path) return;
      const doc = await openPDF(path);
      setDocument(doc);
    } catch (err) {
      addToast({ title: "Couldn't open file", description: pdfErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleAction = async () => {
    if (!document || !password) return;
    const outputPath = await pickSavePath(
      mode === "encrypt" ? `encrypted-${document.name}` : `decrypted-${document.name}`
    );
    if (!outputPath) return;

    try {
      if (mode === "encrypt") {
        await encrypt.mutateAsync({
          path: document.path,
          outputPath,
          userPassword: password,
          ownerPassword: ownerPassword || undefined,
        });
      } else {
        await decrypt.mutateAsync({ path: document.path, outputPath, password });
      }
      addToast({ title: "Success", description: `Saved to ${outputPath}`, variant: "success" });
      addRecentFile({
        path: outputPath,
        name: document.name,
        openedAt: new Date().toISOString(),
        pageCount: document.pageCount,
        size: document.size,
        action: mode === "encrypt" ? "Encrypted" : "Decrypted",
      });
    } catch (err) {
      // Backend currently returns PDFError::NotImplemented for both — surface
      // that honestly instead of pretending it worked.
      addToast({
        title: mode === "encrypt" ? "Encryption unavailable" : "Decryption unavailable",
        description: pdfErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const isProcessing = encrypt.isPending || decrypt.isPending;

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full">
          <button
            onClick={handlePickFile}
            disabled={isLoadingFile}
            className={cn(
              "w-full border-2 border-dashed rounded-2xl p-12 text-center transition-all",
              "border-border hover:border-orange-400/50 disabled:opacity-60"
            )}
          >
            {isLoadingFile ? (
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            )}
            <h3 className="text-xl font-semibold mb-2">PDF Security</h3>
            <p className="text-muted-foreground text-sm">Click to select a PDF</p>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">PDF Security</h2>
            <p className="text-sm text-muted-foreground">Encrypt or decrypt your documents</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 px-6 pb-6 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="mb-4 border-border/50">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-400" />
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

          <div className="flex gap-2 mb-4">
            {[
              { id: "encrypt" as const, label: "Encrypt", icon: Lock },
              { id: "decrypt" as const, label: "Decrypt", icon: Unlock },
            ].map((m) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/30"
                      : "border border-border hover:bg-muted/30 text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <Card className="flex-1 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">
                {mode === "encrypt" ? "Encryption Settings" : "Remove Password"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-500 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Requires the <code>qpdf</code> command-line tool installed on this machine
                  and available on PATH. If this fails with "qpdf not found", install it
                  (e.g. <code>brew install qpdf</code> / <code>apt install qpdf</code> / the
                  Windows installer) and restart the app.
                </span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  {mode === "encrypt" ? "User Password" : "Current Password"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "encrypt" ? "Enter password to open document" : "Enter current password"}
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === "encrypt" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Owner Password (optional)</label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Restrict permissions"
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="w-80 shrink-0 flex flex-col gap-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm">Security Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Always remember your passwords. Lost passwords cannot be recovered.</span>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full gap-2 bg-orange-600 hover:bg-orange-700"
            disabled={isProcessing || !password}
            onClick={handleAction}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                {mode === "encrypt" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {mode === "encrypt" ? "Encrypt Document" : "Remove Password"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}