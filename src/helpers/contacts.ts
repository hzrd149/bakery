import { NostrEvent } from "nostr-tools";
import { getRelaysFromContactsEvent } from "applesauce-core/helpers";

export function getRelaysFromContactList(event: NostrEvent) {
  const relays = getRelaysFromContactsEvent(event);

  if (!relays) return null;

  return Array.from(relays.entries()).map(([url, mode]) => ({
    url,
    write: mode === "outbox" || mode === "all",
    read: mode === "inbox" || mode === "all",
  }));
}
