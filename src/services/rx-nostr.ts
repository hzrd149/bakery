import { ConnectionState, createRxNostr, noopVerifier } from "rx-nostr";
import { unixNow } from "applesauce-core/helpers";
import { BehaviorSubject } from "rxjs";
import { nanoid } from "nanoid";

// import { logger } from "../logger.js";
// const log = logger.extend("rx-nostr");

export const rxNostr = createRxNostr({
  skipVerify: true,
  verifier: noopVerifier,
});

// keep track of all relay connection states
export const connections$ = new BehaviorSubject<Record<string, ConnectionState>>({});
rxNostr.createConnectionStateObservable().subscribe((packet) => {
  const url = new URL(packet.from).toString();
  connections$.next({ ...connections$.value, [url]: packet.state });
});

// capture all notices sent from relays
export const notices$ = new BehaviorSubject<{ id: string; from: string; message: string; timestamp: number }[]>([]);
rxNostr.createAllMessageObservable().subscribe((packet) => {
  if (packet.type === "NOTICE") {
    const from = new URL(packet.from).toString();

    const notice = { id: nanoid(), from, message: packet.notice, timestamp: unixNow() };
    notices$.next([...notices$.value, notice]);
  }
});
