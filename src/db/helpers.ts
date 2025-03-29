import { type Database } from "better-sqlite3";
import { NostrEvent } from "nostr-tools";

import * as schema from "./schema.js";

export function hasTable(db: Database, table: string) {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
}

export function parseEventRow(row: typeof schema.events.$inferSelect): NostrEvent {
  return {
    kind: row.kind,
    id: row.id,
    pubkey: row.pubkey,
    content: row.content,
    created_at: row.created_at,
    sig: row.sig,
    tags: JSON.parse(row.tags),
  };
}
