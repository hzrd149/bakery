import { NostrConnectSigner } from "applesauce-signers/signers/nostr-connect-signer";
import { BehaviorSubject, filter, lastValueFrom, pairwise } from "rxjs";
import { ActionHub } from "applesauce-actions";
import { EventFactory } from "applesauce-factory";

import secrets from "./secrets.js";
import { ProxySigner } from "../classes/proxy-signer.js";
import { eventStore } from "./stores.js";
import { nostrConnectPublish, nostrConnectSubscription } from "../helpers/applesauce.js";
import { NostrEvent } from "nostr-tools";
import eventCache from "./event-cache.js";
import { requestLoader } from "./loaders.js";
import config from "./config.js";
import { rxNostr } from "./rx-nostr.js";
import { logger } from "../logger.js";
import { NostrConnectAccount } from "applesauce-accounts/accounts";

NostrConnectSigner.subscriptionMethod = nostrConnectSubscription;
NostrConnectSigner.publishMethod = nostrConnectPublish;

const log = logger.extend("Owner");

export const ownerAccount$ = new BehaviorSubject<NostrConnectAccount<any> | undefined>(undefined);

// Update account when secrets change
secrets.watch("ownerAccount").subscribe((json) => {
  // only load the account if its a new account
  if (json && json.id !== ownerAccount$.value?.id) {
    log("Loading owner account");
    const account = NostrConnectAccount.fromJSON(json);
    ownerAccount$.next(account);

    account.signer
      .connect()
      .then(() => {
        log("Owner account connected");
      })
      .catch((error) => {
        log("Error connecting to owner account", error);
      });
  }
});

// Save the account when it changes
ownerAccount$.pipe(filter((account) => account !== undefined)).subscribe((account) => {
  if (secrets.get("ownerAccount")?.id !== account.id) {
    log("Saving owner account", account.id);
    secrets.set("ownerAccount", account.toJSON());
  }
});

// close the previous signer and connect the new one
ownerAccount$.pipe(pairwise()).subscribe(([prev, current]) => {
  if (prev) {
    log("Closing previous signer");
    prev.signer.close();
  }
  if (current) {
    log("Connecting to signer");
    current.signer.connect();
  }
});

export const ownerSigner = new ProxySigner(ownerAccount$);
export const ownerFactory = new EventFactory({ signer: ownerSigner });
export const ownerActions = new ActionHub(eventStore, ownerFactory);

export async function ownerPublish(event: NostrEvent) {
  // save event to local stores
  eventStore.add(event);
  eventCache.addEvent(event);

  // publish event to owners outboxes
  if (config.data.owner) {
    try {
      const mailboxes = await requestLoader.mailboxes({ pubkey: config.data.owner });
      await lastValueFrom(rxNostr.send(event, { on: { relays: mailboxes.outboxes } }));
    } catch (error) {
      // Failed to publish to outboxes, ignore error for now
      // TODO: this should retried at some point
    }
  }
}
