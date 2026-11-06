import { describe, expect, it } from "vitest";
import { emailField, newPasswordField } from "../../src/lib/schemas";
import { createTicketSchema, listTicketsQuerySchema } from "../../src/modules/tickets/tickets.schemas";
import { createUserSchema } from "../../src/modules/users/users.schemas";

describe("emailField", () => {
  it("enlève les espaces et met en minuscules", () => {
    expect(emailField.parse("  Bob@Mail.COM ")).toBe("bob@mail.com");
  });

  it.each(["pas-un-email", "", 42, undefined])("refuse %j", (value) => {
    expect(emailField.safeParse(value).success).toBe(false);
  });
});

describe("newPasswordField", () => {
  it("accepte de 8 à 72 caractères", () => {
    expect(newPasswordField.safeParse("a".repeat(8)).success).toBe(true);
    expect(newPasswordField.safeParse("a".repeat(72)).success).toBe(true);
  });

  it("refuse moins de 8 ou plus de 72 caractères", () => {
    expect(newPasswordField.safeParse("a".repeat(7)).success).toBe(false);
    expect(newPasswordField.safeParse("a".repeat(73)).success).toBe(false);
  });
});

describe("createTicketSchema", () => {
  it("enlève les espaces autour du titre", () => {
    expect(createTicketSchema.parse({ title: "  Bug  ", description: "x" }).title).toBe("Bug");
  });

  it("refuse un titre vide, trop long ou qui n'est pas du texte", () => {
    expect(createTicketSchema.safeParse({ title: "   ", description: "x" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ title: "a".repeat(151), description: "x" }).success).toBe(false);
    expect(createTicketSchema.safeParse({ title: 123, description: "x" }).success).toBe(false);
  });
});

describe("listTicketsQuerySchema", () => {
  it("met des valeurs par défaut", () => {
    expect(listTicketsQuerySchema.parse({})).toEqual({ page: 1, limit: 20, sortBy: "createdAt", order: "desc" });
  });

  it("convertit page et limit en nombres", () => {
    expect(listTicketsQuerySchema.parse({ page: "3", limit: "5" })).toMatchObject({ page: 3, limit: 5 });
  });

  it.each([{ page: "0" }, { limit: "101" }, { limit: "abc" }, { sortBy: "password" }, { order: "up" }, { status: "NOPE" }])(
    "refuse %j",
    (query) => {
      expect(listTicketsQuerySchema.safeParse(query).success).toBe(false);
    },
  );
});

describe("createUserSchema", () => {
  it("refuse le rôle SUPER_ADMIN", () => {
    expect(createUserSchema.safeParse({ email: "a@b.co", role: "SUPER_ADMIN" }).success).toBe(false);
  });

  it("accepte un nom absent ou null", () => {
    expect(createUserSchema.safeParse({ email: "a@b.co", role: "USER" }).success).toBe(true);
    expect(createUserSchema.safeParse({ email: "a@b.co", role: "USER", name: null }).success).toBe(true);
  });
});
