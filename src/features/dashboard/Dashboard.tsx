import { motion } from "framer-motion";
import {
  FileText,
  Merge,
  Scissors,
  Minimize2,
  RefreshCw,
  PenTool,
  Shield,
  Clock,
  ArrowRight,
  FileImage,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { useAppStore } from "@stores/appStore";
import { formatFileSize } from "@utils/index";
import type { SidebarItem } from "@apptypes/index";

const quickActions = [
  { id: "viewer" as SidebarItem, label: "Open PDF", icon: FileText, desc: "View and read documents", color: "from-blue-500/20 to-blue-600/20" },
  { id: "merge" as SidebarItem, label: "Merge PDFs", icon: Merge, desc: "Combine multiple files", color: "from-emerald-500/20 to-emerald-600/20" },
  { id: "split" as SidebarItem, label: "Split PDF", icon: Scissors, desc: "Extract pages", color: "from-amber-500/20 to-amber-600/20" },
  { id: "compress" as SidebarItem, label: "Compress", icon: Minimize2, desc: "Reduce file size", color: "from-rose-500/20 to-rose-600/20" },
  { id: "convert" as SidebarItem, label: "Convert", icon: RefreshCw, desc: "Change formats", color: "from-violet-500/20 to-violet-600/20" },
  { id: "editor" as SidebarItem, label: "Edit PDF", icon: PenTool, desc: "Modify content", color: "from-cyan-500/20 to-cyan-600/20" },
  { id: "security" as SidebarItem, label: "Security", icon: Shield, desc: "Encrypt & protect", color: "from-orange-500/20 to-orange-600/20" },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export function Dashboard() {
  const { setActiveSidebarItem, recentFiles } = useAppStore();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-naviki-400 to-naviki-600 flex items-center justify-center shadow-lg shadow-naviki-500/20">
            <FileImage className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              PixPDF <span className="text-naviki-400">X</span>
            </h1>
            <p className="text-sm text-muted-foreground">Next Generation PDF Studio</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-4 max-w-2xl">
          Professional PDF editing, conversion, and management powered by NAVIKI Labs.
          Fast, secure, and built for modern workflows.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
      >
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <motion.div key={action.id} variants={item}>
              <Card
                className="group cursor-pointer border-border/50 hover:border-naviki-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-naviki-500/5 bg-gradient-to-br from-card to-card/50"
                onClick={() => setActiveSidebarItem(action.id)}
              >
                <CardContent className="p-6">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className="w-6 h-6 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{action.label}</h3>
                  <p className="text-sm text-muted-foreground">{action.desc}</p>
                  <div className="flex items-center gap-1 mt-4 text-xs text-naviki-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Get started</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-naviki-400" />
                Activity Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatItem label="Documents Processed" value="1,247" trend="+12%" />
              <StatItem label="Storage Saved" value="4.2 GB" trend="+8%" />
              <StatItem label="Average Compression" value="64%" trend="+3%" />
              <StatItem label="Tasks Completed" value="89" trend="+24%" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="h-full border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-naviki-400" />
                Recent Files
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveSidebarItem("history")}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {recentFiles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No recent files</p>
                  <p className="text-sm">Open a PDF to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentFiles.slice(0, 5).map((file, i) => (
                    <motion.div
                      key={file.path}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-naviki-500/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-naviki-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.pageCount} pages · {formatFileSize(file.size || 0)}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{value}</span>
        <span className="text-xs text-emerald-500 font-medium">{trend}</span>
      </div>
    </div>
  );
}