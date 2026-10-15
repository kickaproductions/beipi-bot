import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const items = sqliteTable('companion_items', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
  kind: text('kind').notNull(), title: text('title').notNull(),
  note: text('note').notNull().default(''), due: text('due'),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});
export const discordDrafts = sqliteTable('discord_drafts', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(),
  payload: text('payload').notNull(), updatedAt: text('updated_at').notNull(),
});
