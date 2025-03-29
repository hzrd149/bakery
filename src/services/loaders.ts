import { EventPacket } from "rx-nostr";
import { from, tap } from "rxjs";
import { Filter } from "nostr-tools";
import { isFromCache, markFromCache } from "applesauce-core/helpers";
import { ReplaceableLoader, SingleEventLoader } from "applesauce-loaders/loaders";

import { LOOKUP_RELAYS } from "../env.js";
import { rxNostr } from "./rx-nostr.js";
import eventCache from "./event-cache.js";
import { eventStore } from "./stores.js";
import AsyncLoader from "../modules/async-loader.js";

function cacheRequest(filters: Filter[]) {
  const events = eventCache.getEventsForFilters(filters);
  return from(events).pipe(tap(markFromCache));
}

function handleEvent(packet: EventPacket) {
  const event = eventStore.add(packet.event, packet.from);
  if (!isFromCache(event)) eventCache.addEvent(event);
}

export const replaceableLoader = new ReplaceableLoader(rxNostr, { cacheRequest, lookupRelays: LOOKUP_RELAYS });
replaceableLoader.subscribe(handleEvent);

export const singleEventLoader = new SingleEventLoader(rxNostr, { cacheRequest });
singleEventLoader.subscribe(handleEvent);

export const asyncLoader = new AsyncLoader(eventCache, eventStore, replaceableLoader, singleEventLoader);
