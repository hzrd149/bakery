import { Server } from "http";
import { logger } from "../../../logger.js";
import { getIPAddresses } from "../../../helpers/ip.js";
import ConfigManager from "../../config-manager.js";
import config from "../../../services/config.js";

import TorInbound from "./tor.js";
import I2PInbound from "./i2p.js";
import HyperInbound from "./hyper.js";

/** manages all inbound servers on other networks: hyper, tor, i2p, etc... */
export default class InboundNetworkManager {
  log = logger.extend("Network:Inbound");
  hyper: HyperInbound;
  tor: TorInbound;
  i2p: I2PInbound;

  running = false;
  get addresses() {
    const ip = getIPAddresses();
    const hyper = this.hyper.address;
    const tor = this.tor.address;

    return [...(ip ?? []), ...(tor ?? []), ...(hyper ?? [])];
  }

  constructor(public server: Server) {
    this.hyper = new HyperInbound();
    this.tor = new TorInbound();
    this.i2p = new I2PInbound();

    this.listenToAppConfig(config);
  }

  private getAddress() {
    const address = this.server.address();

    if (typeof address === "string" || address === null)
      throw new Error("External servers started when server does not have an address");

    return address;
  }

  private update(cfg = config.data) {
    if (!this.running) return;
    const address = this.getAddress();

    if (this.hyper.available && cfg.hyperEnabled !== this.hyper.running) {
      if (cfg.hyperEnabled) this.hyper.start(address);
      else this.hyper.stop();
    }

    if (this.tor.available) {
      if (!this.tor.running) this.tor.start(address);
    }

    if (this.i2p.available) {
      if (!this.i2p.running) this.i2p.start(address);
    }
  }

  /** A helper method to make the manager run off of the app config */
  listenToAppConfig(config: ConfigManager) {
    config.on("updated", this.update.bind(this));
  }

  start() {
    this.running = true;
    this.update();
  }

  async stop() {
    this.running = false;
    await this.hyper.stop();
    await this.tor.stop();
    await this.i2p.stop();
  }
}
