import EventEmitter from "events";
import { NostrEvent, SimplePool } from "nostr-tools";
import { Subscription } from "nostr-tools/abstract-relay";
import { getRelaysFromContactsEvent } from "applesauce-core/helpers";

import { BOOTSTRAP_RELAYS, LOOKUP_RELAYS } from "../../env.js";
import { logger } from "../../logger.js";
import App from "../../app/index.js";
import { arrayFallback } from "../../helpers/array.js";
import { requestLoader } from "../../services/loaders.js";
import SuperMap from "../../helpers/super-map.js";

type EventMap = {
  started: [Receiver];
  stopped: [Receiver];
  status: [string];
  rebuild: [];
  subscribed: [string, string[]];
  closed: [string, string[]];
  error: [Error];
  event: [NostrEvent];
};

type ReceiverStatus = "running" | "starting" | "errored" | "stopped";

export default class Receiver extends EventEmitter<EventMap> {
  log = logger.extend("Receiver");

  _status: ReceiverStatus = "stopped";
  get status() {
    return this._status;
  }
  set status(v: ReceiverStatus) {
    this._status = v;
    this.emit("status", v);
  }

  starting = true;
  startupError?: Error;

  app: App;
  pool: SimplePool;

  subscriptions = new Map<string, Subscription>();

  constructor(app: App, pool?: SimplePool) {
    super();
    this.app = app;
    this.pool = pool || app.pool;
  }

  // pubkey -> relays
  private pubkeyRelays = new Map<string, Set<string>>();
  // relay url -> pubkeys
  private relayPubkeys = new SuperMap<string, Set<string>>(() => new Set());

  // the current request map in the format of relay -> pubkeys
  map = new SuperMap<string, Set<string>>(() => new Set());

  async fetchData() {
    const owner = this.app.config.data.owner;
    if (!owner) throw new Error("Missing owner");

    const commonMailboxesRelays = [...BOOTSTRAP_RELAYS, ...LOOKUP_RELAYS];

    const ownerMailboxes = await requestLoader.mailboxes({ pubkey: owner, relays: commonMailboxesRelays }, true);

    this.log("Searching for owner kind:3 contacts");
    const contacts = await requestLoader.contacts(
      {
        pubkey: owner,
        relays: arrayFallback(ownerMailboxes?.outboxes, BOOTSTRAP_RELAYS),
      },
      true,
    );
    if (!contacts) throw new Error("Cant find contacts");

    this.pubkeyRelays.clear();
    this.relayPubkeys.clear();

    // add the owners details
    this.pubkeyRelays.set(owner, new Set(ownerMailboxes?.outboxes));
    if (ownerMailboxes?.outboxes) for (const url of ownerMailboxes?.outboxes) this.relayPubkeys.get(url).add(owner);

    this.log(`Found ${contacts.length} contacts`);

    let usersWithMailboxes = 0;
    let usersWithContactRelays = 0;
    let usersWithFallbackRelays = 0;

    // fetch all addresses in parallel
    await Promise.all(
      contacts.map(async (person) => {
        const mailboxes = await this.app.addressBook.loadMailboxes(
          person.pubkey,
          arrayFallback(ownerMailboxes?.inboxes, commonMailboxesRelays),
        );

        let relays = mailboxes?.outboxes ?? [];

        // if the user does not have any mailboxes try to get the relays stored in the contact list
        if (relays.length === 0) {
          const contacts = await this.app.contactBook.loadContactsEvent(
            person.pubkey,
            arrayFallback(ownerMailboxes?.inboxes, BOOTSTRAP_RELAYS),
          );

          if (contacts && contacts.content.startsWith("{")) {
            const parsed = getRelaysFromContactsEvent(contacts);
            if (parsed) {
              relays = Array.from(parsed.entries())
                .filter(([r, mode]) => mode === "all" || mode === "outbox")
                .map(([r]) => r);
              usersWithContactRelays++;
            } else {
              relays = BOOTSTRAP_RELAYS;
              usersWithFallbackRelays++;
            }
          } else {
            relays = BOOTSTRAP_RELAYS;
            usersWithFallbackRelays++;
          }
        } else usersWithMailboxes++;

        // add pubkey details
        this.pubkeyRelays.set(person.pubkey, new Set(relays));
        for (const url of relays) this.relayPubkeys.get(url).add(person.pubkey);
      }),
    );

    this.log(
      `Found ${usersWithMailboxes} users with mailboxes, ${usersWithContactRelays} user with relays in contact list, and ${usersWithFallbackRelays} using fallback relays`,
    );
  }

  buildMap() {
    this.map.clear();

    // sort pubkey relays by popularity
    for (const [pubkey, relays] of this.pubkeyRelays) {
      const sorted = Array.from(relays).sort((a, b) => this.relayPubkeys.get(b).size - this.relayPubkeys.get(a).size);

      // add the pubkey to their top two relays
      for (const url of sorted.slice(0, 2)) this.map.get(url).add(pubkey);
    }

    this.emit("rebuild");

    return this.map;
  }

  private handleEvent(event: NostrEvent) {
    this.emit("event", event);
  }

  async updateRelaySubscription(url: string) {
    const pubkeys = this.map.get(url);
    if (pubkeys.size === 0) return;

    const subscription = this.subscriptions.get(url);
    if (!subscription || subscription.closed) {
      const relay = await this.app.pool.ensureRelay(url);

      const sub = relay.subscribe([{ authors: Array.from(pubkeys) }], {
        onevent: this.handleEvent.bind(this),
        onclose: () => {
          this.emit("closed", url, Array.from(pubkeys));
          // wait 30 seconds then try to reconnect
          setTimeout(() => {
            this.updateRelaySubscription(url);
          }, 30_000);
        },
      });

      this.emit("subscribed", url, Array.from(pubkeys));
      this.subscriptions.set(url, sub);
      this.log(`Subscribed to ${url} for ${pubkeys.size} pubkeys`);
    } else {
      const hasOld = subscription.filters[0].authors?.some((p) => !pubkeys.has(p));
      const hasNew = Array.from(pubkeys).some((p) => !subscription.filters[0].authors?.includes(p));

      if (hasNew || hasOld) {
        // reset the subscription
        subscription.eosed = false;
        subscription.filters = [{ authors: Array.from(pubkeys) }];
        subscription.fire();
        this.log(`Subscribed to ${url} with ${pubkeys.size} pubkeys`);
      }
    }
  }

  ensureSubscriptions() {
    const promises: Promise<void>[] = [];

    for (const [url, pubkeys] of this.map) {
      const p = this.updateRelaySubscription(url).catch((error) => {
        // failed to connect to relay
        // this needs to be remembered and the subscription map should be rebuilt accordingly
      });

      promises.push(p);
    }

    return Promise.all(promises);
  }

  async start() {
    if (this.status === "running" || this.status === "starting") return;

    try {
      this.log("Starting");
      this.startupError = undefined;
      this.status = "starting";

      await this.fetchData();
      this.buildMap();
      await this.ensureSubscriptions();

      this.status = "running";
      this.emit("started", this);
    } catch (error) {
      this.status = "errored";
      if (error instanceof Error) {
        this.startupError = error;
        this.log(`Failed to start receiver`, error.message);
        this.emit("error", error);
      }
    }
  }

  /** stop receiving events and disconnect from all relays */
  stop() {
    if (this.status === "stopped") return;

    this.status = "stopped";

    for (const [relay, sub] of this.subscriptions) sub.close();
    this.subscriptions.clear();

    this.log("Stopped");
    this.emit("stopped", this);
  }

  destroy() {
    this.stop();
    this.removeAllListeners();
  }
}
