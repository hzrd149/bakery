import { from, tap } from "rxjs";
import { Filter } from "nostr-tools";
import { isFromCache, markFromCache } from "applesauce-core/helpers";
import { ReplaceableLoader, RequestLoader } from "applesauce-loaders/loaders";

import { LOOKUP_RELAYS } from "../env.js";
import { rxNostr } from "./rx-nostr.js";
import eventCache from "./event-cache.js";
import { eventStore, queryStore } from "./stores.js";

function cacheRequest(filters: Filter[]) {
  const events = eventCache.getEventsForFilters(filters);
  return from(events).pipe(tap(markFromCache));
}

export const replaceableLoader = new ReplaceableLoader(rxNostr, { cacheRequest, lookupRelays: LOOKUP_RELAYS });

replaceableLoader.subscribe((packet) => {
  // add it to event store
  const event = eventStore.add(packet.event, packet.from);

  // save it to the cache if its new
  if (!isFromCache(event)) eventCache.addEvent(event);
});

export const requestLoader = new RequestLoader(queryStore);
requestLoader.replaceableLoader = replaceableLoader;
