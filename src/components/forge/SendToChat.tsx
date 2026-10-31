import { Check, ExternalLink, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AI_CHATS, SUNO_MCP_URL, chatMessage, type ChatSong } from "@/lib/ai-chat";

/**
 * Copies a ready message for an AI assistant with Suno's connector, then opens that assistant.
 * Nothing is sent from Band Blender; the person pastes it into their own chat.
 */
export function SendToChat({ song, disabled }: { song: ChatSong; disabled?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);

  const go = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(chatMessage(song));
      setCopied(id);
      toast.success("Copied. Paste it into the chat.");
    } catch {
      toast.error("Couldn't copy. Use Copy all instead.");
    }
    window.open(url, "_blank", "noopener");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5 text-xs">
          <MessageSquare className="size-3.5" /> Send to AI chat
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 text-sm">
        <p className="font-medium">Make it from your AI assistant</p>
        <p className="text-xs text-muted-foreground">
          Copies a ready message with your title, style, exclude list and lyrics, then opens the chat. Paste it
          and your assistant creates the song on your Suno account, using your credits.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {AI_CHATS.map((c) => (
            <Button key={c.id} size="sm" variant="outline" onClick={() => void go(c.id, c.url)} className="gap-1 text-xs">
              {copied === c.id ? <Check className="size-3.5" /> : null}
              {c.label}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Needs Suno&apos;s connector (beta) turned on in that app.{" "}
          <a href={SUNO_MCP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2">
            Get early access <ExternalLink className="size-3" />
          </a>
          . Some apps only allow connectors on paid plans.
        </p>
      </PopoverContent>
    </Popover>
  );
}
