import {
  createAssignmentsFlex,
  createGreetingRichMessage,
  createStudyAnswerFlex,
  createStudyNoteFlex
} from "@/lib/flex-messages";
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
