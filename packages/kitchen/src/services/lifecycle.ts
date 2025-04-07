import { combineLatest } from "rxjs";
import { kinds } from "nostr-tools";

import { accounts } from "./accounts";
import bakery$ from "./connection";
import defined from "../operators/defined";
import { replaceableLoader } from "./loaders";

// Fetch to the users profile when connected
combineLatest([
  accounts.active$.pipe(defined()),
  bakery$.pipe(defined()),
]).subscribe(([account, _bakery]) => {
  replaceableLoader.next({
    kind: kinds.Metadata,
    pubkey: account.pubkey,
  });
  replaceableLoader.next({
    kind: kinds.Metadata,
    pubkey: account.pubkey,
  });
  replaceableLoader.next({
    kind: kinds.Contacts,
    pubkey: account.pubkey,
  });
});
