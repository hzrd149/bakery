import { NostrPublishMethod, NostrSubscriptionMethod } from "applesauce-signers";
import { lastValueFrom, Observable } from "rxjs";

import { rxNostr } from "../services/rx-nostr.js";
import { SimplePool } from "nostr-tools";

const pool = new SimplePool();

export const nostrConnectSubscription: NostrSubscriptionMethod = (filters, relays) => {
  return new Observable((observer) => {
    const sub = pool.subscribeMany(relays, filters, {
      onevent: (event) => {
        observer.next(event);
      },
    });

    return () => sub.close();
  });
  // return new Observable((observer) => {
  //   const req = createRxForwardReq("nostr-connect");

  //   const observable = rxNostr.use(req, { on: { relays } });

  //   // hack to ensure subscription is active before sending filters
  //   const sub = observable.subscribe((p) => {
  //     observer.next(p.event);
  //   });

  //   req.emit(filters);
  //   return sub;
  // });
};
export const nostrConnectPublish: NostrPublishMethod = async (event, relays) => {
  await lastValueFrom(rxNostr.send(event, { on: { relays } }));
};
