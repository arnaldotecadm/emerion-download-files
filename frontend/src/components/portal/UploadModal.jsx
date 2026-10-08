import { useEffect, useState } from "react";
import { UploadCloud, Loader2, FileUp } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadFiles, formatBytes } from "@/lib/api";

const today = () => new Date().toISOString().slice(0, 10);

export const UploadModal = ({ open, onOpenChange, modules, defaultModule, accessToken, onUploaded }) => {
  const [module, setModule] = useState(defaultModule || "");
  const [version, setVersion] = useState(today());
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setModule(defaultModule || (modules[0]?.module ?? ""));
      setVersion(today());
      setFiles([]);
    }
  }, [open, defaultModule, modules]);

  const submit = async () => {
    if (!module || !version || files.length === 0) {
      toast.error("Pick a module, version date and at least one file");
      return;
    }
    setBusy(true);
    try {
      const res = await uploadFiles(module, version, files, accessToken);
      toast.success(`Uploaded ${res.count} file(s) to ${module}/${version}`);
      onOpenChange(false);
      onUploaded?.();
    } catch (e) {
      const s = e?.response?.status;
      if (s === 401) toast.error("Please sign in again to upload");
      else if (s === 403) toast.error("Your account is not in the ADMIN group");
      else toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="upload-modal" className="border-border bg-popover/95 backdrop-blur-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-lg text-slate-50">
            <UploadCloud className="h-5 w-5 text-primary" /> Upload Artifacts
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Admin only. Files upload to{" "}
            <span className="font-mono text-slate-200">{module}/{version}/</span> in the S3 bucket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Module</Label>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger data-testid="upload-module-select" className="border-border bg-background/60 font-mono text-sm text-slate-200">
                <SelectValue placeholder="Select module" />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover/95 font-mono text-xs backdrop-blur-xl">
                {modules.map((m) => (
                  <SelectItem key={m.module} value={m.module}>{m.module}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Version (date folder)</Label>
            <Input
              data-testid="upload-version-input"
              type="date"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="border-border bg-background/60 font-mono text-sm text-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Files</Label>
            <label
              htmlFor="upload-file-input"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/40 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-secondary/30"
            >
              <FileUp className="h-6 w-6 text-primary" />
              <span className="font-mono text-xs text-slate-300">Click to choose file(s)</span>
              <input
                id="upload-file-input"
                data-testid="upload-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </label>
            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-1.5">
                    <span className="truncate font-mono text-xs text-slate-200">{f.name}</span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">{formatBytes(f.size)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            data-testid="upload-submit-button"
            onClick={submit}
            disabled={busy}
            className="w-full gap-2 bg-primary font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {busy ? "UPLOADING…" : "UPLOAD"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
