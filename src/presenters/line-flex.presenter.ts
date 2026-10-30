import {
  createAssignmentsFlex,
  createGreetingRichMessage,
  createStudyAnswerFlex,
  createStudyNoteFlex
} from "./line-flex.templates";
import type { TicketDraftDto } from "@/src/dtos/ticket.dto";

export class LineFlexPresenter {
  createGreetingRichMessage() {
    return createGreetingRichMessage();
  }

  createStudyNoteFlex(note: Parameters<typeof createStudyNoteFlex>[0]) {
    return createStudyNoteFlex(note);
  }

  createAssignmentsFlex(assignments: Parameters<typeof createAssignmentsFlex>[0]) {
    return createAssignmentsFlex(assignments);
  }

  createStudyAnswerFlex(courseName: string, title: string, answer: string) {
    return createStudyAnswerFlex(courseName, title, answer);
  }

  createStudentLinkTemplate(url: string) {
    return {
      type: "template",
      altText: "ยืนยันนักศึกษา BU",
      template: {
        type: "buttons",
        text: "ยืนยันว่าเป็นนักศึกษา BU ด้วยบัญชี Google @bumail.net (ลิงก์ใช้ได้ 10 นาที)",
        actions: [{ type: "uri", label: "เข้าสู่ระบบด้วย Google", uri: url }]
      }
    };
  }

  createStudentGateCard(url: string) {
    return {
      type: "flex",
      altText: "ยืนยันนักศึกษาก่อนใช้งาน",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: [
            { type: "text", text: "ยืนยันนักศึกษาก่อนใช้งาน", weight: "bold", size: "lg", color: "#06C755", wrap: true },
            {
              type: "text",
              text: "ยืนยันบัญชี Google @bumail.net ของคุณกับ LINE ก่อน แล้วส่งข้อความมาใหม่อีกครั้งครับ",
              size: "sm",
              wrap: true
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#06C755",
              action: { type: "uri", label: "ยืนยันบัญชี", uri: url }
            }
          ]
        }
      }
    };
  }

  createStudentLinkedMessage(email: string) {
    const [local, domain] = email.split("@");
    return {
      type: "text",
      text: `ยืนยันนักศึกษาสำเร็จแล้วครับ เชื่อมกับ ${local[0]}****@${domain} เริ่มถามได้เลย`
    };
  }

  createTicketConfirmTemplate(draft: TicketDraftDto) {
    return {
      type: "template",
      altText: "กรุณายืนยันการแจ้งปัญหา",
      template: {
        type: "confirm",
        text: `ข้อมูลถูกต้องไหมครับ?\nสถานที่: ${draft.location ?? "-"}\nห้อง: ${draft.room ?? "-"}\nปัญหา: ${draft.description ?? "-"}`,
        actions: [
          {
            type: "message",
            label: "ยืนยัน",
            text: "ยืนยัน"
          },
          {
            type: "message",
            label: "ยกเลิก",
            text: "ยกเลิก"
          }
        ]
      }
    };
  }
}

export const lineFlexPresenter = new LineFlexPresenter();
