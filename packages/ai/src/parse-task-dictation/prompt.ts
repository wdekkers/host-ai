type PromptInput = {
  transcript: string;
  today: string;
  properties: Array<{ id: string; name: string; nicknames: string[] }>;
  categories: Array<{ id: string; name: string }>;
};

export function buildSystemPrompt(input: PromptInput): string {
  const propertyList = input.properties
    .map(
      (p) =>
        `- id: ${p.id} | name: ${p.name} | nicknames: ${p.nicknames.join(', ') || '(none)'}`,
    )
    .join('\n');
  const categoryList = input.categories
    .map((c) => `- id: ${c.id} | name: ${c.name}`)
    .join('\n');

  return `You convert a property manager's spoken walkthrough notes into a JSON list of tasks.

Today's date: ${input.today}

Properties (use these exact IDs in propertyMatches when the transcript mentions a property):
${propertyList || '(none)'}

Existing categories (use these exact IDs in categoryId when one fits):
${categoryList || '(none)'}

Output ONLY JSON matching this exact shape:
{
  "tasks": [
    {
      "title": string,
      "description": string | null,
      "propertyMatches": string[],
      "propertyAmbiguous": string | null,
      "categoryId": string | null,
      "suggestedNewCategory": string | null,
      "priority": "low" | "medium" | "high",
      "dueDate": string | null,
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Rules:
- Split the transcript into multiple tasks when it covers separate items.
- If a property is mentioned by nickname, match it to that property's id.
- If a property mention is unclear, leave propertyMatches empty and put the raw phrase in propertyAmbiguous.
- Only invent a category in suggestedNewCategory when none of the existing ones fit.
- "Urgent", "ASAP" -> priority "high". "Whenever", "no rush" -> "low". Otherwise "medium".
- Resolve "Friday", "this weekend", "tomorrow" against today's date. If unclear, leave dueDate null.
- dueDate must be a full ISO datetime string (e.g. 2026-05-01T00:00:00.000Z), not just YYYY-MM-DD.
- Output JSON only. No markdown, no commentary.`;
}

export function buildUserPrompt(input: PromptInput): string {
  return `Transcript:\n${input.transcript.trim()}\n\nReturn JSON only.`;
}
