export interface QuestionTemplate {
  name: string;
  questions: string[];
}

export const SIMULATOR_TEMPLATES: QuestionTemplate[] = [
  {
    name: 'Check-in basics',
    questions: [
      "What's the WiFi password?",
      'How do I get into the property?',
      'Where can I park?',
      'What time is check-in?',
      'What time is check-out?',
      'Is early check-in available?',
      'Can I do a late checkout?',
    ],
  },
  {
    name: 'Amenities',
    questions: [
      'Is there a pool?',
      'Do you have a hot tub?',
      'Is there a grill or BBQ?',
      'Where are the washer and dryer?',
      'What kitchen equipment is available?',
      'Are towels and linens provided?',
      'What TV or streaming services are available?',
    ],
  },
  {
    name: 'Local area',
    questions: [
      'What restaurants do you recommend nearby?',
      "Where's the nearest grocery store?",
      'What attractions are nearby?',
      "Where's the nearest hospital or urgent care?",
      'Is there a pharmacy nearby?',
      "Where's the nearest gas station?",
    ],
  },
  {
    name: 'House rules',
    questions: [
      'Are pets allowed?',
      'Is smoking allowed?',
      'What are the quiet hours?',
      'What is the maximum number of guests?',
      'Are parties or events allowed?',
      'Do I need to take my shoes off indoors?',
    ],
  },
  {
    name: 'Problems & emergencies',
    questions: [
      "The AC isn't working, what should I do?",
      "There's no hot water.",
      "I'm locked out, can you help?",
      'The power went out.',
      "There's a plumbing issue.",
      'I found a pest in the property.',
      'The neighbors are being really noisy.',
    ],
  },
];
