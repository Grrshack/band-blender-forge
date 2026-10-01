import { Download, FileText, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { encodeShare, exportMarkdown, exportText, shareUrl, type SharePayload } from "@/lib/share";

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "song";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Copy a read-only share link, or download the sheet as text / markdown. */
export function ShareExport({ payload, disabled }: { payload: SharePayload; disabled: boolean }) {
  const copyLink = async () => {
    try {
      const token = await encodeShare(payload);
      const url = shareUrl(window.location.origin, window.location.pathname, token);
      await navigator.clipboard.writeText(url);
      toast.success(
        url.length > 6000
          ? "Link copied. It's long, so some apps may cut it off — use the .txt download for those."
          : "Share link copied.",
      );
    } catch {
      toast.error("Couldn't copy the link. Try the .txt download instead.");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
        Share & export
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => void copyLink()}
          className="h-8 gap-1.5 text-xs"
        >
          <Link2 className="size-3.5" /> Copy share link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => download(`${slug(payload.title)}.txt`, exportText(payload), "text/plain")}
          className="h-8 gap-1.5 text-xs"
        >
          <FileText className="size-3.5" /> Download .txt
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            download(`${slug(payload.title)}.md`, exportMarkdown(payload), "text/markdown")
          }
          className="h-8 gap-1.5 text-xs"
        >
          <Download className="size-3.5" /> Download .md
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        The link holds the whole sheet inside itself — nothing is stored on a server. Anyone who has
        it can read the sheet, and it can't be taken back once shared.
      </p>
    </div>
  );
}
