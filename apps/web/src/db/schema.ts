import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

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

export const sharedInboxes = pgTable(
  'shared_inboxes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    name: varchar('name', { length: 120 }).notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('shared_inboxes_slug_idx').on(table.slug)],
);

export const sharedInboxMembers = pgTable(
  'shared_inbox_members',
  {
    inboxId: uuid('inbox_id')
      .notNull()
      .references(() => sharedInboxes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull().default('member'),
    wrappedPrivateKey: jsonb('wrapped_private_key').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.inboxId, table.userId] }),
    index('shared_inbox_members_user_id_idx').on(table.userId),
    index('shared_inbox_members_inbox_id_idx').on(table.inboxId),
  ],
);

export const sharedInboxInvites = pgTable(
  'shared_inbox_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inboxId: uuid('inbox_id')
      .notNull()
      .references(() => sharedInboxes.id, { onDelete: 'cascade' }),
    inviteeHandle: varchar('invitee_handle', { length: 64 }).notNull(),
    inviteeId: uuid('invitee_id').references(() => users.id, { onDelete: 'cascade' }),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wrappedPrivateKey: jsonb('wrapped_private_key').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('shared_inbox_invites_invitee_id_idx').on(table.inviteeId, table.status),
    index('shared_inbox_invites_inbox_id_idx').on(table.inboxId),
  ],
);

export const sharedInboxDrops = pgTable(
  'shared_inbox_drops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inboxId: uuid('inbox_id')
      .notNull()
      .references(() => sharedInboxes.id, { onDelete: 'cascade' }),
    algorithm: varchar('algorithm', { length: 32 }).notNull(),
    iv: text('iv').notNull(),
    ciphertext: text('ciphertext').notNull(),
    wrappedKey: text('wrapped_key').notNull(),
    metadataPreview: jsonb('metadata_preview').$type<{
      from?: string;
      label?: string;
      description?: string;
    }>(),
    readBy: jsonb('read_by').$type<Record<string, string>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('shared_inbox_drops_inbox_id_idx').on(table.inboxId)],
);

export type SharedInbox = typeof sharedInboxes.$inferSelect;
export type SharedInboxMember = typeof sharedInboxMembers.$inferSelect;
export type SharedInboxInvite = typeof sharedInboxInvites.$inferSelect;
export type SharedInboxDrop = typeof sharedInboxDrops.$inferSelect;
