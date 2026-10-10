import { motion } from "framer-motion";
import { Calendar, FolderGit2, HardDrive, Files, DownloadCloud, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/lib/api";

const Stat = ({ icon: Icon, label, value, testId }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3">
    <div className="grid h-9 w-9 place-items-center rounded-md border border-primary/20 bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </div>
    <div className="leading-tight">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div data-testid={testId} className="font-mono text-sm font-semibold text-slate-100">
        {value}
      </div>
    </div>
  </div>
);

export const ReleaseBanner = ({ module, selectedVersion, onVersionChange, onDownloadAll, downloadingAll, canChooseDownloadFolder, isAdmin, onUpload, onDeleteVersion }) => {
  if (!module) return null;
  const hasFiles = module.file_count > 0;
  const isLatestVersion =
    Boolean(module.latest_version) && selectedVersion === module.latest_version;
  return (
    <motion.div
      data-testid="latest-release-banner"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="tac-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {isLatestVersion && (
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-primary" />
                Latest Release
              </div>
            )}
            <h1
              data-testid="latest-folder-name"
              className="mt-1 font-mono text-3xl sm:text-4xl font-bold tracking-tight text-slate-50"
            >
              {module.module}
            </h1>
            <div
              data-testid="latest-folder-date"
              className="mt-1 flex items-center gap-2 font-mono text-sm text-muted-foreground"
            >
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              {selectedVersion || "unversioned"}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {module.versions?.length > 0 && (
              <Select value={selectedVersion} onValueChange={onVersionChange}>
                <SelectTrigger
                  data-testid="release-version-dropdown"
                  className="w-[180px] border-border bg-background/60 font-mono text-xs text-slate-200 backdrop-blur"
                >
                  <FolderGit2 className="mr-1 h-3.5 w-3.5 text-primary" />
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover/95 font-mono text-xs backdrop-blur-xl">
                  {module.versions.map((v, i) => (
                    <SelectItem key={v} value={v} data-testid={`version-option-${v}`}>
                      <span className="flex items-center gap-2">
                        {v}
                        {i === 0 && (
                          <span
                            data-testid="version-latest-tag"
                            className="rounded-full border border-primary/40 bg-primary/15 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-primary"
                          >
                            Latest
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isAdmin && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  data-testid="upload-artifacts-button"
                  onClick={onUpload}
                  variant="outline"
                  className="gap-2 border-primary/30 bg-primary/10 font-mono text-xs font-semibold text-primary hover:bg-primary/20 active:scale-[0.98]"
                >
                  <Upload className="h-4 w-4" />
                  UPLOAD
                </Button>
                <Button
                  data-testid="download-all-release-files-button"
                  onClick={onDownloadAll}
                  disabled={!hasFiles || downloadingAll}
                  className="gap-2 bg-primary font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
                >
                  <DownloadCloud className="h-4 w-4" />
                  {downloadingAll ? "PREPARING…" : canChooseDownloadFolder ? "CHOOSE FOLDER & DOWNLOAD" : "DOWNLOAD ALL"}
                </Button>
                {selectedVersion && hasFiles && (
                  <Button
                    data-testid="delete-version-button"
                    onClick={onDeleteVersion}
                    variant="outline"
                    className="gap-2 border-destructive/30 bg-destructive/10 font-mono text-xs font-semibold text-destructive hover:bg-destructive/20 active:scale-[0.98]"
                  >
                    <Trash2 className="h-4 w-4" />
                    DELETE VERSION
                  </Button>
                )}
              </div>
            )}
            {!isAdmin && (
              <Button
                data-testid="download-all-release-files-button"
                onClick={onDownloadAll}
                disabled={!hasFiles || downloadingAll}
                className="gap-2 bg-primary font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
              >
                <DownloadCloud className="h-4 w-4" />
                {downloadingAll ? "PREPARING…" : canChooseDownloadFolder ? "CHOOSE FOLDER & DOWNLOAD" : "DOWNLOAD ALL"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat icon={Files} label="Artifacts" value={module.file_count} testId="release-file-count" />
          <Stat icon={HardDrive} label="Total Size" value={formatBytes(module.total_size)} testId="release-total-size" />
          <Stat icon={FolderGit2} label="Versions" value={module.versions?.length || 1} testId="release-version-count" />
        </div>
      </div>
    </motion.div>
  );
};
