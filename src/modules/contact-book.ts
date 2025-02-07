import { tap } from "rxjs";
import { kinds } from "nostr-tools";
import { ReplaceableQuery, UserContactsQuery } from "applesauce-core/queries";
import { getObservableValue } from "applesauce-core/observable";

import { logger } from "../logger.js";
import { COMMON_CONTACT_RELAYS } from "../env.js";
import { replaceableLoader } from "../services/loaders.js";
import { eventStore, queryStore } from "../services/stores.js";
import { simpleTimeout } from "../operators/simple-timeout.js";
import { arrayFallback } from "../helpers/array.js";

const DEFAULT_REQUEST_TIMEOUT = 10_000;

/** Loads 3 contact lists for pubkeys */
export default class ContactBook {
  log = logger.extend("ContactsBook");

  /** @deprecated use loadContacts instead */
  getContacts(pubkey: string) {
    return eventStore.getReplaceable(kinds.Contacts, pubkey);
  }

  getFollowedPubkeys(pubkey: string): string[] {
    const contacts = this.getContacts(pubkey);
    if (contacts) {
      return contacts.tags
        .filter((tag) => {
          return tag[0] === "p";
        })
        .map((tag) => {
          return tag[1];
        });
    }
    return [];
  }

  async loadContacts(pubkey: string, relays?: string[], force?: boolean) {
    relays = arrayFallback(relays, COMMON_CONTACT_RELAYS);
    this.log(`Requesting contacts from ${relays.length} relays for ${pubkey}`);
    replaceableLoader.next({ kind: kinds.Contacts, pubkey, relays, force });

    return getObservableValue(
      queryStore
        .createQuery(UserContactsQuery, pubkey)
        .pipe(simpleTimeout(DEFAULT_REQUEST_TIMEOUT, `Failed to load contacts for ${pubkey}`)),
    );
  }

  /** @deprecated */
  async loadContactsEvent(pubkey: string, relays?: string[]) {
    relays = arrayFallback(relays, COMMON_CONTACT_RELAYS);
    this.log(`Requesting contacts from ${relays.length} relays for ${pubkey}`);
    replaceableLoader.next({ kind: kinds.Contacts, pubkey, relays });

    return getObservableValue(
      queryStore.createQuery(ReplaceableQuery, kinds.Contacts, pubkey).pipe(
        simpleTimeout(DEFAULT_REQUEST_TIMEOUT, `Failed to load contacts for ${pubkey}`),
        tap((c) => c && this.log(`Found contacts for ${pubkey}`, c)),
      ),
    );
  }
}
