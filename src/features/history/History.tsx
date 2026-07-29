import { motion } from "framer-motion";
import { Clock, FileText, Trash2, ExternalLink, Filter, Search, ArrowDownAZ, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { ScrollArea } from "@components/ui/scroll-area";
import { useAppStore } from "@stores/appStore";
import { formatFileSize, formatDate } from "@utils/index";

export function History() {
  const { recentFiles, clearRecentFiles } = useAppStore();

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500/20 to-slate-600/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">History</h2>
            <p className="text-sm text-muted-foreground">Track all your PDF operations</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 min-h-0">
        <Card className="h-full flex flex-col border-border/50">
          <CardHeader className="py-4 flex flex-row items-center justify-between shrink-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-naviki-400" />
              Recent Operations
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm">
                <Search className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon-sm">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon-sm">
                <ArrowDownAZ className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearRecentFiles}
                className="text-destructive hover:text-destructive"
                disabled={recentFiles.length === 0}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="px-4 pb-4 space-y-1">
              {recentFiles.map((item, index) => (
                <motion.div
                  key={`${item.path}-${item.openedAt}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-naviki-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-naviki-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {item.pageCount != null && <span>{item.pageCount} pages</span>}
                      {item.pageCount != null && item.size != null && <span>·</span>}
                      {item.size != null && <span>{formatFileSize(item.size)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.action && (
                      <span className="text-xs px-2 py-1 rounded-full bg-muted font-medium">{item.action}</span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.openedAt)}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
              {recentFiles.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No history yet</p>
                  <p className="text-sm">Files you open, merge, split, compress, convert, or protect will show up here</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}