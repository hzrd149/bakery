import HolesailServer from "holesail-server";
import { encodeAddress } from "hyper-address";
import { hexToBytes } from "@noble/hashes/utils";
import { AddressInfo } from "net";

import { InboundInterface } from "../interfaces.js";
import { logger } from "../../../logger.js";
import secrets from "../../../services/secrets.js";

/** manages a holesail-server instance that points to the server http server */
export default class HyperInbound implements InboundInterface {
  hyper?: HolesailServer;
  log = logger.extend("Network:Inbound:Hyper");

  get available() {
    return true;
  }
  running = false;
  error?: Error;
  address?: string;

  async start(address: AddressInfo) {
    try {
      this.running = true;
      this.error = undefined;

      this.log(`Importing and starting hyperdht node`);

      const { default: HolesailServer } = await import("holesail-server");
      const { getOrCreateNode } = await import("../../../sidecars/hyperdht.js");

      const hyper = (this.hyper = new HolesailServer());
      hyper.dht = getOrCreateNode();

      return new Promise<void>((res) => {
        hyper.serve(
          {
            port: address.port,
            address: address.address,
            secure: false,
            buffSeed: secrets.get("hyperKey"),
          },
          () => {
            const address = "http://" + encodeAddress(hexToBytes(hyper.getPublicKey()));
            this.address = address;

            this.log(`Listening on ${address}`);
            res();
          },
        );
      });
    } catch (error) {
      this.running = false;
      if (error instanceof Error) this.error = error;
    }
  }

  async stop() {
    this.log("Shutting down");
    // disabled because holesail-server destroys the hyperdht node
    // this.hyper?.destroy();
    this.running = false;
    this.address = undefined;
    this.error = undefined;
  }
}
