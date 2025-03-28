import { NostrConnectSigner } from "applesauce-signers/signers/nostr-connect-signer";
import { BehaviorSubject, filter, lastValueFrom, pairwise, toArray } from "rxjs";
import { ActionHub } from "applesauce-actions";
import { EventFactory } from "applesauce-factory";

import secrets from "./secrets.js";
import { ProxySigner } from "../classes/proxy-signer.js";
import { eventStore } from "./stores.js";
import { nostrConnectPublish, nostrConnectSubscription } from "../helpers/applesauce.js";
import { NostrEvent } from "nostr-tools";
import eventCache from "./event-cache.js";
import { requestLoader } from "./loaders.js";
import bakeryConfig from "./config.js";
import { rxNostr } from "./rx-nostr.js";
import { logger } from "../logger.js";
import { NostrConnectAccount } from "applesauce-accounts/accounts";
import { DEFAULT_NOSTR_CONNECT_RELAYS } from "../const.js";

NostrConnectSigner.subscriptionMethod = nostrConnectSubscription;
NostrConnectSigner.publishMethod = nostrConnectPublish;

const log = logger.extend("Owner");

/** A temp signer while the owner is setting up their signer */
export const setupSigner$ = new BehaviorSubject<NostrConnectSigner | undefined>(undefined);

export function startSignerSetup(relays = DEFAULT_NOSTR_CONNECT_RELAYS) {
  if (setupSigner$.value) return setupSigner$.value;

  const signer = new NostrConnectSigner({ relays });
  setupSigner$.next(signer);

  // async setup process
  const p = signer.waitForSigner().then(async () => {
    const pubkey = await signer.getPublicKey();
    ownerAccount$.next(new NostrConnectAccount(pubkey, signer));
    setupSigner$.next(undefined);
  });

  return p;
}

export async function stopSignerSetup() {
  const signer = setupSigner$.getValue();
  if (signer) {
    signer.close();
    setupSigner$.next(undefined);
  }
}

/** The owner's account */
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

export async function ownerPublish(event: NostrEvent, relays?: string[]) {
  // save event to local stores
  eventStore.add(event);
  eventCache.addEvent(event);

  // publish event to owners outboxes
  if (bakeryConfig.data.owner) {
    try {
      relays = relays || (await requestLoader.mailboxes({ pubkey: bakeryConfig.data.owner })).outboxes;
      return await lastValueFrom(rxNostr.send(event, { on: { relays } }).pipe(toArray()));
    } catch (error) {
      // Failed to publish to outboxes, ignore error for now
      // TODO: this should retried at some point
    }
  }
}
