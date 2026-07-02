import { describe, expect, it } from 'vitest';
import type { EncryptedVaultSecret } from './vaultCrypto';
import {
  VAULT_LOCAL_STORAGE_KEY,
  VAULT_STORE_VERSION,
  appendVaultRecord,
  loadVaultRecords,
  type StorageLike,
  type VaultRecord,
} from './vaultStore';

const samplePayload: EncryptedVaultSecret = {
  version: 1,
  kdf: { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: 600_000 },
  salt: 'abc',
  algorithm: 'AES-GCM-256',
  iv: 'def',
  ciphertext: 'ghi',
};

function createMockStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function sampleRecord(overrides: Partial<VaultRecord> = {}): VaultRecord {
  return {
    id: 'record-1',
    createdAt: '2026-07-02T12:00:00.000Z',
    payload: samplePayload,
    ...overrides,
  };
}

describe('vaultStore', () => {
  it('returns an empty list when storage is missing', () => {
    expect(loadVaultRecords(createMockStorage())).toEqual([]);
  });

  it('returns an empty list for corrupt JSON', () => {
    const storage = createMockStorage({ [VAULT_LOCAL_STORAGE_KEY]: '{not-json' });
    expect(loadVaultRecords(storage)).toEqual([]);
  });

  it('returns an empty list for unsupported store versions', () => {
    const storage = createMockStorage({
      [VAULT_LOCAL_STORAGE_KEY]: JSON.stringify({ version: 2, records: [sampleRecord()] }),
    });
    expect(loadVaultRecords(storage)).toEqual([]);
  });

  it('filters invalid records while keeping valid ones', () => {
    const storage = createMockStorage({
      [VAULT_LOCAL_STORAGE_KEY]: JSON.stringify({
        version: VAULT_STORE_VERSION,
        records: [
          sampleRecord(),
          { id: 'bad', createdAt: '2026-07-02T12:00:00.000Z', payload: { version: 2 } },
          { id: '', createdAt: '2026-07-02T12:00:00.000Z', payload: samplePayload },
        ],
      }),
    });

    expect(loadVaultRecords(storage)).toEqual([sampleRecord()]);
  });

  it('filters records with unsupported crypto parameters', () => {
    const storage = createMockStorage({
      [VAULT_LOCAL_STORAGE_KEY]: JSON.stringify({
        version: VAULT_STORE_VERSION,
        records: [
          sampleRecord({
            id: 'bad-kdf',
            payload: {
              ...samplePayload,
              kdf: { ...samplePayload.kdf, iterations: 1 },
            },
          }),
          sampleRecord({
            id: 'bad-cipher',
            payload: {
              ...samplePayload,
              algorithm: 'AES-GCM-128' as EncryptedVaultSecret['algorithm'],
            },
          }),
          sampleRecord({ id: 'good' }),
        ],
      }),
    });

    expect(loadVaultRecords(storage)).toEqual([sampleRecord({ id: 'good' })]);
  });

  it('appends encrypted records without storing plaintext metadata', () => {
    const storage = createMockStorage();
    const record = sampleRecord({ id: 'saved-1' });

    const records = appendVaultRecord(storage, record);

    expect(records).toEqual([record]);

    const raw = storage.getItem(VAULT_LOCAL_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('Production API key');
    expect(raw).not.toContain('Alice');
    expect(JSON.parse(raw!)).toEqual({
      version: VAULT_STORE_VERSION,
      records: [record],
    });
  });

  it('appends to existing records', () => {
    const first = sampleRecord({ id: 'first' });
    const second = sampleRecord({ id: 'second', createdAt: '2026-07-02T13:00:00.000Z' });
    const storage = createMockStorage({
      [VAULT_LOCAL_STORAGE_KEY]: JSON.stringify({
        version: VAULT_STORE_VERSION,
        records: [first],
      }),
    });

    expect(appendVaultRecord(storage, second)).toEqual([first, second]);
  });

  it('replaces corrupt storage when appending a valid record', () => {
    const storage = createMockStorage({ [VAULT_LOCAL_STORAGE_KEY]: 'broken' });
    const record = sampleRecord();

    expect(appendVaultRecord(storage, record)).toEqual([record]);
  });

  it('rejects invalid records on append', () => {
    const storage = createMockStorage();

    expect(() =>
      appendVaultRecord(storage, {
        id: 'bad',
        createdAt: '2026-07-02T12:00:00.000Z',
        payload: { version: 2 } as unknown as EncryptedVaultSecret,
      }),
    ).toThrow('Invalid vault record');
  });
});
