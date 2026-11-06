import { describe, expect, it } from "vitest";
import { pageArgs, pageResult } from "../../src/lib/pagination";

describe("pagination", () => {
  it("calcule skip et take pour Prisma", () => {
    expect(pageArgs({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
    expect(pageArgs({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it("calcule le nombre de pages", () => {
    expect(pageResult([], 0, { page: 1, limit: 20 }).pagination.totalPages).toBe(0);
    expect(pageResult([], 21, { page: 1, limit: 20 }).pagination).toEqual({ page: 1, limit: 20, total: 21, totalPages: 2 });
  });
});
