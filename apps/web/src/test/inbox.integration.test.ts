import { beforeEach, describe, expect, it } from 'vitest';
import { GET } from '@/pages/api/inbox/index';
import { resetDatabase } from '@/test/fixtures/reset';
import { ALICE_HANDLE, FIXTURE_MASTER_PASSWORD, seedFixtures } from '@/test/fixtures/seed';
import { callApi, signInCookie } from '@/test/helpers/api';

describe('inbox API (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedFixtures();
  });

  it('lists inbox drops for authenticated recipient', async () => {
    const cookie = await signInCookie({
      handle: ALICE_HANDLE,
      masterPassword: FIXTURE_MASTER_PASSWORD,
    });

    const response = await callApi(GET, {
      url: 'http://localhost/api/inbox',
      cookie,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: { metadataPreview: { label?: string } | null }[];
      unreadCount: number;
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.metadataPreview?.label).toBe('Fixture drop');
    expect(body.unreadCount).toBe(1);
  });

  it('returns 401 without session', async () => {
    const response = await callApi(GET, { url: 'http://localhost/api/inbox' });
    expect(response.status).toBe(401);
  });
});
