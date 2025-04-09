import { WebSocketServer } from "ws";
import { Server } from "http";
import { SimpleSigner } from "applesauce-signers/signers/simple-signer";
import { kinds } from "nostr-tools";
import { AbstractRelay } from "nostr-tools/abstract-relay";
import express, { Express } from "express";
import { EventEmitter } from "events";
import { filter } from "rxjs";
import cors from "cors";

import { logger } from "../logger.js";

import { NIP_11_SOFTWARE_URL } from "../const.js";
import { OWNER_PUBKEY, BAKERY_PORT } from "../env.js";

import DirectMessageManager from "../modules/direct-message-manager.js";
import AddressBook from "../modules/address-book.js";
import NotificationsManager from "../modules/notifications/notifications-manager.js";
import ProfileBook from "../modules/profile-book.js";
import ContactBook from "../modules/contact-book.js";
import CautiousPool from "../modules/cautious-pool.js";
import LogStore from "../modules/log-store/log-store.js";
import DecryptionCache from "../modules/decryption-cache/decryption-cache.js";
import ApplicationStateManager from "../modules/application-state/manager.js";
import InboundNetworkManager from "../modules/network/inbound/index.js";
import OutboundNetworkManager from "../modules/network/outbound/index.js";
import SecretsManager from "../modules/secrets-manager.js";
import Switchboard from "../modules/switchboard/switchboard.js";
import Gossip from "../modules/gossip.js";
import secrets from "../services/secrets.js";
import bakeryConfig from "../services/bakery-config.js";
import logStore from "../services/log-store.js";
import stateManager from "../services/app-state.js";
import eventCache from "../services/event-cache.js";
import { inboundNetwork, outboundNetwork } from "../services/network.js";
import { server } from "../services/server.js";
import { SQLiteEventStore } from "../sqlite/event-store.js";
import { NostrRelay } from "../relay/nostr-relay.js";
import { getDMRecipient } from "../helpers/direct-messages.js";
import { onConnection, onJSONMessage } from "../helpers/ws.js";
import QueryManager from "../modules/queries/manager.js";
import bakerySigner from "../services/bakery-signer.js";
import db from "../db/index.js";
import ActionManager from "../modules/actions/manager.js";

type EventMap = {
  listening: [];
};

export default class App extends EventEmitter<EventMap> {
  running = false;
  config: typeof bakeryConfig;
  secrets: SecretsManager;
  state: ApplicationStateManager;
  signer: SimpleSigner;

  server: Server;
  wss: WebSocketServer;
  express: Express;

  inboundNetwork: InboundNetworkManager;
  outboundNetwork: OutboundNetworkManager;

  database: typeof db;
  eventStore: SQLiteEventStore;
  logStore: LogStore;
  relay: NostrRelay;
  pool: CautiousPool;
  addressBook: AddressBook;
  profileBook: ProfileBook;
  contactBook: ContactBook;
  directMessageManager: DirectMessageManager;
  notifications: NotificationsManager;
  decryptionCache: DecryptionCache;
  switchboard: Switchboard;
  gossip: Gossip;

