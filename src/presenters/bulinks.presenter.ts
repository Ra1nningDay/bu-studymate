import type { BuLinksPost } from "@/lib/bulinks";

type Link = { title: string; url: string };
export type BuLinksLang = "th" | "en";

const bangkok = { timeZone: "Asia/Bangkok" } as const;
const formats = {
  th: {
    date: new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", ...bangkok }),
    time: new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...bangkok })
  },
  en: {
    date: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", ...bangkok }),
    time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...bangkok })
  }
} as const;
const copy = {
  th: {
    header: (time: string) => `ประกาศและข่าวล่าสุดจาก BU Links (ตรวจสอบเมื่อ ${time} น. เวลาไทย):`,
    more: "ดูเพิ่มเติม:",
    footer: "นี่เป็นเพียงหัวข้อล่าสุด กรุณาเปิดลิงก์เพื่ออ่านรายละเอียดก่อนตัดสินใจ",
    services: "StudyMate ยังไม่มีข้อมูลที่ยืนยันได้ในคลังสำหรับเรื่องนี้ แต่พบหน้าบริการที่เกี่ยวข้องบน BU Links:"
  },
  en: {
    header: (time: string) => `Latest announcements and news from BU Links (checked at ${time} Thailand time):`,
    more: "More:",
    footer: "These are only the latest headlines. Please open the links and read the details before deciding.",
    services: "StudyMate has no verified answer for this yet, but these related BU Links pages were found:"
  }
} as const;
const linkLines = (links: Link[]) => links.map((link) => `- ${link.title}: ${link.url}`);

export function formatAnnouncements(posts: BuLinksPost[], extraLinks: Link[], now: Date, lang: BuLinksLang = "th") {
  const { date, time } = formats[lang];
  const text = copy[lang];
  const more = extraLinks.length ? [text.more, ...linkLines(extraLinks)] : [];
  // No posts means no check was made, so the reply must not claim one.
  if (!posts.length) return more.join("\n");
  return [
    text.header(time.format(now)),
    ...posts.map((post, index) => `${index + 1}. ${post.title} (${date.format(post.publishedAt)})\n   ${post.url}`),
    ...more,
    text.footer
  ].join("\n");
}

export function formatServiceLinks(pages: Link[], lang: BuLinksLang = "th") {
  return [copy[lang].services, ...linkLines(pages)].join("\n");
}
