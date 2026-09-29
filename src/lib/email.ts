import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { serverEnv } from "@/lib/env";
import { EMAIL_BRAND } from "@/lib/email-templates";

let transport: { key: string; client: Transporter } | null = null;

function mailer() {
  const { smtpHost, smtpPort, smtpUser, smtpPassword } = serverEnv();
  if (!smtpPassword) return null;
  const key = `${smtpHost}:${smtpPort}:${smtpUser}:${smtpPassword}`;
  if (!transport || transport.key !== key) {
    transport = {
      key,
      client: nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // 465 = SSL, 587 = STARTTLS
        auth: { user: smtpUser, pass: smtpPassword },
      }),
    };
  }
  return transport.client;
}

export interface Email { to: string; subject: string; html: string; text: string }

/**
 * Sends one email from the community mailbox. Never throws: a failed email must not
 * undo or block the action that triggered it, so problems are only logged.
 */
export async function sendEmail(email: Email) {
  const client = mailer();
  if (!client) {
    console.warn("[email] SMTP_PASSWORD / HOSTINGER_SMTP_PASSWORD not set — skipped:", email.subject);
    return false;
  }
  try {
    await client.sendMail({
      from: { name: EMAIL_BRAND, address: serverEnv().smtpUser },
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return true;
  } catch (e) {
    console.error("[email] send failed:", email.subject, e);
    return false;
  }
}
