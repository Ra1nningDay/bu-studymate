# BU StudyMate

BU StudyMate is a conversational assistant for Bangkok University students. This glossary distinguishes casual conversation from verified university guidance and operational workflows.

## Conversation Language

**General Chat**:
A casual conversation that does not require verified BU information, saved study material, or a ticket workflow.
_Avoid_: General question, BU information

**Unknown Message**:
A message whose purpose cannot be identified confidently. It receives one short clarifying question instead of an inferred answer.
_Avoid_: General Chat, unsupported question

**Out-of-scope Request**:
A clear request for knowledge or assistance outside BU information, saved study material, ticketing, and casual conversation. It receives a fixed boundary statement in the student's language describing the areas StudyMate supports.
_Avoid_: Unknown Message, General Chat

**Operator-style Reply**:
A direct, conversational reply in the language of the student's latest message, using one to three sentences and normally around 300 characters or fewer, with one clarifying question when needed. Safety-critical information is exempt from the normal length target.
_Avoid_: Long-form answer, comprehensive explanation

**Progressive Detail**:
Additional explanation delivered as one short conversational point at a time after the student requests more detail, with the student choosing which part to expand next.
_Avoid_: Full explanation by default, information dump

**Mixed-intent Message**:
A message containing both casual conversation and a request that belongs to a verified-information or operational workflow. The actionable request takes priority while the casual part may be acknowledged briefly.
_Avoid_: General Chat

**Unverified BU Request**:
A request for official university information for which StudyMate has no verified evidence. It receives a concise boundary statement and one clarifying question, not an answer from model memory.
_Avoid_: General Chat answer, model-knowledge answer

**Static Guide**:
A fixed instructional response for a StudyMate menu action. It is not a General Chat answer and may exceed the normal reply-length target when complete instructions require it.
_Avoid_: Operator-style Reply, AI-generated reply

**Human Handoff**:
A real transfer of the conversation to a person. StudyMate does not currently support this and must not imply that a transfer has occurred.
_Avoid_: Ticket creation, simulated handoff

**Safety-critical Message**:
A message indicating immediate danger, self-harm, or another urgent threat to a person. Necessary safety guidance takes priority over the normal reply-length target.
_Avoid_: General Chat, routine support request
