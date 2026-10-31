export function cleanChatText(text: string) {
  return text
    .replace(/\n+\s*(Sources|แหล่งที่มา)\s*:?\s*[\s\S]*$/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\s*https?:\/\/[^\s)\]]+/g, "")
    .replace(/\s*\([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\)/g, "") // Strip (bu.ac.th) citations
    .replace(/\s*[-•]\s*$/g, "")
    .trim();
}
