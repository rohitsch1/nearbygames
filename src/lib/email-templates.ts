// Transactional emails for join requests. Pure functions (no I/O) so they can be unit tested.
// Everything user-written (names, notes, reasons) goes through esc() before reaching HTML.

import type { Email } from "@/lib/email";

/** Name shown as the sender and in email copy (matches the sign-in code email). */
export const EMAIL_BRAND = "playnearbygames";

export function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface GameInfo { emoji: string; sport: string; spot: string; when: string }

export interface RequesterInfo {
  name: string;
  verified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  gamesPlayed: number;
  noShows: number;
}

const BLUE_TICK =
  '<span title="ID verified" style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:9px;background:#1d9bf0;color:#fff;font-size:12px;font-weight:700;text-align:center;vertical-align:middle;margin-left:6px">&#10003;</span>';

function layout(title: string, body: string, cta: { label: string; url: string }) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:460px;margin:0 auto;padding:24px;color:#0b1220">
  <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
  ${body}
  <a href="${esc(cta.url)}" style="display:inline-block;margin-top:20px;background:#12b76a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(cta.label)}</a>
  <p style="margin:24px 0 0;color:#98a2b3;font-size:12px">You're getting this because you use ${EMAIL_BRAND}. Reply to this email if something looks wrong.</p>
</div>`;
}

function gameLine(g: GameInfo) {
  return `<p style="margin:0 0 16px;padding:10px 14px;border-radius:12px;background:#ecfdf3;color:#067647;font-weight:600">${g.emoji} ${esc(g.sport)} at ${esc(g.spot)} · ${esc(g.when)}</p>`;
}

export function reputation(r: Pick<RequesterInfo, "ratingAvg" | "ratingCount" | "gamesPlayed" | "noShows">) {
  const parts: string[] = [];
  parts.push(r.ratingCount > 0 && r.ratingAvg != null ? `★ ${r.ratingAvg.toFixed(1)} (${r.ratingCount} review${r.ratingCount === 1 ? "" : "s"})` : "No reviews yet");
  parts.push(r.gamesPlayed > 0 ? `${r.gamesPlayed} game${r.gamesPlayed === 1 ? "" : "s"} played` : "New player");
  if (r.noShows > 0) parts.push(`${r.noShows} no-show${r.noShows === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** To the host: someone asked to join. */
export function newRequestEmail(o: {
  to: string; hostName: string; requester: RequesterInfo; note: string | null; distanceBand: string | null; game: GameInfo; url: string;
}): Email {
  const r = o.requester;
  const subject = `${r.name} wants to join your ${o.game.sport.toLowerCase()} game`;
  const body = `<p style="margin:0 0 12px">Hi ${esc(o.hostName)}, someone asked to join your game.</p>
  ${gameLine(o.game)}
  <p style="margin:0;font-size:17px;font-weight:700">${esc(r.name)}${r.verified ? BLUE_TICK : ""}</p>
  <p style="margin:4px 0 0;color:#475467;font-size:14px">${esc(reputation(r))}${o.distanceBand ? ` · lives ${esc(o.distanceBand)} away` : ""}</p>
  ${r.verified ? "" : '<p style="margin:4px 0 0;color:#98a2b3;font-size:13px">ID not verified</p>'}
  ${o.note ? `<p style="margin:12px 0 0;padding:10px 14px;border-radius:12px;background:#f2f4f7">“${esc(o.note)}”</p>` : ""}
  <p style="margin:16px 0 0;color:#475467">You can chat with them before you decide, then accept or decline.</p>`;
  const text = [
    `Hi ${o.hostName},`,
    `${r.name}${r.verified ? " (ID verified)" : ""} asked to join ${o.game.sport} at ${o.game.spot}, ${o.game.when}.`,
    reputation(r) + (o.distanceBand ? ` · lives ${o.distanceBand} away` : ""),
    o.note ? `Their note: "${o.note}"` : "",
    `Chat, accept or decline: ${o.url}`,
  ].filter(Boolean).join("\n\n");
  return { to: o.to, subject, html: layout(`New request from ${esc(r.name)}${r.verified ? BLUE_TICK : ""}`, body, { label: "Review request", url: o.url }), text };
}

/** To the requester: the host said yes. */
export function requestAcceptedEmail(o: { to: string; requesterName: string; hostName: string; game: GameInfo; url: string }): Email {
  const subject = `You're in! ${o.hostName} accepted your request`;
  const body = `<p style="margin:0 0 12px">Hi ${esc(o.requesterName)}, ${esc(o.hostName)} accepted your request.</p>
  ${gameLine(o.game)}
  <p style="margin:0;color:#475467">Your chat with ${esc(o.hostName)} is open. Sort out the exact spot and who brings what there.</p>`;
  const text = `Hi ${o.requesterName},\n\n${o.hostName} accepted your request for ${o.game.sport} at ${o.game.spot}, ${o.game.when}.\n\nOpen the chat: ${o.url}`;
  return { to: o.to, subject, html: layout("You're in! 🎉", body, { label: `Chat with ${o.hostName}`, url: o.url }), text };
}

/** To the requester: the host said no. */
export function requestDeclinedEmail(o: { to: string; requesterName: string; hostName: string; game: GameInfo; reason: string | null; url: string }): Email {
  const subject = `Your request for ${o.game.spot} was declined`;
  const body = `<p style="margin:0 0 12px">Hi ${esc(o.requesterName)}, ${esc(o.hostName)} couldn't take you for this one.</p>
  ${gameLine(o.game)}
  ${o.reason ? `<p style="margin:0 0 12px;padding:10px 14px;border-radius:12px;background:#f2f4f7">“${esc(o.reason)}” — ${esc(o.hostName)}</p>` : ""}
  <p style="margin:0;color:#475467">There are more games near you on the map.</p>`;
  const text = `Hi ${o.requesterName},\n\n${o.hostName} declined your request for ${o.game.sport} at ${o.game.spot}, ${o.game.when}.${o.reason ? `\n\nReason: "${o.reason}"` : ""}\n\nFind another game: ${o.url}`;
  return { to: o.to, subject, html: layout("Request declined", body, { label: "Find another game", url: o.url }), text };
}
