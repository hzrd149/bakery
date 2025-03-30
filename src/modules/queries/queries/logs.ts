import { filter, from, merge, NEVER } from "rxjs";

import { Query } from "../types.js";
import logStore from "../../../services/log-store.js";
import bakeryDatabase, { schema } from "../../../db/index.js";

export const LogsQuery: Query<typeof schema.logs.$inferSelect> = (args: {
  service?: string;
  since?: number;
  until?: number;
  limit?: number;
}) =>
  merge(
    // get last 500 lines
    from(logStore.getLogs({ service: args.service, limit: 500 })),
    // subscribe to new logs
    logStore.insert$.pipe(
      // only return logs that match args
      filter((entry) => {
        return !args?.service || entry.service === args.service;
      }),
    ),
  );

export const ServicesQuery: Query<string[]> = () =>
  merge(
    NEVER,
    from(
      bakeryDatabase
        .select()
        .from(schema.logs)
        .groupBy(schema.logs.service)
        .all()
        .map((row) => row.service),
    ),
  );
