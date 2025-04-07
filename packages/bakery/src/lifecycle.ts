import { combineLatest, distinctUntilChanged, map, of, switchMap } from "rxjs";
import { kinds } from "nostr-tools";
import { MailboxesQuery } from "applesauce-core/queries";

import { ownerAccount$ } from "./services/owner-signer.js";
import { eventStore, queryStore } from "./services/stores.js";
import { replaceableLoader } from "./services/loaders.js";
import { logger } from "./logger.js";
import { rxNostr } from "./services/rx-nostr.js";
import bakeryConfig from "./services/bakery-config.js";
import receiver from "./services/receiver.js";
import eventCache from "./services/event-cache.js";

const log = logger.extend("Lifecycle");

const ownerMailboxes$ = bakeryConfig.data$.pipe(
  switchMap((config) => (config.owner ? queryStore.createQuery(MailboxesQuery, config.owner) : of(undefined))),
);

// observable should not complete
ownerMailboxes$.subscribe({
  complete: () => {
    debugger;
  },
});

// load the users metadata, contacts, and relay list when the account changes and the mailboxes are loaded
combineLatest([ownerAccount$, ownerMailboxes$]).subscribe(([account, mailboxes]) => {
  if (!account) return;

  const relays = mailboxes && mailboxes.outboxes;

  log(`Loading metadata for ${account.pubkey} from ${relays?.length} relays`);

  // load the users metadata
  replaceableLoader.next({
    pubkey: account.pubkey,
    kind: kinds.Metadata,
    relays,
  });
  replaceableLoader.next({
    pubkey: account.pubkey,
    kind: kinds.Contacts,
    relays,
  });
  replaceableLoader.next({
    pubkey: account.pubkey,
    kind: kinds.RelayList,
    relays,
  });
});

// set the default relays when the account changes
ownerMailboxes$.subscribe((mailboxes) => {
  if (mailboxes) {
    rxNostr.setDefaultRelays(mailboxes.outboxes);
  } else {
    rxNostr.setDefaultRelays([]);
  }
});

// Start the receiver when there is an owner and its enabled
bakeryConfig.data$
  .pipe(
    map((c) => c.receiverEnabled),
    distinctUntilChanged(),
  )
  .subscribe((enabled) => {
    if (!enabled) {
      log("Receiver disabled");
      return;
    }

    log("Receiver enabled");
    return receiver.events$.subscribe((packet) => {
      eventStore.add(packet.event, packet.from);
      eventCache.addEvent(packet.event);
    });
  });
