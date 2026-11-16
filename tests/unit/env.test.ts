import { describe, expect, it } from "vitest";
import { readAiLimits } from "../../src/config/env";

describe("readAiLimits", () => {
  it("prend les valeurs par défaut quand les variables sont absentes ou vides", () => {
    expect(readAiLimits({ AI_TIMEOUT_MS: "" })).toEqual({
      AI_TIMEOUT_MS: 20000,
      AI_MAX_OUTPUT_TOKENS: 1000,
      AI_MAX_CALLS_PER_DAY: 100,
      TICKETS_PER_USER_PER_DAY: 10,
    });
  });

  it("transforme le texte du .env en nombres", () => {
    const limits = readAiLimits({ AI_MAX_CALLS_PER_DAY: "250", TICKETS_PER_USER_PER_DAY: "5" });

    expect(limits.AI_MAX_CALLS_PER_DAY).toBe(250);
    expect(limits.TICKETS_PER_USER_PER_DAY).toBe(5);
  });

  it.each([
    [{ AI_TIMEOUT_MS: "abc" }, "AI_TIMEOUT_MS doit être un nombre"],
    [{ AI_MAX_OUTPUT_TOKENS: "1.5" }, "AI_MAX_OUTPUT_TOKENS doit être un nombre entier"],
    [{ TICKETS_PER_USER_PER_DAY: "0" }, "TICKETS_PER_USER_PER_DAY doit valoir au moins 1"],
    [{ AI_TIMEOUT_MS: "-5" }, "AI_TIMEOUT_MS doit valoir au moins 1"],
    [{ AI_MAX_CALLS_PER_DAY: "10000" }, "AI_MAX_CALLS_PER_DAY doit valoir au maximum 1000"],
  ])("refuse %j", (source, message) => {
    expect(() => readAiLimits(source)).toThrow(message);
  });

  it("liste toutes les variables fausses d'un coup", () => {
    expect(() => readAiLimits({ AI_TIMEOUT_MS: "abc", AI_MAX_OUTPUT_TOKENS: "99999" })).toThrow(
      "Variables d'environnement invalides :\n- AI_TIMEOUT_MS doit être un nombre\n- AI_MAX_OUTPUT_TOKENS doit valoir au maximum 4000",
    );
  });
});