import { filter, lastValueFrom, mergeMap, Subscription, tap, toArray } from "rxjs";
import { NostrEvent, kinds } from "nostr-tools";
import { createRxForwardReq } from "rx-nostr";
import { MailboxesQuery } from "applesauce-core/queries";
import { EventEmitter } from "events";

import { logger } from "../logger.js";
import type App from "../app/index.js";
import { arrayFallback } from "../helpers/array.js";
import { rxNostr } from "../services/rx-nostr.js";
import { eventStore, queryStore } from "../services/stores.js";
import { COMMON_CONTACT_RELAYS } from "../env.js";
import { bufferAudit } from "../helpers/rxjs.js";
import { getRelaysFromContactList } from "../helpers/nostr/contacts.js";

type EventMap = {
  open: [string, string];
  close: [string, string];
  message: [NostrEvent];
};

/** handles sending and receiving direct messages */
export default class DirectMessageManager extends EventEmitter<EventMap> {
  log = logger.extend("DirectMessageManager");
  app: App;

  private explicitRelays: string[] = [];

  constructor(app: App) {
    super();
    this.app = app;

    // Load profiles for participants when
    // a conversation thread is opened
    this.on("open", (a, b) => {
      this.app.profileBook.loadProfile(a, this.app.addressBook.getOutboxes(a));
      this.app.profileBook.loadProfile(b, this.app.addressBook.getOutboxes(b));
    });

    // emit a "message" event when a new kind4 message is detected
    this.app.eventStore.on("event:inserted", (event) => {
      if (event.kind === kinds.EncryptedDirectMessage) this.emit("message", event);
    });
  }

  /** sends a DM event to the receivers inbox relays */
  async forwardMessage(event: NostrEvent) {
    if (event.kind !== kinds.EncryptedDirectMessage) return;

    const addressedTo = event.tags.find((t) => t[0] === "p")?.[1];
    if (!addressedTo) return;

    // get users inboxes
    let relays = (await this.app.addressBook.loadMailboxes(addressedTo))?.inboxes;

    if (!relays || relays.length === 0) {
      // try to send the DM to the users legacy app relays
      const contacts = await this.app.contactBook.loadContactsEvent(addressedTo);
      if (contacts) {
        const appRelays = getRelaysFromContactList(contacts);

        if (appRelays) relays = appRelays.filter((r) => r.write).map((r) => r.url);
      }
    }

    if (!relays || relays.length === 0) {
      // use fallback relays
      relays = this.explicitRelays;
    }

    this.log(`Forwarding message to ${relays.length} relays`);
    const results = await lastValueFrom(rxNostr.send(event, { on: { relays } }).pipe(toArray()));

    return results;
  }

  private getConversationKey(a: string, b: string) {
    if (a < b) return a + ":" + b;
    else return b + ":" + a;
  }

  watching = new Map<string, Subscription>();
  async watchInbox(pubkey: string) {
    if (this.watching.has(pubkey)) return;

    this.app.addressBook.loadMailboxes(pubkey, COMMON_CONTACT_RELAYS, true);

    this.log(`Watching ${pubkey} inboxes for mail`);
    const subscription = queryStore
      .createQuery(MailboxesQuery, pubkey)
      .pipe(
        // ignore undefined
        filter((m) => !!m),
        // start a new subscription for each update
        mergeMap((mailboxes) => {
          const relays = arrayFallback(mailboxes.inboxes, this.explicitRelays);
          this.log(`Subscribing to ${relays.length} relays for ${pubkey}`);

          const req = createRxForwardReq();
          const sub = rxNostr.use(req, { on: { relays } }).pipe(
            filter((packet) => this.app.eventStore.addEvent(packet.event)),
            // also pass to event store
            tap((packet) => eventStore.add(packet.event, packet.from)),
            // log how many events where found every 10s
            bufferAudit(10_000, (events) => {
              if (events.length > 0) this.log(`Found ${events.length} new events for ${pubkey}`);
            }),
          );

          req.emit({ kinds: [kinds.EncryptedDirectMessage], "#p": [pubkey] });

          return sub;
        }),
      )
      .subscribe();

    this.watching.set(pubkey, subscription);
  }
  stopWatchInbox(pubkey: string) {
    const sub = this.watching.get(pubkey);
    if (sub) {
      sub.unsubscribe();
      this.watching.delete(pubkey);
    }
  }

  openConversations = new Map<string, Subscription>();
  async openConversation(a: string, b: string) {
    const key = this.getConversationKey(a, b);

    if (this.openConversations.has(key)) return;

    const aMailboxes = await this.app.addressBook.loadMailboxes(a);
    const bMailboxes = await this.app.addressBook.loadMailboxes(b);

    // If inboxes for either user cannot be determined, either because nip65
    // was not found, or nip65 had no listed read relays, fallback to explicit relays
    const aInboxes = aMailboxes ? arrayFallback(aMailboxes.inboxes, this.explicitRelays) : this.explicitRelays;
    const bInboxes = bMailboxes ? arrayFallback(bMailboxes.inboxes, this.explicitRelays) : this.explicitRelays;

    const relays = new Set([...aInboxes, ...bInboxes]);

    const req = createRxForwardReq();
    const sub = rxNostr
      .use(req)
      .pipe(filter((packet) => this.app.eventStore.addEvent(packet.event)))
      .subscribe();

    req.emit([{ kinds: [kinds.EncryptedDirectMessage], authors: [a, b], "#p": [a, b] }]);

    this.log(`Opened conversation ${key} on ${relays.size} relays`);
    this.openConversations.set(key, sub);
    this.emit("open", a, b);
  }

  closeConversation(a: string, b: string) {
    const key = this.getConversationKey(a, b);

    const sub = this.openConversations.get(key);
    if (sub) {
      sub.unsubscribe();
      this.openConversations.delete(key);
      this.emit("close", a, b);
    }
  }

  [Symbol.dispose]() {
    for (const [_, sub] of this.watching) sub.unsubscribe();
    for (const [_, sub] of this.openConversations) sub.unsubscribe();
  }
}
