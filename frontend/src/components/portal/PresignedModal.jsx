import { useEffect, useState } from "react";
import { Clock, Copy, ExternalLink, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const PresignedModal = ({ open, onOpenChange, link }) => {
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && link) {
      setRemaining(link.expires_in || 900);
      setCopied(false);
    }
  }, [open, link]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!link) return null;

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const expired = remaining <= 0;
  const pct = Math.max(0, (remaining / (link.expires_in || 900)) * 100);

  const copy = async () => {
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    toast.success("Presigned link copied to clipboard");
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="presigned-link-modal"
        className="border-border bg-popover/95 backdrop-blur-xl sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-lg text-slate-50">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Secure Download Link
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Short-lived AWS S3 presigned URL for{" "}
            <span className="font-mono text-slate-200">{link.name}</span>. The download has started
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Countdown */}
          <div className="rounded-lg border border-border bg-background/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                {expired ? "Link Expired" : "Expires In"}
              </div>
              <div
                data-testid="presigned-link-timer"
                className={`font-mono text-2xl font-bold tabular-nums ${
                  expired ? "text-destructive" : "text-primary"
                }`}
              >
                {mm}:{ss}
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                  expired ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* URL */}
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Presigned URL
            </div>
            <div className="max-h-16 overflow-y-auto break-all font-mono text-[11px] text-slate-300">
              {link.url}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              data-testid="copy-presigned-url-button"
              onClick={copy}
              variant="outline"
              className="flex-1 gap-2 border-border bg-secondary/40 font-mono text-xs text-slate-200 hover:bg-secondary active:scale-[0.98]"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button
              data-testid="open-presigned-url-button"
              onClick={() => window.open(link.url, "_blank", "noopener")}
              disabled={expired}
              className="flex-1 gap-2 bg-primary font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" />
              Open / Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
