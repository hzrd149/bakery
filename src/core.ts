import { createRxNostr, noopVerifier } from "rx-nostr";
import { verifyEvent } from "nostr-tools/wasm";
import { EventStore, QueryStore } from "applesauce-core";
import { logger } from "./logger.js";

const log = logger.extend("rx-nostr");

export const rxNostr = createRxNostr({
  verifier: async (event) => {
    try {
      return verifyEvent(event);
    } catch (error) {
      return false;
    }
  },
});

rxNostr.createConnectionStateObservable().subscribe((packet) => {
  log(`${packet.state} ${packet.from}`);
});

export const eventStore = new EventStore();
export const queryStore = new QueryStore(eventStore);
