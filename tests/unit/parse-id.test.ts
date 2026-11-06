import { describe, expect, it } from "vitest";
import { parseId } from "../../src/lib/parse-id";
import { HttpError } from "../../src/lib/http-error";

describe("parseId", () => {
  it("transforme un entier positif écrit en texte en nombre", () => {
    expect(parseId("12")).toBe(12);
  });

  it.each(["0", "-1", "1.5", "abc", "", "1e3x"])("refuse %j avec une erreur 400", (value) => {
    expect(() => parseId(value)).toThrow(HttpError);
    try {
      parseId(value);
    } catch (err) {
      expect((err as HttpError).status).toBe(400);
    }
  });

  it("refuse un tableau (?id=1&id=2)", () => {
    expect(() => parseId(["1", "2"])).toThrow(HttpError);
  });
});
