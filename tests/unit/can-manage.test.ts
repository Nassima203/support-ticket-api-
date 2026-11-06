import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { canManage } from "../../src/modules/users/users.service";

describe("canManage : qui peut gérer quel rôle", () => {
  const cases: [Role, Role, boolean][] = [
    ["SUPER_ADMIN", "ADMIN", true],
    ["SUPER_ADMIN", "AGENT", true],
    ["SUPER_ADMIN", "USER", true],
    ["SUPER_ADMIN", "SUPER_ADMIN", false],
    ["ADMIN", "ADMIN", false],
    ["ADMIN", "AGENT", true],
    ["ADMIN", "USER", true],
    ["ADMIN", "SUPER_ADMIN", false],
  ];

  it.each(cases)("%s → %s : %s", (manager, target, expected) => {
    expect(canManage(manager, target)).toBe(expected);
  });
});
