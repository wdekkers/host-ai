const ESCALATE_KEYWORDS = [
  'refund', 'lawyer', 'attorney', 'sue', 'injured', 'injury',
  'blood', 'hospital', 'police', 'fire department', 'weapon',
  'threatened', 'unsafe', 'discriminat',
];

const CAUTION_KEYWORDS = [
  'damage', 'broken', 'not working', 'disgusting', 'unacceptable',
  'worst', 'review', 'report', 'complain', 'compensat', 'money back',
  'airbnb support', 'resolution center',
];

export type EscalationLevel = 'none' | 'caution' | 'escalate';

export function detectEscalationKeywords(text: string): EscalationLevel {
  const lower = text.toLowerCase();

  for (const keyword of ESCALATE_KEYWORDS) {
    if (lower.includes(keyword)) return 'escalate';
  }

  for (const keyword of CAUTION_KEYWORDS) {
    if (lower.includes(keyword)) return 'caution';
  }

  return 'none';
}
