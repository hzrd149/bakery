import { type Database } from "better-sqlite3";
import { NostrEvent } from "nostr-tools";

import { logger } from "../../logger.js";
import { hasTable, parseEventRow } from "../helpers.js";
import * as schema from "../schema.js";
import { HiddenContentSymbol } from "applesauce-core/helpers";

const log = logger.extend("Database:Search:Decrypted");

export function setupDecryptedFts(database: Database) {
  // Skip if search table already exists
  if (hasTable(database, "decryption_cache_fts")) return;

  database
    .prepare(
      `CREATE VIRTUAL TABLE IF NOT EXISTS decryption_cache_fts USING fts5(content, content='decryption_cache', tokenize='trigram')`,
    )
    .run();
  log(`Created decryption cache search table`);

  // create triggers to sync table
  database
    .prepare(
      `
		CREATE TRIGGER IF NOT EXISTS decryption_cache_ai AFTER INSERT ON decryption_cache BEGIN
			INSERT INTO decryption_cache_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
		END;
		`,
    )
    .run();
  database
    .prepare(
      `
		CREATE TRIGGER IF NOT EXISTS decryption_cache_ad AFTER DELETE ON decryption_cache BEGIN
  		INSERT INTO decryption_cache_ai(decryption_cache_ai, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
		END;
		`,
    )
    .run();

  // populate table
  const inserted = database
    .prepare(`INSERT INTO decryption_cache_fts (rowid, content) SELECT rowid, content FROM decryption_cache`)
    .run();

  log(`Indexed ${inserted.changes} decrypted events in search table`);
}

export function searchDecrypted(
  database: Database,
  search: string,
  filter?: { conversation?: [string, string]; order?: "rank" | "created_at" },
): NostrEvent[] {
  const params: any[] = [];
  const andConditions: string[] = [];

  let sql = `SELECT events.*, decryption_cache.content as plaintext FROM decryption_cache_fts
				INNER JOIN decryption_cache ON decryption_cache_fts.rowid = decryption_cache.rowid
				INNER JOIN events ON decryption_cache.event = events.id`;

  andConditions.push("decryption_cache_fts MATCH ?");
  params.push(search);

  // filter down by authors
  if (filter?.conversation) {
    sql += `\nINNER JOIN tags ON tag.e = events.id AND tags.t = 'p'`;
    andConditions.push(`(tags.v = ? AND events.pubkey = ?) OR (tags.v = ? AND events.pubkey = ?)`);
    params.push(...filter.conversation, ...Array.from(filter.conversation).reverse());
  }

  if (andConditions.length > 0) {
    sql += ` WHERE ${andConditions.join(" AND ")}`;
  }

  switch (filter?.order) {
    case "rank":
      sql += " ORDER BY rank";
      break;

    case "created_at":
    default:
      sql += " ORDER BY events.created_at DESC";
      break;
  }

  return database
    .prepare<any[], typeof schema.events.$inferSelect & { plaintext: string }>(sql)
    .all(...params)
    .map((row) => {
      // Create the event object and add the hidden content
      const event = parseEventRow(row);
      Reflect.set(event, HiddenContentSymbol, row.plaintext);
      return event;
    });
}
