import { combineLatest, map } from "rxjs";

import { Query } from "../types.js";
import { receiverEventsPerMinute } from "../../../services/runtime-stats.js";
import receiver from "../../../services/receiver.js";
import bakeryConfig from "../../../services/bakery-config.js";

export const ReceiverStatsQuery: Query<
  undefined,
  { enabled: boolean; eventsPerMinute: { average: number; minutes: number; audits: number[] } }
> = () =>
  combineLatest({
    enabled: bakeryConfig.data$.pipe(map((c) => !!c.receiverEnabled)),
    eventsPerMinute: receiverEventsPerMinute,
  });

export const ReceiverConnectionMapQuery: Query<undefined, Record<string, string[]>> = () =>
  receiver.relayPubkeys$.pipe(
    // convert the map and sets to an object
    map((map) => Object.fromEntries(Array.from(map.entries()).map(([k, v]) => [k, Array.from(v)]))),
  );
