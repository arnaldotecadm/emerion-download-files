import { motion } from "framer-motion";
import {
  Download,
  FileArchive,
  FileCog,
  FileCheck2,
  FileText,
  Binary,
  Loader2,
  Search,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, fileCategory } from "@/lib/api";

const CAT_ICON = {
  binaries: Binary,
  archives: FileArchive,
  configs: FileCog,
  checksums: FileCheck2,
  docs: FileText,
};

const CAT_COLOR = {
  binaries: "text-primary",
  archives: "text-amber-400",
  configs: "text-violet-400",
  checksums: "text-emerald-400",
  docs: "text-slate-300",
};

const FILTERS = [
  { id: "all", label: "All", testId: "filter-pill-all" },
  { id: "binaries", label: "Binaries", testId: "filter-pill-binaries" },
  { id: "archives", label: "Archives", testId: "filter-pill-archives" },
  { id: "configs", label: "Configs", testId: "filter-pill-configs" },
  { id: "checksums", label: "Checksums", testId: "filter-pill-checksums" },
];

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export const FileTable = ({
  files,
  loading,
  search,
  setSearch,
  filter,
  setFilter,
  onDownload,
  downloadingKey,
}) => {
  const visible = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || fileCategory(f.name) === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="artifact-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter artifacts…"
            className="border-border bg-card pl-9 font-mono text-sm text-slate-200 placeholder:text-muted-foreground focus-visible:ring-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              data-testid={f.testId}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150 ${
                filter === f.id
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary/60 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-12 gap-4 border-b border-border bg-background/40 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
          <div className="col-span-6">Artifact</div>
          <div className="col-span-2">Size</div>
          <div className="col-span-3">Modified</div>
          <div className="col-span-1 text-right">Get</div>
        </div>

        {loading ? (
          <div data-testid="artifact-loading-skeleton" className="divide-y divide-border">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-md bg-secondary" />
                <Skeleton className="h-4 w-1/3 bg-secondary" />
                <Skeleton className="ml-auto h-4 w-16 bg-secondary" />
                <Skeleton className="h-8 w-20 rounded-md bg-secondary" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div
            data-testid="empty-release-folder-state"
            className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
          >
            <div className="grid h-14 w-14 place-items-center rounded-full border border-border bg-background/40 text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <div className="font-mono text-sm text-slate-200">No artifacts found</div>
            <div className="max-w-sm font-sans text-xs text-muted-foreground">
              This release folder is empty or nothing matches your filter. Upload files to the
              latest dated folder in S3 to see them here.
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((f, idx) => {
              const cat = fileCategory(f.name);
              const Icon = CAT_ICON[cat] || FileText;
              const busy = downloadingKey === f.key;
              return (
                <motion.div
                  key={f.key}
                  data-testid={`artifact-file-row-${f.name}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  className="grid grid-cols-1 items-center gap-3 px-5 py-4 transition-colors duration-150 hover:bg-secondary/40 sm:grid-cols-12 sm:gap-4"
                >
                  <div className="col-span-6 flex min-w-0 items-center gap-3">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-background/50 ${CAT_COLOR[cat]}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div
                        data-testid="file-name-label"
                        className="truncate font-mono text-sm font-medium text-slate-100"
                      >
                        {f.name}
                      </div>
                      <Badge
                        variant="outline"
                        className="mt-0.5 border-border bg-background/40 px-1.5 py-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                      >
                        {cat}
                      </Badge>
                    </div>
                  </div>
                  <div
                    data-testid="file-size-label"
                    className="col-span-2 font-mono text-xs text-slate-300"
                  >
                    <span className="text-muted-foreground sm:hidden">Size: </span>
                    {formatBytes(f.size)}
                  </div>
                  <div className="col-span-3 font-mono text-xs text-muted-foreground">
                    {fmtDate(f.last_modified)}
                  </div>
                  <div className="col-span-1 flex sm:justify-end">
                    <Button
                      data-testid={`download-file-button-${f.name}`}
                      onClick={() => onDownload(f)}
                      disabled={busy}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-primary/30 bg-primary/10 font-mono text-[11px] text-primary hover:bg-primary/20 active:scale-[0.98]"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      <span className="sm:hidden">Download</span>
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
