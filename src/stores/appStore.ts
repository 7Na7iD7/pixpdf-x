import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PDFDocument,
  AppSettings,
  RecentFile,
  ToastMessage,
  SidebarItem,
} from "@apptypes/index";

interface AppState {
  activeSidebarItem: SidebarItem;
  setActiveSidebarItem: (item: SidebarItem) => void;

  currentDocument: PDFDocument | null;
  openDocuments: PDFDocument[];
  setCurrentDocument: (doc: PDFDocument | null) => void;
  addOpenDocument: (doc: PDFDocument) => void;
  removeOpenDocument: (id: string) => void;

  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;

  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  recentFiles: RecentFile[];
  addRecentFile: (file: RecentFile) => void;
  clearRecentFiles: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeSidebarItem: "dashboard",
      setActiveSidebarItem: (item) => set({ activeSidebarItem: item }),

      currentDocument: null,
      openDocuments: [],
      setCurrentDocument: (doc) => set({ currentDocument: doc }),
      addOpenDocument: (doc) =>
        set((state) => ({
          openDocuments: state.openDocuments.some((d) => d.id === doc.id)
            ? state.openDocuments
            : [...state.openDocuments, doc],
        })),
      removeOpenDocument: (id) =>
        set((state) => ({
          openDocuments: state.openDocuments.filter((d) => d.id !== id),
          currentDocument:
            state.currentDocument?.id === id ? null : state.currentDocument,
        })),

      isSidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      toasts: [],
      addToast: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            { ...toast, id: `${Date.now()}-${Math.random()}` },
          ],
        })),
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      settings: {
        theme: "dark",
        language: "en",
        defaultZoom: 100,
        autoSave: true,
        showThumbnails: true,
        recentFilesLimit: 20,
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      recentFiles: [],
      addRecentFile: (file) =>
        set((state) => ({
          recentFiles: [
            file,
            ...state.recentFiles.filter((f) => f.path !== file.path),
          ].slice(0, state.settings.recentFilesLimit),
        })),
      clearRecentFiles: () => set({ recentFiles: [] }),
    }),
    {
      name: "pixpdf-x-storage",
      partialize: (state) => ({
        settings: state.settings,
        recentFiles: state.recentFiles,
        isSidebarCollapsed: state.isSidebarCollapsed,
      }),
    }
  )
);