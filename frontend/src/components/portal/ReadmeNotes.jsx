import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";

const mdComponents = {
  h1: (p) => <h1 className="mb-2 mt-1 font-mono text-xl font-bold text-slate-50" {...p} />,
  h2: (p) => <h2 className="mb-2 mt-4 font-mono text-lg font-semibold text-slate-100" {...p} />,
  h3: (p) => <h3 className="mb-1 mt-3 font-mono text-base font-semibold text-slate-100" {...p} />,
  p: (p) => <p className="mb-3 leading-relaxed text-slate-300" {...p} />,
  ul: (p) => <ul className="mb-3 list-disc space-y-1 pl-5 text-slate-300" {...p} />,
  ol: (p) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-slate-300" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  a: (p) => (
    <a className="text-primary underline underline-offset-2 hover:text-primary/80" target="_blank" rel="noopener noreferrer" {...p} />
  ),
  strong: (p) => <strong className="font-semibold text-slate-100" {...p} />,
  em: (p) => <em className="italic text-slate-200" {...p} />,
  hr: () => <hr className="my-4 border-border" />,
  code: (p) => <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-[12px] text-amber-300" {...p} />,
  pre: (p) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[12px] text-slate-200" {...p} />
  ),
  blockquote: (p) => <blockquote className="mb-3 border-l-2 border-primary/40 pl-3 italic text-slate-400" {...p} />,
  table: (p) => <table className="mb-3 w-full border-collapse text-left text-xs" {...p} />,
  th: (p) => <th className="border border-border px-2 py-1 font-mono text-slate-200" {...p} />,
  td: (p) => <td className="border border-border px-2 py-1 text-slate-300" {...p} />,
};

export const ReadmeNotes = ({ content, loading }) => {
  if (!loading && !content) return null;
  return (
    <div data-testid="readme-notes" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
        <FileText className="h-3.5 w-3.5" /> Release Notes
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
        </div>
      ) : (
        <div className="text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
