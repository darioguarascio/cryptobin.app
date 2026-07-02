import { describe, expect, it } from 'vitest';
import { sendInboxNotification } from './notifications';

describe('sendInboxNotification', () => {
  it('no-ops when SMTP is not configured', async () => {
    const original = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;

    await expect(sendInboxNotification({
      to: 'user@example.com',
      handle: 'alice',
    })).resolves.toBeUndefined();

    if (original) {
      process.env.SMTP_HOST = original;
    }
  });
});
