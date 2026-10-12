module.exports = (output, context) => {
  const expected = context.vars;
  const actual = typeof output === "string" ? JSON.parse(output) : output;
  const failures = [];

  if (typeof actual.answer !== "string" || !actual.answer.trim()) {
    failures.push("No answer returned");
  }
  const allowedTargets = expected.expectedTargets
    ? String(expected.expectedTargets).split(",").map((target) => target.trim())
    : expected.expectedTarget ? [expected.expectedTarget] : [];
  if (allowedTargets.length > 0 && !allowedTargets.includes(actual.selectedTarget)) {
    failures.push(`Expected ${allowedTargets.join(" or ")}, got ${actual.selectedTarget || "none"}`);
  }
  if (expected.expectedIntent && actual.intent !== expected.expectedIntent) {
    failures.push(`Expected ${expected.expectedIntent}, got ${actual.intent || "none"}`);
  }
  if (expected.requireOfficialEvidence) {
    const urls = (actual.sources || []).map((source) => source.url);
    const retrieved = actual.retrievedSource || "";
    const hasOfficialUrl = [...urls, retrieved].some((value) =>
      /https?:\/\/(?:[a-z0-9-]+\.)*bu\.ac\.th(?:\/|$)/i.test(value)
    );
    if (!hasOfficialUrl) failures.push("No BU source URL in retrieval or web results");
  }
  if (expected.noTicketCreation && /BU-TICKET-\d+/i.test(actual.answer)) {
    failures.push("Claimed a ticket was created during intake");
  }

  return { pass: failures.length === 0, score: failures.length === 0 ? 1 : 0, reason: failures.join("; ") };
};
