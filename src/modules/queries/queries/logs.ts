import { filter, from, merge } from "rxjs";

import { Query } from "../types.js";
import logStore from "../../../services/log-store.js";
import { schema } from "../../../db/index.js";

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
