import { tap } from "rxjs";
import { kinds } from "nostr-tools";
import { getObservableValue } from "applesauce-core/observable";
import { ProfileQuery } from "applesauce-core/queries";

import { COMMON_CONTACT_RELAYS } from "../env.js";
import { logger } from "../logger.js";
import { replaceableLoader } from "../services/loaders.js";
import { eventStore, queryStore } from "../services/stores.js";
import { simpleTimeout } from "../operators/simple-timeout.js";
import { arrayFallback } from "../helpers/array.js";

const DEFAULT_REQUEST_TIMEOUT = 10_000;

/** loads kind 0 metadata for pubkeys */
export default class ProfileBook {
  log = logger.extend("ProfileBook");

  getProfile(pubkey: string) {
    return eventStore.getReplaceable(kinds.Metadata, pubkey);
  }

  async loadProfile(pubkey: string, relays?: string[], force?: boolean) {
    relays = arrayFallback(relays, COMMON_CONTACT_RELAYS);
    this.log(`Requesting profile from ${relays.length} relays for ${pubkey}`);
    replaceableLoader.next({ kind: kinds.Metadata, pubkey, relays, force });

    return getObservableValue(
      queryStore.createQuery(ProfileQuery, pubkey).pipe(
        simpleTimeout(DEFAULT_REQUEST_TIMEOUT, `Failed to load profile for ${pubkey}`),
        tap((p) => p && this.log(`Found profile for ${pubkey}`, p)),
      ),
    );
  }
}
