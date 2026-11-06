import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { generateToken, hashToken, signAccessToken, verifyAccessToken } from "../../src/lib/tokens";

describe("access token (JWT)", () => {
  it("contient l'id et le rôle de l'utilisateur", () => {
    const token = signAccessToken(42, "AGENT");
    expect(verifyAccessToken(token)).toEqual({ sub: 42, role: "AGENT" });
  });

  it("est refusé s'il a été modifié", () => {
    const token = signAccessToken(42, "USER");
    const [header, , signature] = token.split(".");
    const fakePayload = Buffer.from(JSON.stringify({ sub: "42", role: "SUPER_ADMIN" })).toString("base64url");
    expect(verifyAccessToken(`${header}.${fakePayload}.${signature}`)).toBeNull();
  });

  it("est refusé s'il est signé avec un autre secret", () => {
    const token = jwt.sign({ role: "SUPER_ADMIN" }, "un-autre-secret", { subject: "1" });
    expect(verifyAccessToken(token)).toBeNull();
  });

  it("est refusé s'il est expiré", () => {
    const token = jwt.sign({ role: "USER" }, process.env.JWT_ACCESS_SECRET!, { subject: "1", expiresIn: -10 });
    expect(verifyAccessToken(token)).toBeNull();
  });

  it("refuse un texte qui n'est pas un JWT", () => {
    expect(verifyAccessToken("pas-un-jeton")).toBeNull();
  });
});

describe("jetons aléatoires", () => {
  it("font 64 caractères hexadécimaux et ne se répètent pas", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toBe(b);
  });

  it("ont une empreinte stable, différente du jeton lui-même", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });
});
