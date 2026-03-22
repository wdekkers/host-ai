import OpenAI from 'openai';

export type SimulatorGrade = 'good' | 'incomplete' | 'no_knowledge' | 'hallucinated';

export interface GradeResult {
  grade: SimulatorGrade;
  reason: string;
}

export async function gradeSimulatorResponse({
  question,
  response,
  knowledgeContext,
}: {
  question: string;
  response: string;
  knowledgeContext: string;
}): Promise<GradeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { grade: 'incomplete', reason: 'Grading unavailable — no API key' };
  }

  const client = new OpenAI({ apiKey });

  const result = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `You are an AI response quality grader. You evaluate whether a property management AI agent's response to a guest question is accurate based on the available knowledge base.

Grade the response using exactly one of these grades:
- "good" — The response accurately answers the question using information from the knowledge base.
- "incomplete" — The response partially answers the question, but relevant information exists in the knowledge base that wasn't fully used.
- "no_knowledge" — The question topic is not covered in the knowledge base at all. The agent has no information to draw from.
- "hallucinated" — The response contains specific claims or details that are NOT supported by the knowledge base.

Respond in JSON format: {"grade": "...", "reason": "..."}
The reason should be one sentence explaining why you chose that grade.

KNOWLEDGE BASE:
${knowledgeContext || '(empty — no knowledge entries configured)'}`,
      },
      {
        role: 'user',
        content: `GUEST QUESTION: ${question}\n\nAGENT RESPONSE: ${response}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(result.choices[0]?.message?.content ?? '{}');
    const grade = ['good', 'incomplete', 'no_knowledge', 'hallucinated'].includes(parsed.grade)
      ? (parsed.grade as SimulatorGrade)
      : 'incomplete';
    return { grade, reason: parsed.reason ?? 'Unable to determine reason' };
  } catch {
    return { grade: 'incomplete', reason: 'Failed to parse grading response' };
  }
}
