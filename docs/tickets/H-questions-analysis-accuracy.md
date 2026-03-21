# H — Questions analysis: improve accuracy and prevent hallucinations

## Type
Improvement

## Description
The questions analysis feature is returning inaccurate data. For example, the AI is listing amenities (like a grill) that don't exist at a property. The analysis answers are being generated without grounding in the actual property knowledge base, leading to hallucinated or incorrect answers.

## Example of the problem
For Dreamscape, the analysis returns:
> "The house is equipped with several amenities including a grill, an ice maker, and both a coffee pot and Keurig."

This is incorrect — there is no grill at this property.

## Root cause (to investigate)
- The AI prompt for generating FAQ answers may not be grounding responses in the property's actual knowledge entries
- Property memory / knowledge base entries may be incomplete or not passed in context
- The model may be generating plausible-sounding but fabricated answers

## Scope

### 1. Ground answers in property knowledge
- FAQ answers must only reference amenities/facts present in the property's knowledge base (`knowledgeEntries`, `propertyMemory`, `propertyGuidebookEntries`)
- If a fact is not in the knowledge base, the answer should say so honestly (e.g., "This isn't documented — please verify with the host")

### 2. Improve the prompt
- Add explicit instruction: "Only include amenities or information explicitly documented in the provided property context. Do not infer or assume."
- Include relevant property knowledge entries in the prompt context window
- Add a "sources" trace to the generated answer so editors can verify

### 3. Human review gate
- Generated answers should be marked as `unreviewed` by default
- Owner/manager must review and approve answers before they are used by the AI agent
- Unapproved answers shown with a warning badge

### 4. Edit and correct workflow
- Easy inline editing of generated answers
- After editing, the answer is marked as `manually_verified`

## Acceptance criteria
- [ ] Generated answers only reference information in the property knowledge base
- [ ] Prompt explicitly prevents hallucination of amenities
- [ ] Answers have a review state: unreviewed / approved / manually_verified
- [ ] Owner/manager can edit and approve answers from the questions page
- [ ] Source context (which knowledge entries were used) is visible during review
