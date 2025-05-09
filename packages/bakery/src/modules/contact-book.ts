import { simpleTimeout } from "applesauce-core/observable";
import { ContactsQuery, ReplaceableQuery } from "applesauce-core/queries";
import { kinds } from "nostr-tools";

import { firstValueFrom } from "rxjs";
import { LOOKUP_RELAYS } from "../env.js";
import { arrayFallback } from "../helpers/array.js";
import { logger } from "../logger.js";
import { replaceableLoader } from "../services/loaders.js";
import { eventStore, queryStore } from "../services/stores.js";

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
    relays = arrayFallback(relays, LOOKUP_RELAYS);
    replaceableLoader.next({ kind: kinds.Contacts, pubkey, relays, force });

    return firstValueFrom(
      queryStore
        .createQuery(ContactsQuery, pubkey)
        .pipe(simpleTimeout(DEFAULT_REQUEST_TIMEOUT, `Failed to load contacts for ${pubkey}`)),
    );
  }

  /** @deprecated */
  async loadContactsEvent(pubkey: string, relays?: string[]) {
    relays = arrayFallback(relays, LOOKUP_RELAYS);
    replaceableLoader.next({ kind: kinds.Contacts, pubkey, relays });

    return firstValueFrom(
      queryStore
        .createQuery(ReplaceableQuery, kinds.Contacts, pubkey)
        .pipe(simpleTimeout(DEFAULT_REQUEST_TIMEOUT, `Failed to load contacts for ${pubkey}`)),
    );
  }
}
