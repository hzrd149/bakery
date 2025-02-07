import { from, tap } from "rxjs";
import { Filter } from "nostr-tools";
import { isFromCache, markFromCache } from "applesauce-core/helpers";
import { ReplaceableLoader } from "applesauce-loaders/loaders";

import { rxNostr } from "./rx-nostr.js";
import eventCache from "./event-cache.js";
import { eventStore } from "./stores.js";

function cacheRequest(filters: Filter[]) {
  const events = eventCache.getEventsForFilters(filters);
  return from(events).pipe(tap(markFromCache));
}

export const replaceableLoader = new ReplaceableLoader(rxNostr, { cacheRequest });

replaceableLoader.subscribe((packet) => {
  // add it to event store
  const event = eventStore.add(packet.event, packet.from);

  // save it to the cache if its new
  if (!isFromCache(event)) eventCache.addEvent(event);
});
