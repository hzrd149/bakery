import { simpleTimeout } from "applesauce-core/observable";
import { ProfileQuery } from "applesauce-core/queries";
import { kinds } from "nostr-tools";

import { firstValueFrom } from "rxjs";
import { LOOKUP_RELAYS } from "../env.js";
import { arrayFallback } from "../helpers/array.js";
import { logger } from "../logger.js";
import { replaceableLoader } from "../services/loaders.js";
import { eventStore, queryStore } from "../services/stores.js";

const DEFAULT_REQUEST_TIMEOUT = 10_000;

/** loads kind 0 metadata for pubkeys */
export default class ProfileBook {
  log = logger.extend("ProfileBook");

  getProfile(pubkey: string) {
    return eventStore.getReplaceable(kinds.Metadata, pubkey);
  }

  async loadProfile(pubkey: string, relays?: string[], force?: boolean) {
    relays = arrayFallback(relays, LOOKUP_RELAYS);
    replaceableLoader.next({ kind: kinds.Metadata, pubkey, relays, force });

    return firstValueFrom(
      queryStore
        .createQuery(ProfileQuery, pubkey)
        .pipe(simpleTimeout(DEFAULT_REQUEST_TIMEOUT, `Failed to load profile for ${pubkey}`)),
    );
  }
}
