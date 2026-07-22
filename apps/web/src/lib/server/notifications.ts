import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { sharedInboxMembers, users } from '@/db/schema';
import { resolveSiteUrl, resolveSmtpFrom } from '@/lib/siteEnv';

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
  });
}

export async function sendInboxNotification(input: {
  to: string;
  handle: string;
  preview?: { from?: string; label?: string };
}): Promise<void> {
  const transporter = createTransport();
  if (!transporter) return;

  const siteUrl = resolveSiteUrl();
  const preview = input.preview?.label
    ? ` "${input.preview.label}"`
    : input.preview?.from
      ? ` from ${input.preview.from}`
      : '';

  await transporter.sendMail({
    from: resolveSmtpFrom(),
    to: input.to,
    subject: 'New secret in your CryptoBin inbox',
    text: [
      `You received a new encrypted secret in your CryptoBin inbox${preview}.`,
      '',
      `Open your inbox: ${siteUrl}/app/inbox`,
      '',
      'The secret stays encrypted until you unlock your account in the browser.',
    ].join('\n'),
  });
}

export async function sendSharedInboxNotification(input: {
  inboxId: string;
  slug: string;
  name: string;
  preview?: { from?: string; label?: string };
}): Promise<void> {
  const transporter = createTransport();
  if (!transporter) return;

  const db = getDb();
  const recipients = await db
    .select({ email: users.email })
    .from(sharedInboxMembers)
    .innerJoin(users, eq(sharedInboxMembers.userId, users.id))
    .where(eq(sharedInboxMembers.inboxId, input.inboxId));

  const emails = recipients.map((row) => row.email).filter(Boolean) as string[];
  if (!emails.length) return;

  const siteUrl = resolveSiteUrl();
  const preview = input.preview?.label
    ? ` "${input.preview.label}"`
    : input.preview?.from
      ? ` from ${input.preview.from}`
      : '';

  await transporter.sendMail({
    from: resolveSmtpFrom(),
    bcc: emails,
    subject: `New secret in shared inbox ${input.name}`,
    text: [
      `A new encrypted secret was delivered to the shared inbox "${input.name}"${preview}.`,
      '',
      `Open it: ${siteUrl}/app/inbox`,
      `Drop link: ${siteUrl}/i/${input.slug}`,
      '',
      'Only members can decrypt drops after unlocking in the browser.',
    ].join('\n'),
  });
}
