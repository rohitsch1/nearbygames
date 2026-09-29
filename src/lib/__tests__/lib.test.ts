import { describe, expect, it } from "vitest";
import { esc, newRequestEmail, reputation, requestAcceptedEmail, requestDeclinedEmail } from "../email-templates";
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

describe("request emails", () => {
  const game = { emoji: "🏏", sport: "Cricket", spot: "Gali No. 4", when: "Saturday, 4 October, 6:00 pm" };
  const requester = { name: "Priya <b>S</b>", verified: true, ratingAvg: 4.5, ratingCount: 2, gamesPlayed: 3, noShows: 0 };

  it("escapes anything a user wrote", () => {
    expect(esc(`<script>"x" & 'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;");
    const e = newRequestEmail({ to: "h@x.io", hostName: "Rehan", requester, note: "<img src=x onerror=alert(1)>", distanceBand: "1–3 km", game, url: "https://x/requests" });
    expect(e.html).not.toContain("<img");
    expect(e.html).not.toContain("<b>S</b>");
    expect(e.html).toContain("Priya &lt;b&gt;S&lt;/b&gt;");
  });

  it("shows the blue tick only for verified requesters", () => {
    const yes = newRequestEmail({ to: "h@x.io", hostName: "Rehan", requester, note: null, distanceBand: null, game, url: "https://x" });
    const no = newRequestEmail({ to: "h@x.io", hostName: "Rehan", requester: { ...requester, verified: false }, note: null, distanceBand: null, game, url: "https://x" });
    expect(yes.html).toContain('title="ID verified"');
    expect(yes.text).toContain("(ID verified)");
    expect(no.html).not.toContain('title="ID verified"');
    expect(no.html).toContain("ID not verified");
  });

  it("summarises reputation", () => {
    expect(reputation(requester)).toBe("★ 4.5 (2 reviews) · 3 games played");
    expect(reputation({ ratingAvg: null, ratingCount: 0, gamesPlayed: 0, noShows: 1 })).toBe("No reviews yet · New player · 1 no-show");
  });

  it("links accepted players to the chat and includes a decline reason", () => {
    const a = requestAcceptedEmail({ to: "p@x.io", requesterName: "Priya", hostName: "Rehan", game, url: "https://x/messages/1" });
    expect(a.subject).toBe("You're in! Rehan accepted your request");
    expect(a.html).toContain("https://x/messages/1");
    const d = requestDeclinedEmail({ to: "p@x.io", requesterName: "Priya", hostName: "Rehan", game, reason: "Full squad", url: "https://x/map" });
    expect(d.text).toContain('Reason: "Full squad"');
  });
});
