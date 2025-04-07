import { bufferTime, filter, firstValueFrom, Subject, Subscription } from "rxjs";
import { gte, lte, like, and } from "drizzle-orm";
import { nanoid } from "nanoid";

import { BakeryDatabase } from "../../db/database.js";
import { schema } from "../../db/index.js";

export type LogFilter = {
  service?: string;
  since?: number;
  until?: number;
};

export default class LogStore {
  public insert$ = new Subject<typeof schema.logs.$inferInsert>();
  protected write$ = new Subject<typeof schema.logs.$inferInsert>();

  protected writeQueue: Subscription;

  constructor(public database: BakeryDatabase) {
    // Buffer writes to the database
    this.writeQueue = this.write$
      .pipe(
        bufferTime(1000, null, 5000),
        filter((entries) => entries.length > 0),
      )
      .subscribe((entries) => {
        this.database.insert(schema.logs).values(entries).run();
      });
  }

  addEntry(service: string, timestamp: Date | number, message: string) {
    const unix = timestamp instanceof Date ? Math.round(timestamp.valueOf() / 1000) : timestamp;
    const entry = {
      id: nanoid(),
      service,
      timestamp: unix,
      message,
    };

    this.write$.next(entry);
    this.insert$.next(entry);
  }

  getLogs(filter?: LogFilter & { limit?: number }) {
    return this.database
      .select()
      .from(schema.logs)
      .where(({ service, timestamp }) => {
        const conditions = [];
        if (filter?.service) conditions.push(like(service, `${filter.service}%`));
        if (filter?.since) conditions.push(gte(timestamp, filter.since));
        if (filter?.until) conditions.push(lte(timestamp, filter.until));
        return and(...conditions);
      })
      .limit(filter?.limit ?? -1)
      .all();
  }

  clearLogs(filter?: LogFilter) {
    const conditions = [];
    if (filter?.service) conditions.push(like(schema.logs.service, `${filter.service}%`));
    if (filter?.since) conditions.push(gte(schema.logs.timestamp, filter.since));
    if (filter?.until) conditions.push(lte(schema.logs.timestamp, filter.until));
    const where = and(...conditions);

    this.database.delete(schema.logs).where(where).run();
  }

  close() {
    // stop writing to the database
    this.writeQueue.unsubscribe();
  }
}
