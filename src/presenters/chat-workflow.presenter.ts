import type { SavedStudyNote } from "@/src/services/study-memory.service";

export function formatSavedStudyNoteReply(note: SavedStudyNote, isThai: boolean) {
  const lines = isThai
    ? [`สรุปบทเรียนให้แล้วครับ`, `วิชา: ${note.courseName}`]
    : [`Your study pack is ready.`, `Course: ${note.courseName}`];

  if (note.keyPoints.length > 0) {
    lines.push(isThai ? "หัวข้อหลัก:" : "Key topics:");
    lines.push(...note.keyPoints.slice(0, 5).map((point) => `- ${point}`));
  }

  if (note.summary) {
    lines.push(isThai ? `จำง่าย ๆ: ${note.summary}` : `Easy summary: ${note.summary}`);
  }

  if (note.assignments.length > 0) {
    lines.push(isThai ? "งานที่พบ:" : "Assignments found:");
    for (const assignment of note.assignments) {
      lines.push(`- ${assignment.title}`);
      if (assignment.dueDateText) {
        lines.push(isThai ? `  กำหนดส่ง: ${assignment.dueDateText}` : `  Due: ${assignment.dueDateText}`);
      }
    }
  }

  lines.push(
    isThai
      ? "เลือกปุ่มใน Study Pack เพื่อให้ช่วยติวต่อได้เลยครับ"
      : "Use the Study Pack buttons if you want me to tutor you from this material."
  );

  return lines.join("\n");
}

export function formatAssignmentsReply(
  assignments: Array<{
    courseName: string;
    title: string;
    description: string | null;
    dueDateText: string | null;
    dueAt: Date | null;
  }>,
  isThai: boolean
) {
  if (assignments.length === 0) {
    return isThai ? "ยังไม่พบ assignment ในโน้ตที่บันทึกไว้ครับ" : "No assignments found in your saved notes.";
  }

  return assignments
    .map((assignment) => {
      const lines = [`${assignment.courseName}: ${assignment.title}`];
      if (assignment.dueDateText || assignment.dueAt) {
        const dueDate = assignment.dueDateText ?? assignment.dueAt?.toISOString();
        lines.push(isThai ? `กำหนดส่ง: ${dueDate}` : `Due: ${dueDate}`);
      }
      if (assignment.description) {
        lines.push(isThai ? `รายละเอียด: ${assignment.description}` : `Details: ${assignment.description}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export type LineQuickReplyItem = {
  type: "action";
  action: {
    type: "message";
    label: string;
    text: string;
  };
};

export type LineQuickReply = {
  items: LineQuickReplyItem[];
};

export const askBuInfoQuickReply: LineQuickReply = {
  items: [
    {
      type: "action",
      action: {
        type: "message",
        label: "📶 Wi-Fi",
        text: "เชื่อมต่อ BU Wi-Fi ยังไง"
      }
    },
    {
      type: "action",
      action: {
        type: "message",
        label: "📧 BU Mail",
        text: "ลืมรหัสผ่าน BU Mail ต้องทำอย่างไร"
      }
    },
    {
      type: "action",
      action: {
        type: "message",
        label: "💳 ค่าเทอม",
        text: "ขอผ่อนชำระค่าเทอมได้ไหม"
      }
    },
    {
      type: "action",
      action: {
        type: "message",
        label: "📅 ปฏิทินการศึกษา",
        text: "ดูปฏิทินการศึกษาและวันหยุดที่ไหน"
      }
    },
    {
      type: "action",
      action: {
        type: "message",
        label: "📄 ขอใบรับรอง",
        text: "ขอใบรับรองนักศึกษายังไง"
      }
    },
    {
      type: "action",
      action: {
        type: "message",
        label: "🏛️ ติดต่อทะเบียน",
        text: "ติดต่อฝ่ายทะเบียนช่องทางไหน"
      }
    }
  ]
};

export const chatGuides = {
  UPLOAD_STUDY_MATERIAL: { text: "บันทึกบทเรียนได้ 2 วิธีครับ\n\n1. แนบไฟล์ PDF หรือ DOCX มาในแชตนี้ได้เลย\n\n2. พิมพ์โน้ตเป็นข้อความด้วยรูปแบบนี้:\n/addnote <ชื่อวิชา>\n<เนื้อหาที่เรียนหรืองานที่ต้องส่ง>\n\nตัวอย่าง:\n/addnote Marketing\nToday we learned customer segmentation.\nAssignment due Friday: create one customer persona.", step: { action: "Greeting Menu Guide", details: "Upload study material" } },
  ASK_BU_INFO_GUIDE: {
    text: "อยากรู้เรื่องไหนเกี่ยวกับ BU พิมพ์ถามได้เลยครับ 😊\n\nตัวอย่างคำถาม\n• เชื่อมต่อ BU Wi-Fi ยังไง\n• ลืมรหัสผ่าน BU Mail ต้องทำอย่างไร\n• ขอผ่อนชำระค่าเทอมได้ไหม\n• ดูปฏิทินการศึกษาและวันหยุดที่ไหน\n• ขอใบรับรองนักศึกษายังไง\n• ติดต่อฝ่ายทะเบียนช่องทางไหน\n\nหรือเปิดเว็บไซต์โดยตรง\n🔗 BU Links — บริการนักศึกษาและประกาศ: https://bulinks.bu.ac.th/\n🔗 BU FAQ — บัญชีผู้ใช้ Wi-Fi และบริการ IT: https://faq.bu.ac.th/",
    quickReply: askBuInfoQuickReply,
    step: { action: "Greeting Menu Guide", details: "Ask BU info" }
  },
  REPORT_ISSUE_GUIDE: { text: "แจ้งอาคาร ห้อง และรายละเอียดปัญหาได้เลยครับ\n\nตัวอย่าง:\nอาคาร A3 ชั้น 2 ห้อง LAB 2 แอร์ไม่เย็น", step: { action: "Greeting Menu Guide", details: "Report classroom issue" } },
  ASK_LATEST_STUDY_GUIDE: { text: "พิมพ์คำถามเกี่ยวกับบทเรียนล่าสุดได้เลยครับ\n\nตัวอย่าง:\n- อธิบายหัวข้อนี้ให้ง่ายขึ้น\n- จุดไหนสำคัญสุด\n- ออกข้อสอบจากบทเรียนนี้ให้หน่อย", step: { action: "Study Pack Guide", details: "Ask from latest lesson" } }
};

export function formatAddNoteUsageReply(isThai: boolean) {
  return isThai
    ? "ใช้รูปแบบนี้ครับ:\n/addnote <ชื่อวิชา>\n<เนื้อหาโน้ตหรือเลคเชอร์>"
    : "Please use this format:\n/addnote <Course Name>\n<Note content>";
}

export function formatTicketResetReply(isThai: boolean) {
  return isThai
    ? "รีเซ็ตบทสนทนาเรียบร้อยครับ พิมพ์เรื่องใหม่ที่ต้องการให้ช่วยได้เลยครับ"
    : "Conversation reset. How can I help you?";
}

export const ticketCodeRequiredReply = "ขอรหัส Ticket ด้วยครับ เช่น เช็ค ticket BU-TICKET-0001";

export function formatTicketNotFoundReply(ticketCode: string) {
  return `ยังไม่พบ Ticket: ${ticketCode} ครับ`;
}
