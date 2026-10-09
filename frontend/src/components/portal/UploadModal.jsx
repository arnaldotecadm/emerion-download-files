import { useEffect, useRef, useState } from "react";
import { UploadCloud, Loader2, FileUp, X, CheckCircle2, AlertCircle, FolderPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { getUploadUrl, uploadWithProgress, listVersionFiles, formatBytes } from "@/lib/api";

let _uid = 0;
const uid = () => `${Date.now()}-${_uid++}`;

// Suggest the next version: bump the minor and reset patch (1.5.0 -> 1.6.0).
// Falls back to 1.0.0 (new module) or the raw latest string for non-semver.
const suggestVersion = (latest) => {
  if (!latest) return "1.0.0";
  const m = String(latest).match(/^(\d+)\.(\d+)(?:\.(\d+))?(.*)$/);
  if (m) return `${m[1]}.${Number(m[2]) + 1}.0`;
  return latest;
};

const sanitizeSegment = (s) => s.trim().replace(/[/\\]/g, "").replace(/\s+/g, "-");

export const UploadModal = ({ open, onOpenChange, modules, defaultModule, idToken, uploaderName, uploaderEmail, onUploaded }) => {
  const [module, setModule] = useState(defaultModule || "");
  const [newModuleMode, setNewModuleMode] = useState(false);
  const [version, setVersion] = useState("1.0.0");
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState([]); // { id, file, progress, status }
  const [existingNames, setExistingNames] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const autoVersionRef = useRef("");

  const suggestFor = (modName) => {
    const m = modules.find((x) => x.module === modName);
    return suggestVersion(m?.latest_version);
  };

  useEffect(() => {
    if (open) {
      const initial = defaultModule || modules[0]?.module || "";
      setModule(initial);
      setNewModuleMode(modules.length === 0);
      const s = suggestFor(initial);
      setVersion(s);
      autoVersionRef.current = s;
      setItems([]);
      setSummary("");
      setExistingNames([]);
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultModule, modules]);

  // Overwrite guard: check what already exists at module/version.
  useEffect(() => {
    if (!open) return;
    const mod = sanitizeSegment(module);
    const ver = sanitizeSegment(version);
    if (!mod || !ver) {
      setExistingNames([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const existing = await listVersionFiles(mod, ver, idToken);
        if (active) setExistingNames(existing.map((f) => f.name));
      } catch {
        if (active) setExistingNames([]);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, module, version, idToken]);

  const onModuleChange = (val) => {
    setModule(val);
    if (!version || version === autoVersionRef.current) {
      const s = suggestFor(val);
      setVersion(s);
      autoVersionRef.current = s;
    }
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setItems((prev) => {
      const existing = new Set(prev.map((p) => p.file.name + p.file.size));
      const add = incoming
        .filter((f) => !existing.has(f.name + f.size))
        .map((f) => ({ id: uid(), file: f, progress: 0, status: "pending" }));
      return [...prev, ...add];
    });
  };

  const removeItem = (id) => setItems((prev) => prev.filter((p) => p.id !== id));

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const setProgress = (id, patch) =>
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const incomingNames = items.map((i) => i.file.name);
  const collisions = incomingNames.filter((n) => existingNames.includes(n));
  const hasReadmeFile = items.some((it) => it.file.name.toLowerCase() === "readme.md");

  const submit = async () => {
    const mod = sanitizeSegment(module);
    const ver = sanitizeSegment(version);
    if (!mod || !ver || items.length === 0) {
      toast.error("Enter a module, version and at least one file");
      return;
    }
    if (!hasReadmeFile && !summary.trim()) {
      toast.error("Enter version notes or include a README.md file");
      return;
    }
    setBusy(true);
    const queue = [...items];
    if (!hasReadmeFile && summary.trim()) {
      const safeName = (uploaderName || "Unknown user")
        .replace(/[\r\n]+/g, " ")
        .replace(/([\\`*_[\]<>])/g, "\\$1");
      const safeEmail = uploaderEmail
        ?.replace(/[\r\n]+/g, " ")
        .replace(/([\\`*_[\]<>])/g, "\\$1");
      const uploader = safeEmail
        ? `${safeName} ([${safeEmail}](mailto:${encodeURIComponent(uploaderEmail)}))`
        : safeName;
      const metadata = `**Uploaded by:** ${uploader}  \n**Uploaded at:** ${new Date().toISOString()}\n\n`;
      const readme = new File([`${metadata}**Changes:**\n\n${summary.trim()}\n`], "README.md", { type: "text/markdown" });
      queue.push({ id: "readme", file: readme, progress: 0, status: "pending" });
    }
    let okCount = 0;
    for (const it of queue) {
      if (it.status === "done") {
        okCount++;
        continue;
      }
      try {
        setProgress(it.id, { status: "uploading", progress: 0 });
        const { url } = await getUploadUrl(mod, ver, it.file.name, idToken);
        await uploadWithProgress(url, it.file, (p) => setProgress(it.id, { progress: p }));
        setProgress(it.id, { status: "done", progress: 100 });
        okCount++;
      } catch {
        setProgress(it.id, { status: "error" });
      }
    }
    setBusy(false);
    if (okCount > 0) {
      toast.success(`Uploaded ${okCount} file(s) to ${mod}/${ver}`);
      onUploaded?.();
    }
    if (okCount === queue.length) onOpenChange(false);
    else toast.error(`${queue.length - okCount} file(s) failed`);
  };

  const targetLabel = `${sanitizeSegment(module) || "<module>"}/${sanitizeSegment(version) || "<version>"}/`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="upload-modal" className="max-h-[90vh] overflow-y-auto border-border bg-popover/95 backdrop-blur-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-lg text-slate-50">
            <UploadCloud className="h-5 w-5 text-primary" /> Upload Artifacts
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Admin only. Files upload to{" "}
            <span className="font-mono text-slate-200">{targetLabel}</span> in the S3 bucket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Module */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Module</Label>
              <button
                type="button"
                data-testid="toggle-new-module"
                onClick={() => {
                  const next = !newModuleMode;
                  setNewModuleMode(next);
                  if (next) {
                    setModule("");
                    const s = suggestVersion(null);
                    setVersion(s);
                    autoVersionRef.current = s;
                  } else {
                    onModuleChange(modules[0]?.module || "");
                  }
                }}
                className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary hover:text-primary/80"
              >
                {newModuleMode ? <X className="h-3 w-3" /> : <FolderPlus className="h-3 w-3" />}
                {newModuleMode ? "Pick existing" : "New module"}
              </button>
            </div>
            {newModuleMode ? (
              <Input
                data-testid="upload-module-input"
                value={module}
                onChange={(e) => onModuleChange(e.target.value)}
                placeholder="e.g. EFolha"
                className="border-border bg-background/60 font-mono text-sm text-slate-200"
              />
            ) : (
              <>
                <Input
                  data-testid="upload-module-input"
                  list="module-suggestions"
                  value={module}
                  onChange={(e) => onModuleChange(e.target.value)}
                  placeholder="Select or type a module"
                  className="border-border bg-background/60 font-mono text-sm text-slate-200"
                />
                <datalist id="module-suggestions">
                  {modules.map((m) => (
                    <option key={m.module} value={m.module} />
                  ))}
                </datalist>
              </>
            )}
          </div>

          {/* Version notes -> README.md (overridden by an uploaded README.md file) */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Version notes (saved as README.md)
            </Label>
            <Textarea
              data-testid="upload-version-notes"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={hasReadmeFile}
              required={!hasReadmeFile}
              aria-required={!hasReadmeFile}
              placeholder="Write anything about this version — changes, highlights, instructions… (Markdown supported)"
              rows={3}
              className="border-border bg-background/60 font-sans text-sm text-slate-200 disabled:opacity-50"
            />
            {hasReadmeFile && (
              <p data-testid="readme-file-override-note" className="font-mono text-[10px] text-amber-300">
                A README.md file is included in your upload — it will be used instead of these notes.
              </p>
            )}
          </div>

          {/* Version (free text) */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Version (free text — suggested: next minor)
            </Label>
            <Input
              data-testid="upload-version-input"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.6.0"
              className="border-border bg-background/60 font-mono text-sm text-slate-200"
            />
          </div>

          {/* Overwrite guard */}
          {existingNames.length > 0 && (
            <div
              data-testid="overwrite-warning"
              className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-[11px] text-amber-300"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                This version already contains {existingNames.length} file(s).
                {collisions.length > 0 && (
                  <span className="text-amber-200"> {collisions.length} will be overwritten: {collisions.join(", ")}</span>
                )}
              </div>
            </div>
          )}

          {/* Dropzone */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Files</Label>
            <label
              htmlFor="upload-file-input"
              data-testid="upload-dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-7 text-center transition-colors ${
                dragging
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/40 hover:border-primary/40 hover:bg-secondary/30"
              }`}
            >
              <FileUp className={`h-6 w-6 ${dragging ? "text-primary" : "text-primary/80"}`} />
              <span className="font-mono text-xs text-slate-300">
                {dragging ? "Drop files here" : "Drag & drop or click to choose file(s)"}
              </span>
              <input
                id="upload-file-input"
                data-testid="upload-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {items.length > 0 && (
              <div className="max-h-56 space-y-2 overflow-y-auto pt-1">
                {items.map((it) => (
                  <div
                    key={it.id}
                    data-testid={`upload-file-item-${it.file.name}`}
                    className="rounded-md border border-border bg-background/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs text-slate-200">{it.file.name}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{formatBytes(it.file.size)}</span>
                        {it.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                        {it.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                        {!busy && it.status !== "done" && (
                          <button
                            type="button"
                            data-testid={`upload-remove-file-${it.file.name}`}
                            onClick={() => removeItem(it.id)}
                            className="text-muted-foreground hover:text-slate-200"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {(it.status === "uploading" || it.status === "done") && (
                      <div className="mt-2 flex items-center gap-2">
                        <Progress data-testid={`upload-file-progress-${it.file.name}`} value={it.progress} className="h-1.5" />
                        <span className="w-9 text-right font-mono text-[10px] text-muted-foreground">{it.progress}%</span>
                      </div>
                    )}
                    {it.status === "error" && (
                      <div className="mt-1 font-mono text-[10px] text-destructive">Upload failed — retry</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            data-testid="upload-submit-button"
            onClick={submit}
            disabled={busy || items.length === 0}
            className="w-full gap-2 bg-primary font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {busy ? "UPLOADING…" : `UPLOAD ${items.length || ""}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
