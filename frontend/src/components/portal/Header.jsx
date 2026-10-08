import { motion } from "framer-motion";
import { Database, RefreshCw, ShieldCheck, Boxes, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Header = ({ status, onRefresh, refreshing, auth }) => {
  const connected = status?.connected;
  return (
    <header
      data-testid="portal-header"
      className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-sm sm:text-base font-bold tracking-tight text-slate-50">
              EMERION<span className="text-primary"> // </span>RELEASE VAULT
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              S3 Artifact Distribution
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Badge
            data-testid="s3-bucket-status-badge"
            variant="outline"
            className={`hidden sm:inline-flex gap-1.5 border px-2.5 py-1 font-mono text-[11px] ${
              connected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            <span
              className={`live-dot h-1.5 w-1.5 rounded-full ${
                connected ? "bg-emerald-400" : "bg-destructive"
              }`}
            />
            {connected ? "S3 CONNECTED" : "DISCONNECTED"}
          </Badge>

          {status?.region && (
            <Badge
              variant="outline"
              className="hidden md:inline-flex gap-1.5 border-border bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-slate-300"
            >
              <Database className="h-3 w-3 text-primary" />
              {status.region}
            </Badge>
          )}

          <Badge
            variant="outline"
            className="hidden lg:inline-flex gap-1.5 border-border bg-secondary/40 px-2.5 py-1 font-mono text-[11px] text-slate-300"
          >
            <ShieldCheck className="h-3 w-3 text-amber-400" />
            15 MIN LINKS
          </Badge>

          {auth?.isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span data-testid="auth-user-email" className="hidden font-mono text-[11px] text-slate-300 sm:inline">
                {auth.email}
              </span>
              <Button
                data-testid="sign-out-button"
                onClick={auth.onSignOut}
                size="sm"
                variant="outline"
                className="gap-1.5 border-border bg-secondary/40 font-mono text-xs text-slate-200 hover:bg-secondary active:scale-[0.98]"
              >
                <LogOut className="h-3.5 w-3.5" /> SIGN OUT
              </Button>
            </div>
          ) : (
            <Button
              data-testid="sign-in-button"
              onClick={auth?.onSignIn}
              disabled={auth?.isLoading}
              size="sm"
              variant="outline"
              className="gap-1.5 border-primary/30 bg-primary/10 font-mono text-xs text-primary hover:bg-primary/20 active:scale-[0.98]"
            >
              <LogIn className="h-3.5 w-3.5" /> {auth?.isLoading ? "…" : "SIGN IN"}
            </Button>
          )}

          <Button
            data-testid="s3-refresh-bucket-button"
            onClick={onRefresh}
            disabled={refreshing}
            size="sm"
            className="gap-2 bg-primary font-mono text-xs font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
          >
            <motion.span
              animate={refreshing ? { rotate: 360 } : {}}
              transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : {}}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </motion.span>
            SYNC
          </Button>
        </div>
      </div>
    </header>
  );
};
