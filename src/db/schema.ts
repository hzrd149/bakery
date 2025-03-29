import { sql } from "drizzle-orm";
import { int, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

// Event store tables
export const events = sqliteTable(
  "events",
  {
    id: text("id", { length: 64 }).notNull().primaryKey(),
    created_at: int("created_at").notNull(),
    pubkey: text("pubkey", { length: 64 }).notNull(),
    sig: text("sig").notNull(),
    kind: int("kind").notNull(),
    content: text("content").notNull(),
    tags: text("tags").notNull(),
    identifier: text("identifier"),
  },
  (table) => [
    index("created_at").on(table.created_at),
    index("pubkey").on(table.pubkey),
    index("kind").on(table.kind),
    index("identifier").on(table.identifier),
  ],
);

// Event tags table
export const tags = sqliteTable(
  "tags",
  {
    id: int("id").primaryKey({ autoIncrement: true }),
    event: text("event", { length: 64 })
      .references(() => events.id)
      .notNull(),
    tag: text("tag", { length: 1 }).notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("event").on(table.event), index("tag").on(table.tag), index("value").on(table.value)],
);

// Decryption cache tables
export const decryptionCache = sqliteTable("decryption_cache", {
  event: text("event", { length: 64 })
    .references(() => events.id)
    .notNull()
    .primaryKey(),
  content: text("content").notNull(),
});

// Log store tables
export const logs = sqliteTable("logs", {
  id: text("id").primaryKey(),
  timestamp: int("timestamp"),
  service: text("service").notNull(),
  message: text("message").notNull(),
});

export const applicationState = sqliteTable("application_state", {
  id: text("id").primaryKey().notNull(),
  state: text("state"),
});

export const relayInfo = sqliteTable("relay_info", {
  url: text("url").primaryKey(),
  info: text("info").notNull(),
  updated_at: int("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
