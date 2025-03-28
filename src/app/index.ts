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
import Database from "./database.js";

import { NIP_11_SOFTWARE_URL, SENSITIVE_KINDS } from "../const.js";
import { OWNER_PUBKEY, BAKERY_PORT } from "../env.js";

import ControlApi from "../modules/control/control-api.js";
import ConfigActions from "../modules/control/config-actions.js";
import ReceiverActions from "../modules/control/receiver-actions.js";
import Receiver from "../modules/receiver/index.js";
import DatabaseActions from "../modules/control/database-actions.js";
import DirectMessageManager from "../modules/direct-message-manager.js";
import DirectMessageActions from "../modules/control/dm-actions.js";
import AddressBook from "../modules/address-book.js";
import NotificationsManager from "../modules/notifications/notifications-manager.js";
import NotificationActions from "../modules/control/notification-actions.js";
import ProfileBook from "../modules/profile-book.js";
import ContactBook from "../modules/contact-book.js";
import CautiousPool from "../modules/cautious-pool.js";
import RemoteAuthActions from "../modules/control/remote-auth-actions.js";
import LogStore from "../modules/log-store/log-store.js";
import DecryptionCache from "../modules/decryption-cache/decryption-cache.js";
import DecryptionCacheActions from "../modules/control/decryption-cache.js";
import Scrapper from "../modules/scrapper/index.js";
import LogsActions from "../modules/control/logs-actions.js";
import ApplicationStateManager from "../modules/state/application-state-manager.js";
import ScrapperActions from "../modules/control/scrapper-actions.js";
import InboundNetworkManager from "../modules/network/inbound/index.js";
import OutboundNetworkManager from "../modules/network/outbound/index.js";
import SecretsManager from "../modules/secrets-manager.js";
import Switchboard from "../modules/switchboard/switchboard.js";
import Gossip from "../modules/gossip.js";
import database from "../services/database.js";
import secrets from "../services/secrets.js";
import bakeryConfig from "../services/config.js";
import logStore from "../services/log-store.js";
import stateManager from "../services/state.js";
import eventCache from "../services/event-cache.js";
import { inboundNetwork, outboundNetwork } from "../services/network.js";
import { server } from "../services/server.js";
import { SQLiteEventStore } from "../sqlite/event-store.js";
import { NostrRelay } from "../relay/nostr-relay.js";
import { getDMRecipient } from "../helpers/direct-messages.js";
import { onConnection, onJSONMessage } from "../helpers/ws.js";
import QueryManager from "../modules/queries/manager.js";
import "../modules/queries/queries/index.js";
import bakerySigner from "../services/bakery.js";

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

  database: Database;
  eventStore: SQLiteEventStore;
  logStore: LogStore;
  relay: NostrRelay;
  receiver: Receiver;
  scrapper: Scrapper;
  control: ControlApi;
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
    this.database = database;

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
    this.decryptionCache = new DecryptionCache(this.database.db);
    this.decryptionCache.setup();

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

    // Initializes receiver and scrapper for pulling data from remote relays
    this.receiver = new Receiver(this);
    this.receiver.on("event", (event) => this.eventStore.addEvent(event));

    this.scrapper = new Scrapper(this);
    this.scrapper.setup();

    // pass events from the scrapper to the event store
    this.scrapper.on("event", (event) => this.eventStore.addEvent(event));

    // Initializes direct message manager for subscribing to DMs
    this.directMessageManager = new DirectMessageManager(this);

    // set watchInbox for owner when config is loaded or changed
    this.config.on("updated", (config) => {
      if (config.owner) this.directMessageManager.watchInbox(config.owner);
    });

    // API for controlling the node
    this.control = new ControlApi(this);
    this.control.registerHandler(new ConfigActions(this));
    this.control.registerHandler(new ReceiverActions(this));
    this.control.registerHandler(new ScrapperActions(this));
    this.control.registerHandler(new DatabaseActions(this));
    this.control.registerHandler(new DirectMessageActions(this));
    this.control.registerHandler(new NotificationActions(this));
    this.control.registerHandler(new RemoteAuthActions(this));
    this.control.registerHandler(new DecryptionCacheActions(this));

    this.control.registerHandler(new LogsActions(this));

    // connect control api to websocket server
    this.control.attachToServer(this.wss);

    // if process has an RPC interface, attach control api to it
    if (process.send) this.control.attachToProcess(process);

    // queries
    onConnection(this.wss).subscribe((ws) => {
      const manager = new QueryManager(ws);
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

      if (config.gossipEnabled) this.gossip.start();
      else this.gossip.stop();
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

    // when the owner NIP-42 authenticates with the relay pass it along to the control
    this.relay.on("socket:auth", (ws, auth) => {
      if (auth.pubkey === this.config.data.owner) {
        this.control.authenticatedConnections.add(ws);
      }
    });

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
    this.relay.registerSubscriptionFilter((ctx, next) => {
      // always allow if authenticated with auth code
      const isAuthenticatedWithAuthCode = this.control.authenticatedConnections.has(ctx.socket);
      if (isAuthenticatedWithAuthCode) return next();

      const hasSensitiveKinds = ctx.filters.some(
        (filter) => filter.kinds && SENSITIVE_KINDS.some((k) => filter.kinds?.includes(k)),
      );

      if (hasSensitiveKinds) {
        const auth = ctx.relay.getSocketAuth(ctx.socket);
        if (!auth) throw new Error(ctx.relay.makeAuthRequiredReason("Cant view sensitive events without auth"));
      }

      return next();
    });

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

    if (this.config.data.runReceiverOnBoot) this.receiver.start();
    if (this.config.data.runScrapperOnBoot) this.scrapper.start();

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
    this.scrapper.stop();
    this.receiver.stop();
    await this.state.saveAll();
    this.relay.stop();
    this.database.destroy();
    this.receiver.destroy();

    await this.inboundNetwork.stop();
    await this.outboundNetwork.stop();

    this.gossip.stop();

    // wait for server to close
    await new Promise<void>((res) => this.server.close(() => res()));
  }
}
