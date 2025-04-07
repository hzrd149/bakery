import { kinds, NostrEvent } from "nostr-tools";
import { type Database } from "better-sqlite3";

import * as schema from "../schema.js";
import { logger } from "../../logger.js";
import { hasTable, parseEventRow } from "../helpers.js";
import { mapParams } from "../../helpers/sql.js";

const log = logger.extend("Database:Search:Events");

const SEARCHABLE_TAGS = ["title", "description", "about", "summary", "alt"];
const SEARCHABLE_KIND_BLACKLIST = [kinds.EncryptedDirectMessage];
const SEARCHABLE_CONTENT_FORMATTERS: Record<number, (content: string) => string> = {
  [kinds.Metadata]: (content) => {
    const SEARCHABLE_PROFILE_FIELDS = [
      "name",
      "display_name",
      "about",
      "nip05",
      "lud16",
      "website",
      // Deprecated fields
      "displayName",
      "username",
    ];
    try {
      const lines: string[] = [];
      const json = JSON.parse(content);

      for (const field of SEARCHABLE_PROFILE_FIELDS) {
        if (json[field]) lines.push(json[field]);
      }

      return lines.join("\n");
    } catch (error) {
      return content;
    }
  },
};

function convertEventToSearchRow(event: NostrEvent) {
  const tags = event.tags
    .filter((t) => SEARCHABLE_TAGS.includes(t[0]))
    .map((t) => t[1])
    .join(" ");

  const content = SEARCHABLE_CONTENT_FORMATTERS[event.kind]
    ? SEARCHABLE_CONTENT_FORMATTERS[event.kind](event.content)
    : event.content;

  return { id: event.id, content, tags };
}

export function setupEventFts(database: Database) {
  // Skip if search table already exists
  if (hasTable(database, "events_fts")) return;

  database
    .prepare(
      `CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(id UNINDEXED, content, tags, tokenize='trigram')`,
    )
    .run();

  log("Created event search table");

  const events = database
    .prepare<number[], typeof schema.events.$inferSelect>(
      `SELECT * FROM events WHERE kind NOT IN ${mapParams(SEARCHABLE_KIND_BLACKLIST)}`,
    )
    .all(...SEARCHABLE_KIND_BLACKLIST)
    .map(parseEventRow);

  // insert search content into table
  let changes = 0;
  for (const event of events) {
    const search = convertEventToSearchRow(event);

    // manually insert into fts table
    const result = database
      .prepare<[string, string, string]>(`INSERT OR REPLACE INTO events_fts (id, content, tags) VALUES (?, ?, ?)`)
      .run(search.id, search.content, search.tags);

    changes += result.changes;
  }
  log(`Inserted ${changes} events into search table`);
}

export function insertEventIntoSearch(database: Database, event: NostrEvent): boolean {
  const search = convertEventToSearchRow(event);

  const result = database
    .prepare<[string, string, string]>(`INSERT OR REPLACE INTO events_fts (id, content, tags) VALUES (?, ?, ?)`)
    .run(search.id, search.content, search.tags);

  return result.changes > 0;
}

export function removeEventsFromSearch(database: Database, events: string[]): boolean {
  const result = database.prepare<string[]>(`DELETE FROM events_fts WHERE id IN ${mapParams(events)}`).run(...events);
  return result.changes > 0;
}
