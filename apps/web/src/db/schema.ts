import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    handle: varchar('handle', { length: 64 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    email: varchar('email', { length: 320 }),
    publicKey: text('public_key').notNull(),
    encryptedPrivateKey: jsonb('encrypted_private_key').notNull(),
    totpSecret: text('totp_secret'),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('users_handle_idx').on(table.handle)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const inboxDrops = pgTable(
  'inbox_drops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    algorithm: varchar('algorithm', { length: 32 }).notNull(),
    iv: text('iv').notNull(),
    ciphertext: text('ciphertext').notNull(),
    wrappedKey: text('wrapped_key').notNull(),
    metadataPreview: jsonb('metadata_preview').$type<{
      from?: string;
      label?: string;
      description?: string;
    }>(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('inbox_drops_recipient_id_idx').on(table.recipientId),
    index('inbox_drops_recipient_unread_idx').on(table.recipientId, table.readAt),
  ],
);

export const vaultEntries = pgTable(
  'vault_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encryptedPayload: jsonb('encrypted_payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('vault_entries_user_id_idx').on(table.userId)],
);

export type User = typeof users.$inferSelect;
export type InboxDrop = typeof inboxDrops.$inferSelect;
export type VaultEntry = typeof vaultEntries.$inferSelect;
