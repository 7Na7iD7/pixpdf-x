import { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings,
  Palette,
  Globe,
  FolderOpen,
  Keyboard,
  Info,
  Moon,
  Sun,
  Monitor,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Switch } from "@components/ui/switch";
import { Separator } from "@components/ui/separator";
import { useAppStore } from "@stores/appStore";
import { cn } from "@utils/index";

const languages = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "ja", label: "日本語" },
  { id: "zh", label: "中文" },
];

export function SettingsPage() {
  const { settings, updateSettings } = useAppStore();
  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "advanced" | "about">("general");

  const tabs = [
    { id: "general" as const, label: "General", icon: Settings },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    { id: "advanced" as const, label: "Advanced", icon: Settings },
    { id: "about" as const, label: "About", icon: Info },
  ];

  return (
    <div className="h-full flex">
      <div className="w-64 shrink-0 border-r border-border p-4">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-naviki-400 to-naviki-600 flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">Settings</span>
        </div>
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-2xl"
        >
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">General Settings</h3>
                <p className="text-sm text-muted-foreground">Configure basic application behavior</p>
              </div>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-naviki-400" />
                    Language
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {languages.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => updateSettings({ language: lang.id })}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                          settings.language === lang.id
                            ? "bg-naviki-500/10 border border-naviki-500/30 text-naviki-400"
                            : "border border-border hover:bg-muted/50"
                        )}
                      >
                        {lang.label}
                        {settings.language === lang.id && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-naviki-400" />
                    File Handling
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto-save sessions</p>
                      <p className="text-xs text-muted-foreground">Automatically save your work</p>
                    </div>
                    <Switch
                      checked={settings.autoSave}
                      onCheckedChange={(checked) => updateSettings({ autoSave: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Show thumbnails</p>
                      <p className="text-xs text-muted-foreground">Display page thumbnails in viewer</p>
                    </div>
                    <Switch
                      checked={settings.showThumbnails}
                      onCheckedChange={(checked) => updateSettings({ showThumbnails: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Appearance</h3>
                <p className="text-sm text-muted-foreground">Customize the look and feel</p>
              </div>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Palette className="w-4 h-4 text-naviki-400" />
                    Theme
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "light" as const, label: "Light", icon: Sun },
                      { id: "dark" as const, label: "Dark", icon: Moon },
                      { id: "system" as const, label: "System", icon: Monitor },
                    ].map((theme) => {
                      const Icon = theme.icon;
                      const isActive = settings.theme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => updateSettings({ theme: theme.id })}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                            isActive
                              ? "border-naviki-500/50 bg-naviki-500/5"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <Icon className={cn("w-6 h-6", isActive ? "text-naviki-400" : "text-muted-foreground")} />
                          <span className={cn("text-sm font-medium", isActive && "text-naviki-400")}>{theme.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">Advanced</h3>
                <p className="text-sm text-muted-foreground">Power user settings</p>
              </div>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-naviki-400" />
                    Keyboard Shortcuts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { key: "Ctrl + O", action: "Open file" },
                    { key: "Ctrl + S", action: "Save" },
                    { key: "Ctrl + Z", action: "Undo" },
                    { key: "Ctrl + Shift + Z", action: "Redo" },
                    { key: "Ctrl + F", action: "Search" },
                    { key: "Ctrl + +/-", action: "Zoom in/out" },
                  ].map((shortcut) => (
                    <div key={shortcut.key} className="flex items-center justify-between py-2">
                      <span className="text-sm">{shortcut.action}</span>
                      <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono border border-border">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-1">About PixPDF X</h3>
                <p className="text-sm text-muted-foreground">Next Generation PDF Studio</p>
              </div>

              <Card className="border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-naviki-400 to-naviki-600 flex items-center justify-center shadow-lg shadow-naviki-500/20">
                      <span className="text-2xl font-bold text-white">P</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold">
                        PixPDF <span className="text-naviki-400">X</span>
                      </h4>
                      <p className="text-sm text-muted-foreground">Version 1.0.0</p>
                      <p className="text-xs text-muted-foreground">by NAVIKI Labs</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">License</span>
                      <span>Commercial License</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rust Engine</span>
                      <span>v2.0.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tauri Runtime</span>
                      <span>v2.0.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">React</span>
                      <span>v18.3.1</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}