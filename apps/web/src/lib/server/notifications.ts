import nodemailer from 'nodemailer';

export async function sendInboxNotification(input: {
  to: string;
  handle: string;
  preview?: { from?: string; label?: string };
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) return;

  const transporter = nodemailer.createTransport({
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

  const siteUrl = (process.env.SITE_URL ?? 'https://cryptobin.app').replace(/\/$/, '');
  const preview = input.preview?.label
    ? ` "${input.preview.label}"`
    : input.preview?.from
      ? ` from ${input.preview.from}`
      : '';

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'noreply@cryptobin.app',
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
