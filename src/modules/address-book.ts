import { tap } from "rxjs";
import { kinds } from "nostr-tools";
import { MailboxesQuery } from "applesauce-core/queries";
import { getObservableValue } from "applesauce-core/observable";
import { getInboxes, getOutboxes } from "applesauce-core/helpers";

import { logger } from "../logger.js";
import { COMMON_CONTACT_RELAYS } from "../env.js";
import { replaceableLoader } from "../services/loaders.js";
import { eventStore, queryStore } from "../services/stores.js";
import { simpleTimeout } from "../operators/simple-timeout.js";
import { arrayFallback } from "../helpers/array.js";

const DEFAULT_REQUEST_TIMEOUT = 10_000;

/** Loads 10002 events for pubkeys */
export default class AddressBook {
  log = logger.extend("AddressBook");

  getMailboxes(pubkey: string) {
    return eventStore.getReplaceable(kinds.RelayList, pubkey);
  }
  getOutboxes(pubkey: string) {
    const mailboxes = this.getMailboxes(pubkey);
    return mailboxes && getOutboxes(mailboxes);
  }
  getInboxes(pubkey: string) {
    const mailboxes = this.getMailboxes(pubkey);
    return mailboxes && getInboxes(mailboxes);
  }

  async loadMailboxes(pubkey: string, relays?: string[], force?: boolean) {
    relays = arrayFallback(relays, COMMON_CONTACT_RELAYS);
    this.log(`Requesting mailboxes from ${relays.length} relays for ${pubkey}`);
    replaceableLoader.next({ kind: kinds.RelayList, pubkey, relays, force });

    return getObservableValue(
      queryStore.createQuery(MailboxesQuery, pubkey).pipe(
        simpleTimeout(DEFAULT_REQUEST_TIMEOUT, `Failed to load mailboxes for ${pubkey}`),
        tap((m) => m && this.log(`Found mailboxes for ${pubkey}`, m)),
      ),
    );
  }
}
