import { EventStore, QueryStore } from "applesauce-core";
import { verifyEvent } from "nostr-tools";

import { IS_DEV } from "../env.js";
import { rxNostr } from "./rx-nostr.js";

export const eventStore = new EventStore();
export const queryStore = new QueryStore(eventStore);

eventStore.verifyEvent = verifyEvent;

// add all new events to event store
rxNostr.createAllEventObservable().subscribe((packet) => {
  eventStore.add(packet.event, packet.from);
});

setTimeout(() => {
  eventStore.database.prune();
}, 10 * 60_000);

if (IS_DEV) {
  // @ts-ignore
  global.eventStore = eventStore;
}
