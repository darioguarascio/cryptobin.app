import {
  VAULT_CIPHER_ALGORITHM,
  VAULT_CRYPTO_VERSION,
  VAULT_KDF_ALGORITHM,
  VAULT_KDF_HASH,
  VAULT_KDF_ITERATIONS,
  type EncryptedVaultSecret,
} from './vaultCrypto';

export const VAULT_STORE_VERSION = 1 as const;
export const VAULT_LOCAL_STORAGE_KEY = 'cryptobin.vault.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface VaultRecord {
  id: string;
  createdAt: string;
  payload: EncryptedVaultSecret;
}

interface VaultStoreSnapshot {
  version: typeof VAULT_STORE_VERSION;
  records: VaultRecord[];
}

function isEncryptedVaultSecret(value: unknown): value is EncryptedVaultSecret {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const kdf = payload.kdf;

  return (
    payload.version === VAULT_CRYPTO_VERSION &&
    typeof payload.salt === 'string' &&
    typeof payload.iv === 'string' &&
    typeof payload.ciphertext === 'string' &&
    payload.algorithm === VAULT_CIPHER_ALGORITHM &&
    typeof kdf === 'object' &&
    kdf !== null &&
    (kdf as Record<string, unknown>).algorithm === VAULT_KDF_ALGORITHM &&
    (kdf as Record<string, unknown>).hash === VAULT_KDF_HASH &&
    (kdf as Record<string, unknown>).iterations === VAULT_KDF_ITERATIONS
  );
}

function isVaultRecord(value: unknown): value is VaultRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    typeof record.createdAt === 'string' &&
    isEncryptedVaultSecret(record.payload)
  );
}

function parseVaultStore(raw: string): VaultStoreSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const store = parsed as Record<string, unknown>;

    if (store.version !== VAULT_STORE_VERSION || !Array.isArray(store.records)) {
      return null;
    }

    return {
      version: VAULT_STORE_VERSION,
      records: store.records.filter(isVaultRecord),
    };
  } catch {
    return null;
  }
}

export function loadVaultRecords(storage: StorageLike): VaultRecord[] {
  const raw = storage.getItem(VAULT_LOCAL_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  return parseVaultStore(raw)?.records ?? [];
}

export function appendVaultRecord(storage: StorageLike, record: VaultRecord): VaultRecord[] {
  if (!isVaultRecord(record)) {
    throw new Error('Invalid vault record');
  }

  const existing = loadVaultRecords(storage);
  const updated: VaultStoreSnapshot = {
    version: VAULT_STORE_VERSION,
    records: [...existing, record],
  };

  storage.setItem(VAULT_LOCAL_STORAGE_KEY, JSON.stringify(updated));

  return updated.records;
}
