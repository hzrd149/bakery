import { EventEmitter } from "events";
import { NostrEvent } from "nostr-tools";
import { Deferred, createDefer } from "applesauce-core/promise";

import App from "../../app/index.js";
import { logger } from "../../logger.js";
import PubkeyScrapper from "./pubkey-scrapper.js";
import SuperMap from "../../helpers/super-map.js";
import { asyncLoader } from "../../services/loaders.js";

const MAX_TASKS = 10;

type EventMap = {
  event: [NostrEvent];
};

export type ScrapperState = {
  pubkeys: string[];
};

export default class Scrapper extends EventEmitter<EventMap> {
  app: App;
  log = logger.extend("scrapper:service");

  state: ScrapperState = { pubkeys: [] };

  // pubkey -> relay -> scrapper
  scrappers = new SuperMap<string, PubkeyScrapper>((pubkey) => {
    const scrapper = new PubkeyScrapper(this.app, pubkey);
    scrapper.on("event", (event) => this.emit("event", event));
    return scrapper;
  });

  constructor(app: App) {
    super();
    this.app = app;
  }

  async setup() {
    this.state = this.app.state.getMutableState<ScrapperState>("scrapper", { pubkeys: [] });
  }

  async ensureData() {
    if (!this.app.config.data.owner) throw new Error("Owner not setup yet");

    // get mailboxes and contacts
    const mailboxes = await asyncLoader.outboxes(this.app.config.data.owner);
    const contacts = await asyncLoader.contacts(this.app.config.data.owner);

    if (!contacts) throw new Error("Missing contact list");

    return { contacts, mailboxes };
  }

  private async scrapeOwner() {
    if (!this.running) return;

    try {
      if (!this.app.config.data.owner) throw new Error("Owner not setup yet");

      const scrapper = this.scrappers.get(this.app.config.data.owner);
      await scrapper.loadNext();
    } catch (error) {
      // eat error
    }

    setTimeout(this.scrapeOwner.bind(this), 1000);
  }

  private async scrapeForPubkey(pubkey: string, relay?: string) {
    const scrapper = this.scrappers.get(pubkey);
    if (relay) scrapper.additionalRelays = [relay];

    return await scrapper.loadNext();
  }

  tasks = new Set<Promise<any>>();
  private block?: Deferred<void>;
  private waitForBlock() {
    if (this.block) return this.block;

    this.block = createDefer();
    return this.block;
  }
  private unblock() {
    if (this.block) {
      this.block?.resolve();
      this.block = undefined;
    }
  }

  async scrapeContacts() {
    if (!this.running) return;

    const { contacts } = await this.ensureData();

    for (const person of contacts) {
      // check if the pubkey should be scraped
      if (!this.state.pubkeys.includes(person.pubkey)) continue;

      // await here if the task queue if full
      if (this.tasks.size >= MAX_TASKS) await this.waitForBlock();

      // check running again since this is resuming
      if (!this.running) return;

      const promise = this.scrapeForPubkey(person.pubkey, person.relays?.[0]);

      // add it to the tasks array
      this.tasks.add(promise);

      promise
        .catch((err) => {
          // eat the error
        })
        .finally(() => {
          this.tasks.delete(promise);
          this.unblock();
        });
    }

    // set timeout for next batch
    setTimeout(this.scrapeContacts.bind(this), 1000);
  }

  running = false;
  start() {
    this.running = true;

    this.scrapeOwner();
    this.scrapeContacts();
  }

  stop() {
    this.running = false;
  }

  addPubkey(pubkey: string) {
    this.state.pubkeys.push(pubkey);
  }

  removePubkey(pubkey: string) {
    this.state.pubkeys = this.state.pubkeys.filter((p) => p !== pubkey);
  }
}
