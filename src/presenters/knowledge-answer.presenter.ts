import type { ActionLink } from "@/src/dtos/knowledge.dto";

export function appendActionLinks(text: string, links: ActionLink[]) {
  if (!links.length) return text;
  return `${text}\n\nลิงก์สำหรับทำรายการ:\n${links.map((link) => `- ${link.label}: ${link.url}`).join("\n")}`;
}
