import { z } from "zod";

const assignmentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().catch(null),
  dueDateText: z.string().trim().max(160).nullable().catch(null),
  dueAt: z.string().trim().max(80).nullable().catch(null)
});

const extractedStudyNoteSchema = z.object({
  title: z.string().trim().max(160).nullable().catch(null),
  summary: z.string().trim().min(1).max(2000),
  keyPoints: z.array(z.string().trim().min(1).max(300)).max(12).catch([]),
  assignments: z.array(assignmentSchema).max(10).catch([])
});

export type ExtractedStudyNote = {
  assignments: Array<{
    description: string | null;
    dueAt: Date | null;
    dueDateText: string | null;
    title: string;
  }>;
  keyPoints: string[];
  summary: string;
  title: string | null;
};

function createFallbackExtraction(rawText: string): ExtractedStudyNote {
  const normalized = rawText.replace(/\s+/g, " ").trim();
  return {
    assignments: extractHeuristicAssignments(rawText),
    keyPoints: [],
    summary: normalized.slice(0, 700) || "บันทึกเนื้อหาคลาสแล้วครับ",
    title: null
  };
}

function safeParseDueAt(value: string | null) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toExtractedStudyNote(value: z.infer<typeof extractedStudyNoteSchema>) {
  return {
    assignments: value.assignments.map((assignment) => ({
      description: assignment.description,
      dueAt: safeParseDueAt(assignment.dueAt ?? assignment.dueDateText),
      dueDateText: assignment.dueDateText,
      title: assignment.title
    })),
    keyPoints: value.keyPoints,
    summary: value.summary,
    title: value.title
  };
}

function extractHeuristicAssignments(rawText: string): ExtractedStudyNote["assignments"] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .flatMap((line) => {
      const match = line.match(
        /^(Homework|Assignment|การบ้าน|งาน)\s+(.+?)(?:\s+due\s+(.+))?$/i
      );
      if (!match) return [];

      const prefix = match[1];
      const titlePart = match[2]?.trim();
      const dueDateText = match[3]?.trim() || null;
      const title = `${prefix} ${titlePart}`.trim();

      return [
        {
          description: null,
          dueAt: safeParseDueAt(dueDateText),
          dueDateText,
          title
        }
      ];
    });
}

export async function extractStudyNote(
  courseName: string,
  rawText: string
): Promise<ExtractedStudyNote> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return createFallbackExtraction(rawText);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "Extract structured study note metadata. Return JSON only. Write the summary and keyPoints in a friendly, conversational, and easy-to-understand assistant tone, using Thai language by default. Do not invent assignments or due dates. If a due date is not explicit, use null."
          },
          {
            role: "user",
            content: JSON.stringify({
              courseName,
              requiredShape: {
                assignments: [
                  {
                    description: "string|null",
                    dueAt: "string|null",
                    dueDateText: "string|null",
                    title: "string"
                  }
                ],
                keyPoints: ["string"],
                summary: "string",
                title: "string|null"
              },
              rawText
            })
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("Study note extraction failed", await response.text());
      return createFallbackExtraction(rawText);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return createFallbackExtraction(rawText);
    }

    const parsedJson = JSON.parse(content) as unknown;
    const parsed = extractedStudyNoteSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("Study note extraction invalid", parsed.error.flatten());
      return createFallbackExtraction(rawText);
    }

    const extracted = toExtractedStudyNote(parsed.data);
    if (extracted.assignments.length === 0) {
      extracted.assignments = extractHeuristicAssignments(rawText);
    }

    return extracted;
  } catch (error) {
    console.error("Study note extraction error", error);
    return createFallbackExtraction(rawText);
  }
}
