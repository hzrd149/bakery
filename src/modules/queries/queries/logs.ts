import { filter, from, fromEvent, merge } from "rxjs";
import { Query } from "../types.js";
import logStore from "../../../services/log-store.js";
import { LogEntry } from "../../log-store/log-store.js";

export const LogsQuery: Query<LogEntry> = (args: {
  service?: string;
  since?: number;
  until?: number;
  limit?: number;
}) =>
  merge(
    // get last 500 lines
    from(logStore.getLogs({ service: args.service, limit: 500 })),
    // subscribe to new logs
    fromEvent<LogEntry>(logStore, "log").pipe(
      // only return logs that match args
      filter((entry) => {
        return !args?.service || entry.service === args.service;
      }),
    ),
  );
