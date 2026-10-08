import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Boxes, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/portal/Header";
import { ReleaseBanner } from "@/components/portal/ReleaseBanner";
import { FileTable } from "@/components/portal/FileTable";
import { PresignedModal } from "@/components/portal/PresignedModal";
import { getStatus, getModules, getModule, getDownloadUrl } from "@/lib/api";

const triggerBrowserDownload = (url) => {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export default function Portal() {
  const [status, setStatus] = useState(null);
  const [modules, setModules] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);

  const [loading, setLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLink, setModalLink] = useState(null);

  const loadAll = useCallback(async (isRefresh) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [st, mods] = await Promise.all([getStatus(), getModules()]);
      setStatus(st);
      setModules(mods);
      if (mods.length > 0) {
        const current = mods.find((m) => m.module === selectedName) || mods[0];
        setSelectedName(current.module);
        setDetail(current);
        setSelectedVersion(current.latest_version);
      } else {
        setDetail(null);
      }
    } catch (e) {
      setError("Unable to reach the S3 distribution service. Check AWS connectivity and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName]);

  useEffect(() => {
    loadAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectModule = (mod) => {
    setSelectedName(mod.module);
    setDetail(mod);
    setSelectedVersion(mod.latest_version);
    setSearch("");
    setFilter("all");
  };

  const changeVersion = async (version) => {
    if (!detail) return;
    setSelectedVersion(version);
    setFilesLoading(true);
    try {
      const d = await getModule(detail.module, version);
      setDetail(d);
    } catch {
      toast.error("Failed to load version files");
    } finally {
      setFilesLoading(false);
    }
  };

  const download = async (file) => {
    setDownloadingKey(file.key);
    try {
      const link = await getDownloadUrl(file.key);
      triggerBrowserDownload(link.url);
      setModalLink(link);
      setModalOpen(true);
      toast.success(`Download link generated for ${file.name}`);
    } catch {
      toast.error(`Could not generate link for ${file.name}`);
    } finally {
      setDownloadingKey(null);
    }
  };

  const downloadAll = async () => {
    if (!detail?.files?.length) return;
    setDownloadingAll(true);
    try {
      for (const file of detail.files) {
        try {
          const link = await getDownloadUrl(file.key);
          triggerBrowserDownload(link.url);
          await new Promise((r) => setTimeout(r, 700));
        } catch {
          toast.error(`Skipped ${file.name}`);
        }
      }
      toast.success(`Started download of ${detail.files.length} artifacts`);
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header status={status} onRefresh={() => loadAll(true)} refreshing={refreshing} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {error ? (
          <div
            data-testid="s3-error-alert"
            className="mx-auto mt-10 max-w-xl rounded-xl border border-destructive/40 bg-destructive/10 p-8 text-center"
          >
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-mono text-lg font-semibold text-slate-100">S3 Connection Error</h2>
            <p className="mt-2 font-sans text-sm text-muted-foreground">{error}</p>
            <Button
              data-testid="retry-fetch-s3-button"
              onClick={() => loadAll(true)}
              className="mt-5 gap-2 bg-primary font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="h-3.5 w-3.5" /> RETRY
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
            {/* Module sidebar */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <Boxes className="h-3.5 w-3.5 text-primary" /> Modules
              </div>
              <div data-testid="module-list" className="space-y-2">
                {loading && !modules.length
                  ? [...Array(3)].map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-card" />
                    ))
                  : modules.map((m) => {
                      const active = m.module === selectedName;
                      return (
                        <button
                          key={m.module}
                          data-testid={`module-item-${m.module}`}
                          onClick={() => selectModule(m)}
                          className={`group flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200 ${
                            active
                              ? "border-primary/40 bg-primary/10"
                              : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/25"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className={`truncate font-mono text-sm font-semibold ${active ? "text-primary" : "text-slate-100"}`}>
                              {m.module}
                            </div>
                            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                              {m.file_count} files · v{m.latest_version || "—"}
                            </div>
                          </div>
                          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${active ? "text-primary" : "text-muted-foreground group-hover:translate-x-0.5"}`} />
                        </button>
                      );
                    })}
                {!loading && !modules.length && (
                  <div className="rounded-lg border border-border bg-card p-4 font-sans text-xs text-muted-foreground">
                    No modules found in the bucket.
                  </div>
                )}
              </div>
            </aside>

            {/* Main content */}
            <div className="space-y-6">
              {loading && !detail ? (
                <div className="h-56 animate-pulse rounded-xl border border-border bg-card" />
              ) : (
                <motion.div
                  key={selectedName + selectedVersion}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <ReleaseBanner
                    module={detail}
                    selectedVersion={selectedVersion}
                    onVersionChange={changeVersion}
                    onDownloadAll={downloadAll}
                    downloadingAll={downloadingAll}
                  />
                  <FileTable
                    files={detail?.files || []}
                    loading={filesLoading}
                    search={search}
                    setSearch={setSearch}
                    filter={filter}
                    setFilter={setFilter}
                    onDownload={download}
                    downloadingKey={downloadingKey}
                  />
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>

      <PresignedModal open={modalOpen} onOpenChange={setModalOpen} link={modalLink} />
    </div>
  );
}
