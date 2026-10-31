/**
 * "Send to your AI chat": a ready-to-paste message for an AI assistant that has Suno's official
 * connector (Suno MCP, beta since Oct 28, 2026) turned on. Band Blender never talks to Suno
 * itself; the person's own assistant does, on their own Suno account and credits.
 */
import { SUNO_LIMITS } from "./suno";

export type ChatSong = { title: string; style: string; exclude: string; lyrics: string };

export const AI_CHATS = [
  { id: "claude", label: "Claude", url: "https://claude.ai/new" },
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
] as const;

export const SUNO_MCP_URL = "https://suno.com/mcp";

const clip = (s: string, max: number) => s.trim().slice(0, max);

/** The message to paste. Asks the assistant to use the fields exactly as written. */
export function chatMessage(song: ChatSong): string {
  const title = clip(song.title, SUNO_LIMITS.title);
  const style = clip(song.style, SUNO_LIMITS.style);
  const exclude = clip(song.exclude, SUNO_LIMITS.exclude);
  const lyrics = clip(song.lyrics, SUNO_LIMITS.lyrics);
  const parts = [
    "Use the Suno connector to create this song in custom mode. Use every field exactly as written below: don't rewrite, shorten or add to the lyrics or style unless I ask.",
    "",
    `Title: ${title || "(untitled)"}`,
    "",
    "Style:",
    style,
  ];
  if (exclude) parts.push("", "Exclude styles:", exclude);
  if (lyrics) parts.push("", "Lyrics:", lyrics);
  else parts.push("", "Make it an instrumental (no lyrics).");
  parts.push("", "When it's done, give me the links to both takes.");
  return parts.join("\n");
}
