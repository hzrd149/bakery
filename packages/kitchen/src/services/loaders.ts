import { from, switchMap } from "rxjs";
import { ReplaceableLoader, SingleEventLoader } from "applesauce-loaders";
import { Filter } from "nostr-tools";
import { completeOnEose } from "applesauce-relay/operators";

import { eventStore } from "./stores";
import bakery$ from "./connection";
import defined from "../operators/defined";

function nostrRequest(_relays: string[], filters: Filter[]) {
  // ignore relays and always fetch from bakery
  return bakery$.pipe(
    defined(),
    switchMap((bakery) => bakery.req(filters).pipe(completeOnEose())),
  );
}

function cacheRequest(filters: Filter[]) {
  return from(bakery$).pipe(
    defined(),
    switchMap((bakery) => bakery.req(filters).pipe(completeOnEose())),
  );
}

export const replaceableLoader = new ReplaceableLoader(nostrRequest, {
  cacheRequest,
});
export const singleEventLoader = new SingleEventLoader(nostrRequest, {
  cacheRequest,
});

// Start the loader and send any events to the event store
replaceableLoader.subscribe((event) => eventStore.add(event));
singleEventLoader.subscribe((event) => eventStore.add(event));
