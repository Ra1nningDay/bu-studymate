import type { BuLinksPost } from "@/lib/bulinks";

type Link = { title: string; url: string };

const bangkok = { timeZone: "Asia/Bangkok" } as const;
const dateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", ...bangkok });
const timeFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...bangkok });
const linkLines = (links: Link[]) => links.map((link) => `- ${link.title}: ${link.url}`);

export function formatAnnouncements(posts: BuLinksPost[], extraLinks: Link[], now: Date) {
  const more = extraLinks.length ? ["ดูเพิ่มเติม:", ...linkLines(extraLinks)] : [];
  // No posts means no check was made, so the reply must not claim one.
  if (!posts.length) return more.join("\n");
  return [
    `ประกาศและข่าวล่าสุดจาก BU Links (ตรวจสอบเมื่อ ${timeFormat.format(now)} น. เวลาไทย):`,
    ...posts.map((post, index) => `${index + 1}. ${post.title} (${dateFormat.format(post.publishedAt)})\n   ${post.url}`),
    ...more,
    "นี่เป็นเพียงหัวข้อล่าสุด กรุณาเปิดลิงก์เพื่ออ่านรายละเอียดก่อนตัดสินใจ"
  ].join("\n");
}

export function formatServiceLinks(pages: Link[]) {
  return ["StudyMate ยังไม่มีข้อมูลที่ยืนยันได้ในคลังสำหรับเรื่องนี้ แต่พบหน้าบริการที่เกี่ยวข้องบน BU Links:", ...linkLines(pages)].join("\n");
}
