import { useEffect } from "react";
import { MainLayout } from "@layouts/MainLayout";
import { ToastContainer } from "@components/ToastContainer";
import { Dashboard } from "@features/dashboard/Dashboard";
import { PDFViewer } from "@features/pdf-viewer/PDFViewer";
import { MergePDF } from "@features/merge/MergePDF";
import { SplitPDF } from "@features/split/SplitPDF";
import { CompressPDF } from "@features/compress/CompressPDF";
import { ConvertPDF } from "@features/converter/ConvertPDF";
import { Security } from "@features/security/Security";
import { PDFEditor } from "@features/editor/PDFEditor";
import { History } from "@features/history/History";
import { SettingsPage } from "@features/settings/Settings";
import { useAppStore } from "@stores/appStore";
import type { SidebarItem } from "@apptypes/index";

const featureComponents: Record<SidebarItem, React.ComponentType> = {
  dashboard: Dashboard,
  viewer: PDFViewer,
  merge: MergePDF,
  split: SplitPDF,
  compress: CompressPDF,
  convert: ConvertPDF,
  editor: PDFEditor,
  security: Security,
  history: History,
  settings: SettingsPage,
};

function App() {
  const { activeSidebarItem, settings } = useAppStore();

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  }, [settings.theme]);

  const ActiveComponent = featureComponents[activeSidebarItem];

  return (
    <>
      <MainLayout>
        <ActiveComponent />
      </MainLayout>
      <ToastContainer />
    </>
  );
}

export default App;