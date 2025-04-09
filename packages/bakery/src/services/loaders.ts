import { from, tap } from "rxjs";
import { Filter, NostrEvent } from "nostr-tools";
import { isFromCache, markFromCache } from "applesauce-core/helpers";
import { DnsIdentityLoader, NostrRequest, ReplaceableLoader, SingleEventLoader } from "applesauce-loaders/loaders";

import { LOOKUP_RELAYS } from "../env.js";
import eventCache from "./event-cache.js";
import { eventStore } from "./stores.js";
import AsyncLoader from "../modules/async-loader.js";
import pool from "./pool.js";

const nostrRequest: NostrRequest = (relays, filters, id) => pool.req(relays, filters, id);

function cacheRequest(filters: Filter[]) {
  const events = eventCache.getEventsForFilters(filters);
  return from(events).pipe(tap(markFromCache));
}

function handleEvent(event: NostrEvent) {
  eventStore.add(event);

  if (!isFromCache(event)) eventCache.addEvent(event);
}

export const dnsIdentityLoader = new DnsIdentityLoader();

export const replaceableLoader = new ReplaceableLoader(nostrRequest, { cacheRequest, lookupRelays: LOOKUP_RELAYS });
replaceableLoader.subscribe(handleEvent);

export const singleEventLoader = new SingleEventLoader(nostrRequest, { cacheRequest });
singleEventLoader.subscribe(handleEvent);

export const asyncLoader = new AsyncLoader(eventCache, eventStore, replaceableLoader, singleEventLoader);
