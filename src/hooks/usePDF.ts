import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as pdfService from "@services/pdf";

export function usePDFDocument(path: string | null) {
  return useQuery({
    queryKey: ["pdf", path],
    queryFn: () => (path ? pdfService.openPDF(path) : null),
    enabled: !!path,
  });
}

export function usePDFMetadata(path: string | null) {
  return useQuery({
    queryKey: ["pdf-metadata", path],
    queryFn: () => (path ? pdfService.getPDFMetadata(path) : null),
    enabled: !!path,
  });
}

export function usePDFPages(path: string | null) {
  return useQuery({
    queryKey: ["pdf-pages", path],
    queryFn: () => (path ? pdfService.getPDFPages(path) : []),
    enabled: !!path,
  });
}

export function useMergePDFs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { paths: string[]; outputPath: string }) =>
      pdfService.mergePDFs(params.paths, params.outputPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-files"] });
    },
  });
}

export function useSplitPDF() {
  return useMutation({
    mutationFn: (params: {
      path: string;
      ranges: { start: number; end: number }[];
      outputDir: string;
    }) => pdfService.splitPDF(params.path, params.ranges, params.outputDir),
  });
}

export function useCompressPDF() {
  return useMutation({
    mutationFn: (params: {
      path: string;
      outputPath: string;
      quality: "low" | "medium" | "high";
    }) => pdfService.compressPDF(params.path, params.outputPath, params.quality),
  });
}

export function useConvertPDF() {
  return useMutation({
    mutationFn: (params: {
      path: string;
      outputPath: string;
      format: "png" | "jpg" | "txt" | "pdfa";
    }) => pdfService.convertPDF(params.path, params.outputPath, params.format),
  });
}

export function useEncryptPDF() {
  return useMutation({
    mutationFn: (params: {
      path: string;
      outputPath: string;
      userPassword: string;
      ownerPassword?: string;
    }) =>
      pdfService.encryptPDF(
        params.path,
        params.outputPath,
        params.userPassword,
        params.ownerPassword
      ),
  });
}

export function useDecryptPDF() {
  return useMutation({
    mutationFn: (params: { path: string; outputPath: string; password: string }) =>
      pdfService.decryptPDF(params.path, params.outputPath, params.password),
  });
}

export function useRotatePages() {
  return useMutation({
    mutationFn: (params: {
      path: string;
      outputPath: string;
      pages: number[];
      angle: number;
    }) => pdfService.rotatePages(params.path, params.outputPath, params.pages, params.angle),
  });
}

export function useDeletePages() {
  return useMutation({
    mutationFn: (params: { path: string; outputPath: string; pages: number[] }) =>
      pdfService.deletePages(params.path, params.outputPath, params.pages),
  });
}
