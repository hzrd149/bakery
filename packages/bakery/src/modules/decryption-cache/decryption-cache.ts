import { eq, inArray } from "drizzle-orm";
import { getHiddenContent } from "applesauce-core/helpers";
import { EventEmitter } from "events";

import { logger } from "../../logger.js";
import { schema, type BakeryDatabase } from "../../db/index.js";
import { searchDecrypted } from "../../db/search/decrypted.js";

type EventMap = {
  cache: [string, string];
};

export default class DecryptionCache extends EventEmitter<EventMap> {
  log = logger.extend("DecryptionCache");

  constructor(public database: BakeryDatabase) {
    super();
  }

  /** cache the decrypted content of an event */
  addEventContent(event: string, plaintext: string) {
    const result = this.database.insert(schema.decryptionCache).values({ event: event, content: plaintext }).run();

    if (result.changes > 0) {
      this.log(`Saved content for ${event}`);
      this.emit("cache", event, plaintext);
    }
  }

  search(query: string, filter?: { conversation?: [string, string]; order?: "rank" | "created_at" }) {
    return searchDecrypted(this.database.$client, query, filter).map((event) => ({
      event,
      plaintext: getHiddenContent(event)!,
    }));
  }

  /** clear all cached content */
  clearAll() {
    this.database.delete(schema.decryptionCache).run();
  }

  getEventContent(id: string): string | undefined {
    return this.database.select().from(schema.decryptionCache).where(eq(schema.decryptionCache.event, id)).get()
      ?.content;
  }

  getEventsContent(ids: string[]): (typeof schema.decryptionCache.$inferSelect)[] {
    return this.database.select().from(schema.decryptionCache).where(inArray(schema.decryptionCache.event, ids)).all();
  }
}
