import { Subject } from "rxjs";
import { ISyncEventStore } from "applesauce-core";
import { Filter, NostrEvent, kinds } from "nostr-tools";
import { eq, inArray } from "drizzle-orm";
import EventEmitter from "events";

import { logger } from "../logger.js";
import { insertEventIntoSearch, removeEventsFromSearch } from "../db/search/events.js";
import { BakeryDatabase, schema } from "../db/index.js";
import { parseEventRow } from "../db/helpers.js";
import {
  addressableHistoryQuery,
  addressableQuery,
  buildSQLQueryForFilters,
  eventQuery,
  replaceableHistoryQuery,
  replaceableQuery,
} from "../db/queries.js";

type EventMap = {
  "event:inserted": [NostrEvent];
  "event:removed": [string];
};

export class SQLiteEventStore extends EventEmitter<EventMap> implements ISyncEventStore {
  log = logger.extend("sqlite-event-store");

  inserted$ = new Subject<NostrEvent>();

  preserveEphemeral = false;
  keepHistory = false;

  constructor(public database: BakeryDatabase) {
    super();
  }

  addEvent(event: NostrEvent): boolean {
    // Don't store ephemeral events in db,
    // just return the event directly
    if (!this.preserveEphemeral && kinds.isEphemeralKind(event.kind)) return false;

    // Check if the event is already in the database
    if (eventQuery.execute({ id: event.id }).sync() !== undefined) return false;

    // Get the replaceable identifier for the event
    const identifier =
      kinds.isReplaceableKind(event.kind) || !kinds.isAddressableKind(event.kind)
        ? undefined
        : event.tags.find((t) => t[0] === "d" && t[1])?.[1];

    // Check if the event is already in the database
    if (this.keepHistory === false && kinds.isReplaceableKind(event.kind)) {
      // Only check for newer events if we're not keeping history
      if (this.keepHistory === false) {
        const existing = replaceableQuery
          .execute({
            kind: event.kind,
            pubkey: event.pubkey,
            identifier,
          })
          .sync();

        // Found a newer event, exit
        if (existing !== undefined) return false;
      }
    } else if (this.keepHistory === false && kinds.isAddressableKind(event.kind)) {
      const existing = addressableQuery
        .execute({
          kind: event.kind,
          pubkey: event.pubkey,
          identifier,
        })
        .sync();

      // Found a newer event, exit
      if (existing !== undefined) return false;
    }

    // Attempt to insert the event into the database
    const inserted = this.database.transaction(() => {
      const insert = this.database
        .insert(schema.events)
        .values({
          id: event.id,
          created_at: event.created_at,
          pubkey: event.pubkey,
          sig: event.sig,
          kind: event.kind,
          content: event.content,
          tags: JSON.stringify(event.tags),
          identifier: identifier ?? null,
        })
        .run();

      // Insert indexed tags
      this.insertEventTags(event);

      return insert.changes > 0;
    });

    if (inserted) {
      // Remove older replaceable events if we're not keeping history
      if (this.keepHistory === false && (kinds.isReplaceableKind(event.kind) || kinds.isAddressableKind(event.kind))) {
        this.removeReplaceableHistory(event.kind, event.pubkey, identifier);
      }

      // Index the event
      this.insertEventIntoSearch(event);

      // Emit the event
      this.emit("event:inserted", event);
      this.inserted$.next(event);
    }

    return inserted;
  }

  private insertEventTags(event: NostrEvent) {
    for (let tag of event.tags) {
      if (tag[0].length === 1 && tag[1]) {
        this.database.insert(schema.tags).values({ event: event.id, tag: tag[0], value: tag[1] }).run();
      }
    }
  }

  private insertEventIntoSearch(event: NostrEvent) {
    return insertEventIntoSearch(this.database.$client, event);
  }

  protected removeReplaceableHistory(kind: number, pubkey: string, identifier?: string): number {
    const existing = this.getReplaceableHistory(kind, pubkey, identifier);

    // If there is more than one event, remove the older ones
    if (existing.length > 1) {
      const removeIds = existing
        // ignore the first event
        .slice(1)
        // get the ids of all the older events
        .map((item) => item.id);

      this.removeEvents(removeIds);

      return removeIds.length;
    }

    return 0;
  }

  removeEvents(ids: string[]): number {
    // Remove the events from the fts search table
    removeEventsFromSearch(this.database.$client, ids);

    const results = this.database.transaction(() => {
      // Delete from tags first
      this.database.delete(schema.tags).where(inArray(schema.tags.event, ids)).run();
      // Then delete from events
      return this.database.delete(schema.events).where(inArray(schema.events.id, ids)).run();
    });

    if (results.changes > 0) {
      for (const id of ids) {
        this.emit("event:removed", id);
      }
    }

    return results.changes;
  }

  hasEvent(id: string): boolean {
    return this.database.select().from(schema.events).where(eq(schema.events.id, id)).get() !== undefined;
  }
  getEvent(id: string): NostrEvent | undefined {
    const row = this.database.select().from(schema.events).where(eq(schema.events.id, id)).get();
    if (!row) return undefined;
    return parseEventRow(row);
  }

  protected getReplaceableQuery(kind: number, pubkey: string, identifier?: string) {
    if (kinds.isAddressableKind(kind)) {
      return addressableQuery.execute({ kind, pubkey, identifier });
    } else if (kinds.isReplaceableKind(kind)) {
      return replaceableQuery.execute({ kind, pubkey });
    } else throw new Error("Regular events are not replaceable");
  }
  hasReplaceable(kind: number, pubkey: string, identifier?: string): boolean {
    return this.getReplaceableQuery(kind, pubkey, identifier).sync() !== undefined;
  }
  getReplaceable(kind: number, pubkey: string, identifier?: string): NostrEvent | undefined {
    const row = this.getReplaceableQuery(kind, pubkey, identifier).sync();
    if (!row) return undefined;

    return parseEventRow(row);
  }
  getReplaceableHistory(kind: number, pubkey: string, identifier?: string): NostrEvent[] {
    if (kinds.isRegularKind(kind)) throw new Error("Regular events are not replaceable");

    const query = kinds.isAddressableKind(kind)
      ? addressableHistoryQuery.execute({
          kind,
          pubkey,
          identifier,
        })
      : replaceableHistoryQuery.execute({
          kind,
          pubkey,
        });

    return query.sync().map(parseEventRow);
  }
  getTimeline(filters: Filter | Filter[]): NostrEvent[] {
    return this.getEventsForFilters(Array.isArray(filters) ? filters : [filters]);
  }
  getAll(filters: Filter | Filter[]): Set<NostrEvent> {
    return new Set(this.getEventsForFilters(Array.isArray(filters) ? filters : [filters]));
  }

  // TODO: Update this to use drizzle
  getEventsForFilters(filters: Filter[]) {
    const { stmt, parameters } = buildSQLQueryForFilters(filters);

    return this.database.$client
      .prepare<any[], typeof schema.events.$inferSelect>(stmt)
      .all(parameters)
      .map(parseEventRow);
  }

  // TODO: Update this to use drizzle
  countEventsForFilters(filters: Filter[]) {
    const { stmt, parameters } = buildSQLQueryForFilters(filters);

    const results = this.database.$client
      .prepare<any[], { count: number }>(`SELECT COUNT(*) as count FROM ( ${stmt} )`)
      .get(parameters) as { count: number } | undefined;
    return results?.count ?? 0;
  }
}
