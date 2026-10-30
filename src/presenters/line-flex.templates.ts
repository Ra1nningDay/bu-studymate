import type { SavedStudyNote, StudyMemoryService } from "@/src/services/study-memory.service";

function getPublicAssetUrl(path: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  if (!appUrl) {
    return null;
  }

  return new URL(path, appUrl).toString();
}

function createStudyMateHeader(title: string) {
  return {
    type: "box",
    layout: "vertical",
    paddingAll: "16px",
    backgroundColor: "#1DB446",
    contents: [
      {
        type: "text",
        text: title,
        weight: "bold",
        size: "lg",
        color: "#FFFFFF",
        wrap: true
      }
    ]
  };
}

function createSaveNoteHero() {
  const imageUrl = getPublicAssetUrl("/save-note.png");
  if (!imageUrl) {
    return null;
  }

  return {
    type: "image",
    url: imageUrl,
    size: "full",
    aspectRatio: "20:10",
    aspectMode: "cover"
  };
}

function createHeroImage(path: string) {
  const imageUrl = getPublicAssetUrl(path);
  if (!imageUrl) {
    return null;
  }

  return {
    type: "image",
    url: imageUrl,
    size: "full",
    aspectRatio: "20:10",
    aspectMode: "cover"
  };
}

function createTutorActionButton(label: string, text: string) {
  return {
    type: "button",
    style: "secondary",
    height: "sm",
    action: {
      type: "message",
      label,
      text
    }
  };
}

export function createGreetingFlex() {
  const greetingHero = createHeroImage("/Greeting-hero.png");

  return {
    type: "flex",
    altText: "ยินดีต้อนรับสู่ BU StudyMate",
    contents: {
      type: "bubble",
      size: "mega",
      hero: greetingHero ?? undefined,
      header: greetingHero
        ? undefined
        : createStudyMateHeader("ให้ StudyMate ช่วยเรื่องเรียน")
    }
  };
}

export function createGreetingRichMessage() {
  const baseUrl = getPublicAssetUrl("/api/line/imagemap/greeting");

  if (!baseUrl) {
    return createGreetingFlex();
  }

  return {
    type: "imagemap",
    baseUrl,
    altText: "ให้ StudyMate ช่วยเรื่องเรียน",
    baseSize: {
      width: 1040,
      height: 702
    },
    actions: [
      {
        type: "message",
        text: "อัปโหลดบทเรียน",
        area: { x: 32, y: 451, width: 480, height: 103 }
      },
      {
        type: "message",
        text: "งานที่ต้องส่งมีอะไรบ้าง",
        area: { x: 527, y: 451, width: 482, height: 103 }
      },
      {
        type: "message",
        text: "ถามข้อมูล BU",
        area: { x: 32, y: 569, width: 480, height: 103 }
      },
      {
        type: "message",
        text: "แจ้งปัญหาห้องเรียน",
        area: { x: 527, y: 569, width: 482, height: 103 }
      }
    ]
  };
}

export function createStudyNoteFlex(note: SavedStudyNote) {
  const keyPointItems = note.keyPoints.slice(0, 5).map((point) => ({
    type: "text",
    text: `- ${point}`,
    size: "sm",
    color: "#334155",
    wrap: true
  }));

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

  contents.push({
    type: "text",
    text: "Study Pack พร้อมแล้ว",
    size: "lg",
    weight: "bold",
    color: "#14532D",
    wrap: true
  });

  contents.push({
    type: "text",
    text: note.courseName,
    color: "#222222",
    size: "md",
    weight: "bold",
    wrap: true
  });

  if (keyPointItems.length > 0) {
    contents.push({
      type: "box",
      layout: "vertical",
      spacing: "xs",
      margin: "lg",
      contents: [
        {
          type: "text",
          text: "หัวข้อหลัก",
          size: "sm",
          weight: "bold",
          color: "#166534"
        },
        ...keyPointItems
      ]
    });
  }
  
  if (assignments.length > 0) {
    contents.push({
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: [
        {
          type: "text",
          text: "งานที่พบ",
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
          text: "จำง่าย ๆ",
          size: "sm",
          weight: "bold",
          color: "#166534"
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

  const saveNoteHero = createSaveNoteHero();
  const flex = {
    type: "flex",
    altText: `บันทึกโน้ต ${note.courseName} แล้ว`,
    contents: {
      type: "bubble",
      size: "mega",
      hero: saveNoteHero ?? undefined,
      header: saveNoteHero ? undefined : createStudyMateHeader("บันทึกโน้ตแล้ว"),
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: "อยากให้ช่วยต่อไหม?",
            size: "sm",
            weight: "bold",
            color: "#334155",
            wrap: true
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              createTutorActionButton("อธิบายง่าย ๆ", "อธิบายโน้ตล่าสุดแบบเพื่อนสอน"),
              createTutorActionButton("คำถามทบทวน", "ออกคำถามทบทวนจากโน้ตล่าสุด")
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              createTutorActionButton("Flashcards", "ทำ flashcards จากโน้ตล่าสุด"),
              createTutorActionButton("สรุปก่อนสอบ", "สรุปก่อนสอบจากโน้ตล่าสุด")
            ]
          },
          createTutorActionButton("ถามจากบทเรียนนี้", "ถามจากบทเรียนนี้")
        ]
      }
    }
  };

  return flex;
}

export function createAssignmentsFlex(assignments: Awaited<ReturnType<StudyMemoryService["getAssignments"]>>) {
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
