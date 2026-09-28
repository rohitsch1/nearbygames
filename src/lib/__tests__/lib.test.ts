import { describe, expect, it } from "vitest";
import { formatINR, platformFee } from "../money";
import { canTransact } from "../profile";
import { safeNext } from "../site";
import type { Profile } from "../types";

describe("safeNext (open-redirect guard)", () => {
  it.each([
    ["/games/abc", "/games/abc"],
    ["/me/edit?next=%2Fmap", "/me/edit?next=%2Fmap"],
    ["//evil.com", "/map"],
    ["/\t/evil.com", "/map"],
    ["/\n/evil.com", "/map"],
    ["/\\evil.com", "/map"],
    ["https://evil.com", "/map"],
    ["javascript:alert(1)", "/map"],
    [null, "/map"],
  ])("%j → %j", (input, out) => expect(safeNext(input as string | null)).toBe(out));
});

describe("platformFee mirrors the SQL function", () => {
  it("is 5% with ₹5 min and ₹50 max", () => {
    expect(platformFee(15000)).toBe(750);
    expect(platformFee(1000)).toBe(500);
    expect(platformFee(500000)).toBe(5000);
  });
});

describe("formatINR", () => {
  it("shows paise only when needed", () => {
    expect(formatINR(15000)).toBe("₹150");
    expect(formatINR(15750)).toBe("₹157.50");
  });
});

describe("canTransact", () => {
  const base = { full_name: "A", area_name: "HSR", occupation: "working", id_verified: true } as Profile;
  it("needs all four fields", () => {
    expect(canTransact(base)).toBe(true);
    expect(canTransact({ ...base, id_verified: false })).toBe(false);
    expect(canTransact(null)).toBe(false);
  });
});
