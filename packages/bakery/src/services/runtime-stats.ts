import { bufferTime, map, merge, shareReplay } from "rxjs";
import { distinct } from "rxjs";
import { onShutdown } from "node-graceful-shutdown";

import receiver from "./receiver.js";
import { auditsPerMinute } from "../helpers/rxjs.js";
import eventCache from "./event-cache.js";

// Log the average number of events received per minute over the last 5 minutes
export const receiverEventsPerMinute = receiver.events$.pipe(
  distinct((e) => e.event.id),
  bufferTime(60_000), // Buffer events for 1 minute
  map((events) => events.length), // Count events in buffer
  auditsPerMinute(),
  shareReplay(),
);

export const databaseEventsPerMinute = eventCache.inserted$.pipe(
  bufferTime(60_000), // Buffer events for 1 minute
  map((events) => events.length), // Count events in buffer
  auditsPerMinute(),
  shareReplay(),
);

// Start all the stats and keep them running
const sub = merge(receiverEventsPerMinute, databaseEventsPerMinute).subscribe();

// Stop all the stats when the app shuts down
onShutdown("runtime-stats", () => sub.unsubscribe());