  constructor() {
    super();

    this.config = bakeryConfig;

    this.secrets = secrets;

    this.signer = bakerySigner;

    // set owner pubkey from env variable
    if (!this.config.data.owner && OWNER_PUBKEY) {
      this.config.setField("owner", OWNER_PUBKEY);
    }

    // create http and ws server interface
    this.server = server;
    this.inboundNetwork = inboundNetwork;
    this.outboundNetwork = outboundNetwork;

    /** make the outbound network reflect the app config */
    this.outboundNetwork.listenToAppConfig(this.config);

    // setup express
    this.express = express();
    this.express.use(cors());
    this.setupExpress();

    // pass requests to express server
    this.server.on("request", this.express);

    // create websocket server
    this.wss = new WebSocketServer({ server: this.server });

    // Fix CORS for websocket
    this.wss.on("headers", (headers, request) => {
      headers.push("Access-Control-Allow-Origin: *");
    });

    // Init sqlite database
    this.database = db;

    // create log managers
    this.logStore = logStore;

    this.state = stateManager;

    // Recognize local relay by matching auth string
    this.pool = new CautiousPool((relay: AbstractRelay, challenge: string) => {
      for (const [socket, auth] of this.relay.auth) {
        if (auth.challenge === challenge) return true;
      }
      return false;
    });

    // Initialize the event store
    this.eventStore = eventCache;

    // setup decryption cache
    this.decryptionCache = new DecryptionCache(this.database);

    // Setup managers user contacts and profiles
    this.addressBook = new AddressBook();
    this.profileBook = new ProfileBook();
    this.contactBook = new ContactBook();

    // Setup the notifications manager
    this.notifications = new NotificationsManager(this /*this.eventStore, this.state*/);
    this.notifications.webPushKeys = {
      publicKey: this.secrets.get("vapidPublicKey"),
      privateKey: this.secrets.get("vapidPrivateKey"),
    };
    this.notifications.setup();

    this.eventStore.on("event:inserted", (event) => {
      if (this.notifications.shouldNotify(event)) this.notifications.notify(event);
    });

    // Initializes direct message manager for subscribing to DMs
    this.directMessageManager = new DirectMessageManager(this);

    // set watchInbox for owner when config is loaded or changed
    this.config.on("updated", (config) => {
      if (config.owner) this.directMessageManager.watchInbox(config.owner);
    });

    const connection = onConnection(this.wss);

    // queries
    connection.subscribe((ws) => {
      const manager = new QueryManager(ws);
      const sub = onJSONMessage(ws)
        .pipe(filter((m) => Array.isArray(m)))
        .subscribe(manager.messages);

      ws.once("close", () => sub.unsubscribe());
    });

    // actions
    connection.subscribe((ws) => {
      const manager = new ActionManager(ws);
      const sub = onJSONMessage(ws)
        .pipe(filter((m) => Array.isArray(m)))
        .subscribe(manager.messages);

      ws.once("close", () => sub.unsubscribe());
    });

    this.relay = new NostrRelay(this.eventStore);
    this.relay.sendChallenge = true;
    this.relay.requireRelayInAuth = false;

    // NIP-66 gossip
    this.gossip = new Gossip(this.inboundNetwork, this.signer, this.pool, this.relay, this.eventStore);

    this.config.on("updated", (config) => {
      this.gossip.interval = config.gossipInterval;
      this.gossip.broadcastRelays = config.gossipBroadcastRelays;

      if (config.gossipEnabled && !this.gossip.running) this.gossip.start();
      else if (!config.gossipEnabled && this.gossip.running) this.gossip.stop();
    });

    // setup PROXY switchboard
    this.switchboard = new Switchboard(this);

    // attach switchboard to websocket server
    this.wss.on("connection", (ws, request) => {
      this.switchboard.handleConnection(ws, request);
    });

    // update profiles when conversations are opened
    this.directMessageManager.on("open", (a, b) => {
      this.profileBook.loadProfile(a, this.addressBook.getOutboxes(a));
      this.profileBook.loadProfile(b, this.addressBook.getOutboxes(b));
    });

    // only allow the owner to NIP-42 authenticate with the relay
    this.relay.checkAuth = (ws, auth) => {
      // If owner is not set, update it to match the pubkey
      // that signed the auth message. This allows the user
      // to set the owner pubkey from the initial login when
      // setting up their personal node (the owner pubkey may
      // otherwise be set using the env var `OWNER_PUBKEY`)
      if (!this.config.data.owner) {
        this.config.update((config) => {
          logger(`Owner is unset, setting owner to first NIP-42 auth: ${auth.pubkey}`);
          config.owner = auth.pubkey;
        });
        return true;
      }
      if (auth.pubkey !== this.config.data.owner) return "Pubkey dose not match owner";
      return true;
    };

    // if socket is unauthenticated only allow owner's events and incoming DMs
    this.relay.registerEventHandler((ctx, next) => {
      const auth = ctx.relay.getSocketAuth(ctx.socket);

      if (!auth) {
        // is it an incoming DM for the owner?
        if (ctx.event.kind === kinds.EncryptedDirectMessage && getDMRecipient(ctx.event) === this.config.data.owner)
          return next();

        if (ctx.event.pubkey === this.config.data.owner) return next();

        throw new Error(ctx.relay.makeAuthRequiredReason("This relay only accepts events from its owner"));
      }

      return next();
    });

    // handle forwarding direct messages by owner
    this.relay.registerEventHandler(async (ctx, next) => {
      if (ctx.event.kind === kinds.EncryptedDirectMessage && ctx.event.pubkey === this.config.data.owner) {
        // send direct message
        const results = await this.directMessageManager.forwardMessage(ctx.event);

        if (!results || !results.some((p) => p.ok)) throw new Error("Failed to forward message");
        return `Forwarded message to ${results.filter((p) => p.ok).length}/${results.length} relays`;
      } else return next();
    });

    // block subscriptions for sensitive kinds unless NIP-42 auth or Auth Code
    // this.relay.registerSubscriptionFilter((ctx, next) => {
    //   // always allow if authenticated with auth code
    //   const isAuthenticatedWithAuthCode = this.control.authenticatedConnections.has(ctx.socket);
    //   if (isAuthenticatedWithAuthCode) return next();

    //   const hasSensitiveKinds = ctx.filters.some(
    //     (filter) => filter.kinds && SENSITIVE_KINDS.some((k) => filter.kinds?.includes(k)),
    //   );

    //   if (hasSensitiveKinds) {
    //     const auth = ctx.relay.getSocketAuth(ctx.socket);
    //     if (!auth) throw new Error(ctx.relay.makeAuthRequiredReason("Cant view sensitive events without auth"));
    //   }

    //   return next();
    // });

    // Handle possible additional actions when the event store receives a new message
    this.eventStore.on("event:inserted", (event) => {
      const loadProfile = (pubkey: string) => {
        const profile = this.profileBook.getProfile(pubkey);
        if (!profile) {
          this.profileBook.loadProfile(pubkey, this.addressBook.getOutboxes(pubkey));
          this.addressBook.loadMailboxes(pubkey).then((mailboxes) => {
            this.profileBook.loadProfile(pubkey, mailboxes?.outboxes);
          });
        }
      };

      // Fetch profiles for all incoming DMs
      switch (event.kind) {
        case kinds.EncryptedDirectMessage:
          loadProfile(event.pubkey);
          break;
        default:
          loadProfile(event.pubkey);
          break;
      }
    });

    // Read the config again, this fires the "loaded" and "updated" events to synchronize all the other services
    // NOTE: its important this is called last. otherwise any this.config.on("update") listeners above will note fire
    this.config.read();
  }

  setupExpress() {
    this.express.get("/health", (req, res) => {
      res.status(200).send("Healthy");
    });

    // NIP-11
    this.express.get("/", (req, res, next) => {
      if (req.headers.accept === "application/nostr+json") {
        res.send({
          name: this.config.data.name,
          description: this.config.data.description,
          software: NIP_11_SOFTWARE_URL,
          supported_nips: NostrRelay.SUPPORTED_NIPS,
          pubkey: this.config.data.owner,
        });
      } else return next();
    });
  }

  async start() {
    this.running = true;
    await this.config.read();

    this.tick();

    // start http server listening
    await new Promise<void>((res) => this.server.listen(BAKERY_PORT, () => res()));

    logger(`Listening on`, BAKERY_PORT);

    if (process.send) process.send({ type: "RELAY_READY" });

    this.emit("listening");

    await this.inboundNetwork.start();
  }

  tick() {
    if (!this.running) return;

    setTimeout(this.tick.bind(this), 100);
  }

  async stop() {
    this.running = false;
    this.config.write();
    this.relay.stop();

    await this.inboundNetwork.stop();
    await this.outboundNetwork.stop();

    this.gossip.stop();

    // wait for server to close
    await new Promise<void>((res) => this.server.close(() => res()));
  }
}
