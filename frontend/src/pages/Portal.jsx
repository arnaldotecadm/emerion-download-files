import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Boxes, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Header } from "@/components/portal/Header";
import { ReleaseBanner } from "@/components/portal/ReleaseBanner";
import { FileTable } from "@/components/portal/FileTable";
import { ReadmeNotes } from "@/components/portal/ReadmeNotes";
import { PresignedModal } from "@/components/portal/PresignedModal";
import { UploadModal } from "@/components/portal/UploadModal";
import { useAuth } from "react-oidc-context";
import { cognitoSignOut } from "@/auth";
import { getStatus, getModules, getModule, getDownloadUrl, getFileText, deleteKey, deleteVersion } from "@/lib/api";

const triggerBrowserDownload = (url) => {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const saveUrlToHandle = async (url, fileHandle) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
  const writable = await fileHandle.createWritable();
  await writable.write(await response.blob());
  await writable.close();
};

const isPickerCancelled = (error) => error?.name === "AbortError";

export default function Portal() {
  const supportsSaveFilePicker =
    typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
  const supportsDirectoryPicker =
    typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  const auth = useAuth();
  const idToken = auth.isAuthenticated ? auth.user?.id_token : undefined;
  const email =
    auth.user?.profile?.email ||
    auth.user?.profile?.preferred_username ||
    auth.user?.profile?.name ||
    auth.user?.profile?.["cognito:username"] ||
    auth.user?.profile?.sub;
  const groupsClaim = auth.user?.profile?.["cognito:groups"];
  const isAdmin = Array.isArray(groupsClaim)
    ? groupsClaim.includes("ADMIN")
    : groupsClaim === "ADMIN";
  const [uploadOpen, setUploadOpen] = useState(false);
  const [readmeText, setReadmeText] = useState(null);
  const [readmeLoading, setReadmeLoading] = useState(false);

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
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLink, setModalLink] = useState(null);

  const loadAll = useCallback(async (isRefresh) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [st, mods] = await Promise.all([getStatus(idToken), getModules(idToken)]);
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
  }, [selectedName, idToken]);

  useEffect(() => {
    loadAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const readme = (detail?.files || []).find((f) => f.name.toLowerCase() === "readme.md");
    if (!readme) {
      setReadmeText(null);
      return;
    }
    let active = true;
    setReadmeLoading(true);
    getFileText(readme.key, idToken)
      .then((t) => active && setReadmeText(t))
      .catch(() => active && setReadmeText(null))
      .finally(() => active && setReadmeLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, idToken]);

  const selectModule = (mod) => {
    setSelectedName(mod.module);
    setDetail(mod);
    setSelectedVersion(mod.latest_version);
    setSearch("");
  };

  const changeVersion = async (version) => {
    if (!detail) return;
    setSelectedVersion(version);
    setFilesLoading(true);
    try {
      const d = await getModule(detail.module, version, idToken);
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
      const fileHandlePromise = supportsSaveFilePicker
        ? window.showSaveFilePicker({ suggestedName: file.name })
        : null;
      const fileHandle = fileHandlePromise ? await fileHandlePromise : null;
      const link = await getDownloadUrl(file.key, idToken);
      if (fileHandle) {
        await saveUrlToHandle(link.url, fileHandle);
        toast.success(`Saved ${file.name}`);
        return;
      }
      triggerBrowserDownload(link.url);
      setModalLink(link);
      setModalOpen(true);
      toast.success(`Download link generated for ${file.name}`);
    } catch (error) {
      if (!isPickerCancelled(error)) toast.error(`Could not download ${file.name}`);
    } finally {
      setDownloadingKey(null);
    }
  };

  const downloadAll = async () => {
    if (!detail?.files?.length) return;
    setDownloadingAll(true);
    try {
      const directoryHandlePromise = supportsDirectoryPicker
        ? window.showDirectoryPicker({ mode: "readwrite" })
        : null;
      const directoryHandle = directoryHandlePromise ? await directoryHandlePromise : null;
      if (directoryHandle) {
        let savedCount = 0;
        const failedFiles = [];
        for (const file of detail.files) {
          try {
            const link = await getDownloadUrl(file.key, idToken);
            const fileHandle = await directoryHandle.getFileHandle(file.name, { create: true });
            await saveUrlToHandle(link.url, fileHandle);
            savedCount += 1;
          } catch {
            failedFiles.push(file.name);
          }
        }
        if (savedCount > 0) toast.success(`Saved ${savedCount} artifact(s) to the selected folder`);
        if (failedFiles.length > 0) toast.error(`Could not save: ${failedFiles.join(", ")}`);
        return;
      }
      for (const file of detail.files) {
        try {
          const link = await getDownloadUrl(file.key, idToken);
          triggerBrowserDownload(link.url);
          await new Promise((r) => setTimeout(r, 700));
        } catch {
          toast.error(`Skipped ${file.name}`);
        }
      }
      toast.success(`Started download of ${detail.files.length} artifacts`);
    } catch (error) {
      if (!isPickerCancelled(error)) toast.error("Could not start downloads");
    } finally {
      setDownloadingAll(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "file") {
        await deleteKey(deleteTarget.file.key, idToken);
        toast.success(`Deleted ${deleteTarget.file.name}`);
      } else {
        const r = await deleteVersion(detail.module, selectedVersion, idToken);
        toast.success(`Deleted version ${selectedVersion} (${r.count} file(s))`);
      }
      setDeleteTarget(null);
      await loadAll(true);
    } catch {
      toast.error("Delete failed — ensure you are signed in as ADMIN");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        status={status}
        onRefresh={() => loadAll(true)}
        refreshing={refreshing}
        auth={{
          isAuthenticated: auth.isAuthenticated,
          isLoading: auth.isLoading,
          email,
          onSignIn: () => auth.signinRedirect(),
          onSignOut: () => cognitoSignOut(auth),
        }}
      />

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
                    canChooseDownloadFolder={supportsDirectoryPicker}
                    isAdmin={isAdmin && auth.isAuthenticated}
                    onUpload={() => setUploadOpen(true)}
                    onDeleteVersion={() => setDeleteTarget({ type: "version" })}
                  />
                  <ReadmeNotes content={readmeText} loading={readmeLoading} />
                  <FileTable
                    files={(detail?.files || []).filter((f) => f.name.toLowerCase() !== "readme.md")}
                    loading={filesLoading}
                    search={search}
                    setSearch={setSearch}
                    onDownload={download}
                    downloadingKey={downloadingKey}
                    canChooseDownloadLocation={supportsSaveFilePicker}
                    isAdmin={isAdmin && auth.isAuthenticated}
                    onDelete={(file) => setDeleteTarget({ type: "file", file })}
                    deletingKey={deleting && deleteTarget?.type === "file" ? deleteTarget.file.key : null}
                  />
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>

      <PresignedModal open={modalOpen} onOpenChange={setModalOpen} link={modalLink} />
      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        modules={modules}
        defaultModule={selectedName}
        idToken={idToken}
        uploaderEmail={email}
        onUploaded={() => loadAll(true)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="delete-confirm-dialog" className="border-border bg-popover/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-slate-50">
              {deleteTarget?.type === "file" ? "Delete file?" : "Delete entire version?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-xs text-muted-foreground">
              {deleteTarget?.type === "file"
                ? `This permanently removes "${deleteTarget?.file?.name}" from S3. This cannot be undone.`
                : `This permanently removes ALL files in ${detail?.module}/${selectedVersion}. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel" disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-confirm"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
