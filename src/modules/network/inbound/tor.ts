import { AddressInfo } from "net";

import { TOR_ADDRESS } from "../../../env.js";
import { logger } from "../../../logger.js";
import { InboundInterface } from "../interfaces.js";

export default class TorInbound implements InboundInterface {
  log = logger.extend("Network:Inbound:Tor");

  readonly available = !!TOR_ADDRESS;
  readonly running = !!TOR_ADDRESS;
  readonly address = TOR_ADDRESS;
  error?: Error;

  async start(address: AddressInfo) {
    // not implemented yet
    if (TOR_ADDRESS) this.log(`Listening on ${TOR_ADDRESS}`);
  }

  async stop() {
    // not implemented yet
  }
}
