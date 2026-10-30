export function normalizeWebSessionId(value: unknown) {
  if (typeof value !== "string") {
    return "web-chat-default";
  }

  const safeValue = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return safeValue ? `web-chat-${safeValue}` : "web-chat-default";
}
