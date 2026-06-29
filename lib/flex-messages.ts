import type { SavedStudyNote } from "@/lib/study-memory";
import type { getAssignments } from "@/lib/study-memory";

export function createStudyNoteFlex(note: SavedStudyNote) {
  const assignments = note.assignments.map((assignment) => ({
    type: "box",
    layout: "vertical",
    spacing: "sm",
    margin: "md",
    contents: [
      {
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "กำหนดส่ง",
            color: "#777777",
            size: "sm",
            flex: 2
          },
          {
            type: "text",
            text: assignment.dueDateText || "-",
            color: "#222222",
            size: "sm",
            weight: "bold",
            wrap: true,
            flex: 5
          }
        ]
      },
      {
        type: "box",
        layout: "baseline",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "ชื่องาน",
            color: "#777777",
            size: "sm",
            flex: 2
          },
          {
            type: "text",
            text: assignment.title,
            color: "#222222",
            size: "sm",
            wrap: true,
            flex: 5
          }
        ]
      }
    ]
  }));

  const contents: any[] = [];
  
  if (assignments.length > 0) {
    contents.push({
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        {
          type: "text",
          text: "Assignment",
          size: "xs",
          color: "#888888",
          weight: "bold"
        },
        {
          type: "text",
          text: "พบการบ้าน/งาน",
          size: "xl",
          weight: "bold",
          color: "#222222",
          wrap: true
        }
      ]
    });
    contents.push({ type: "separator", margin: "md" });
    contents.push(...assignments);
  }

  if (note.summary) {
    contents.push({
      type: "box",
      layout: "vertical",
      spacing: "xs",
      margin: "lg",
      backgroundColor: "#F6F7FB",
      cornerRadius: "md",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text: "Summary",
          size: "sm",
          weight: "bold",
          color: "#333333"
        },
        {
          type: "text",
          text: note.summary,
          size: "sm",
          color: "#555555",
          wrap: true,
          margin: "sm"
        }
      ]
    });
  }

  if (contents.length === 0) {
    contents.push({
      type: "text",
      text: "บันทึกเรียบร้อย",
      size: "sm",
      color: "#555555"
    });
  }

  const flex = {
    type: "flex",
    altText: `บันทึกโน้ต ${note.courseName} แล้ว`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        backgroundColor: "#1DB446",
        contents: [
          {
            type: "text",
            text: "บันทึกโน้ตแล้ว",
            weight: "bold",
            size: "lg",
            color: "#FFFFFF"
          },
          {
            type: "text",
            text: note.courseName,
            size: "sm",
            color: "#E8FFF0",
            margin: "sm"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents
      }
    }
  };

  return flex;
}

export function createAssignmentsFlex(assignments: Awaited<ReturnType<typeof getAssignments>>) {
  if (assignments.length === 0) {
    return null;
  }

  const assignment = assignments[0]; 
  
  return {
    type: "flex",
    altText: `${assignment.courseName}: ${assignment.title}`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: assignment.courseName,
            weight: "bold",
            size: "lg",
            color: "#222222"
          },
          {
            type: "text",
            text: assignment.title,
            size: "md",
            color: "#444444",
            wrap: true
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "text",
            text: "กำหนดส่ง",
            size: "xs",
            color: "#888888",
            margin: "md"
          },
          {
            type: "text",
            text: assignment.dueDateText || assignment.dueAt?.toISOString() || "-",
            size: "xl",
            weight: "bold",
            color: "#1DB446",
            wrap: true
          },
          assignment.description ? {
            type: "text",
            text: `รายละเอียด: ${assignment.description}`,
            size: "sm",
            color: "#555555",
            wrap: true,
            margin: "md"
          } : null
        ].filter(Boolean)
      }
    }
  };
}

export function createStudyAnswerFlex(courseName: string, title: string, content: string) {
  return {
    type: "flex",
    altText: `${title} in ${courseName}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#4F46E5",
        paddingAll: "14px",
        contents: [
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "md",
            color: "#FFFFFF"
          },
          {
            type: "text",
            text: courseName,
            size: "xs",
            color: "#E0E7FF",
            margin: "xs"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: content,
            size: "sm",
            color: "#444444",
            wrap: true
          }
        ]
      }
    }
  };
}
